'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

/* ============================================================
   PERSISTÊNCIA DE CARTAZES — imagens no IndexedDB (escalabilidade)
   As imagens (cartaz + carrossel) são o único dado binário pesado e viviam
   como base64 dentro do localStorage (~5MB) → enchia rápido. Agora:
   - State.posters (em memória) SEGUE com as imagens inline → render/export
     inalterados (caminho síncrono intocado).
   - No localStorage gravamos só METADADOS; cada imagem confirmada no IDB vira
     uma sentinela "@idb:<chave>". À prova de perda: a imagem só é trocada por
     sentinela DEPOIS de confirmada no IndexedDB (idbSet await).
   - No boot, hydratePosters() reidrata as imagens do IDB para a memória.
   ============================================================ */
const POSTER_TOP_IMG_FIELDS = ['image1', 'image2', 'image3', 'image4', 'figure'];
const POSTER_SLIDE_IMG_FIELDS = ['image1', 'image2', 'image3', 'image4'];
const idbConfirmedKeys = new Set();   // chaves de imagem já confirmadas no IDB

// Todas as posições de imagem de um cartaz (top-level + slides do carrossel).
function posterImagePositions(p) {
  const out = [];
  if (!p) return out;
  POSTER_TOP_IMG_FIELDS.forEach((f) => out.push({ get: () => p[f], set: (v) => { p[f] = v; }, key: 'pimg:' + p.id + ':' + f }));
  if (Array.isArray(p.slides)) {
    p.slides.forEach((s, i) => {
      if (!s) return;
      POSTER_SLIDE_IMG_FIELDS.forEach((f) => out.push({ get: () => s[f], set: (v) => { s[f] = v; }, key: 'pimg:' + p.id + ':s' + i + ':' + f }));
    });
  }
  return out;
}

/** Exclui um cartaz DEFINITIVAMENTE (some da galeria e do histórico) com uma
 *  janela de "Desfazer". O objeto removido fica em memória com as imagens
 *  inline; se o usuário desfizer, savePosters() as regrava no IDB. Sem confirm
 *  chato: um clique remove, com toast de desfazer por alguns segundos. */
function deletePosterById(id) {
  const idx = State.posters.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const removed = State.posters[idx];
  const wasActive = State.activePosterId === id;
  State.posters.splice(idx, 1);
  if (wasActive) State.activePosterId = State.posters[0] ? State.posters[0].id : null;
  if (typeof freePosterImages === 'function') freePosterImages(removed);  // recupera espaço já
  savePosters();
  renderPosters();
  let undone = false;
  toast('Cartaz removido.', 'success', 6000, { label: 'Desfazer', onClick: () => {
    if (undone) return; undone = true;
    State.posters.splice(Math.min(idx, State.posters.length), 0, removed);
    if (wasActive) State.activePosterId = id;
    savePosters();   // regrava as imagens do cartaz restaurado no IDB
    renderPosters();
  } });
}

// Libera as imagens de UM cartaz no IndexedDB (recupera espaço do dispositivo).
// Usado ao excluir um cartaz individual ou ao limpar todo o histórico.
function freePosterImages(p) {
  if (typeof idbDel !== 'function' || !p) return;
  try {
    posterImagePositions(p).forEach((pos) => { idbDel(pos.key).catch(() => {}); idbConfirmedKeys.delete(pos.key); });
  } catch (_) { /* */ }
}

// Cópia "leve" do cartaz: imagens já confirmadas no IDB viram sentinela; as
// ainda não confirmadas permanecem inline (segurança). Não muta o original.
function lightPosterCopy(p) {
  const c = Object.assign({}, p);
  POSTER_TOP_IMG_FIELDS.forEach((f) => {
    const k = 'pimg:' + p.id + ':' + f;
    if (idbConfirmedKeys.has(k) && typeof c[f] === 'string' && c[f].startsWith('data:')) c[f] = '@idb:' + k;
  });
  if (Array.isArray(p.slides)) {
    c.slides = p.slides.map((s, i) => {
      if (!s) return s;
      const sc = Object.assign({}, s);
      POSTER_SLIDE_IMG_FIELDS.forEach((f) => {
        const k = 'pimg:' + p.id + ':s' + i + ':' + f;
        if (idbConfirmedKeys.has(k) && typeof sc[f] === 'string' && sc[f].startsWith('data:')) sc[f] = '@idb:' + k;
      });
      return sc;
    });
  }
  return c;
}

// Persiste o ÍNDICE de cartazes (metadados leves, imagens como sentinela) no
// IndexedDB — limite = capacidade do dispositivo, não os ~5 MB do localStorage.
function _persistPosterIndex() {
  if (typeof idbSet !== 'function') return Promise.resolve();
  let light;
  try { light = State.posters.map(lightPosterCopy); } catch (_) { return Promise.resolve(); }
  return idbSet(HIST_KEYS.posters, light).catch((e) => {
    if (typeof _onHistSaveError === 'function') _onHistSaveError(e, 'arte');
    else if (typeof toast === 'function') toast('Não foi possível salvar a arte — armazenamento do dispositivo cheio. Exporte um backup.', 'error', 6000);
  });
}

// Grava cartazes: índice (leve) no IndexedDB + descarga de imagens (Blob) no IDB.
function savePosters() {
  _persistPosterIndex();
  offloadPosterImagesToIDB();
  // Histórico de edição (desfazer/refazer) — captura debounced do cartaz ativo.
  if (typeof posterHistoryCapture === 'function') posterHistoryCapture();
}

let _posterOffloadTimer = null;
// Move imagens inline (data:) para o IDB e, SÓ após confirmar, reescreve o
// localStorage com sentinelas (libera espaço sem janela de perda).
function offloadPosterImagesToIDB() {
  if (typeof idbSet !== 'function') return;
  clearTimeout(_posterOffloadTimer);
  _posterOffloadTimer = setTimeout(async () => {
    let newlyConfirmed = false;
    for (const p of State.posters) {
      for (const pos of posterImagePositions(p)) {
        const v = pos.get();
        if (typeof v === 'string' && v.startsWith('data:') && !idbConfirmedKeys.has(pos.key)) {
          // Guarda como Blob (binário, ~⅓ menor); fallback p/ string se a conversão falhar.
          const payload = (typeof dataUrlToBlob === 'function' && dataUrlToBlob(v)) || v;
          try { await idbSet(pos.key, payload); idbConfirmedKeys.add(pos.key); newlyConfirmed = true; } catch (_) { /* mantém inline */ }
        }
      }
    }
    if (newlyConfirmed) _persistPosterIndex();
  }, 350);
}

// Boot: carrega o índice de cartazes do IDB (migra do localStorage antigo, 1x) e
// reidrata as imagens do IDB para a memória (render/export usam inline).
async function hydratePosters() {
  if (typeof idbGet !== 'function') return;
  try {
    const idx = await idbGet(HIST_KEYS.posters);
    let persisted = true;
    if (Array.isArray(idx)) {
      State.posters = idx;                                  // já no IDB (formato novo)
    } else if (Array.isArray(State.posters) && State.posters.length) {
      // Migração: o índice veio do localStorage no init (já é cópia leve c/ sentinelas).
      try { await idbSet(HIST_KEYS.posters, State.posters); } catch (_) { persisted = false; }
    }
    // IDB é a fonte da verdade — limpa a chave legada (até vazia), salvo se falhou.
    if (persisted) { try { localStorage.removeItem(STORAGE_KEYS.posters); } catch (_) { /* */ } }
  } catch (_) { /* */ }
  if (!Array.isArray(State.posters)) return;
  let any = false;
  for (const p of State.posters) {
    for (const pos of posterImagePositions(p)) {
      const v = pos.get();
      if (typeof v === 'string' && v.startsWith('@idb:')) {
        const key = v.slice(5);
        try {
          const data = await idbGet(key);
          if (data) {
            // IDB guarda Blob (novo) ou string dataURL (legado/importado) → o
            // caminho quente usa SEMPRE dataURL em memória.
            const url = (typeof Blob !== 'undefined' && data instanceof Blob && typeof blobToDataUrl === 'function')
              ? await blobToDataUrl(data) : data;
            pos.set(url); idbConfirmedKeys.add(key); any = true;
          } else { pos.set(null); }
        } catch (_) { /* */ }
      }
    }
  }
  if (any && State.currentView === 'posters' && typeof renderPosters === 'function') renderPosters();
  // Reidratação é assíncrona e roda em paralelo ao boot (goTo('welcome') já
  // pintou a home ANTES de State.posters chegar do IDB) — sem isto, a home
  // fica presa mostrando "nada por aqui" mesmo com histórico real chegando
  // um instante depois.
  if (State.currentView === 'welcome' && typeof renderHome === 'function') renderHome();
  offloadPosterImagesToIDB(); // descarrega quaisquer imagens ainda inline
}

/* ============================================================
   POSTERS — parser + template + export
   ============================================================ */

// Port direto do CartazParserService.dart
function parseFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return {
    headline: extractHeadline(lines, text),
    category: extractCategory(text),
    location: extractLocation(text),
    subtitle: extractSubtitle(lines),
    footer: extractFooter(lines),
  };
}

function extractSubtitle(lines) {
  for (const line of lines) {
    const m = line.match(/^[\*#\-•\s]*[Ss]ubt[íi]tulo\s*[:\-—]\s*(.{5,})$/);
    if (m) return m[1].trim();
  }
  if (lines.length >= 2) {
    const clean = lines[1]
      .replace(/^[#*\-•\s]+/, '')
      .replace(/^(t[íi]tulo|subt[íi]tulo|lead|corpo|descri[çc][ãa]o)\s*[:\-—]\s*/i, '')
      .trim();
    if (clean.length >= 5 && clean.length <= 300) return clean;
  }
  return '';
}

function extractHeadline(lines, full) {
  for (const line of lines) {
    const clean = line.replace(/^[#*\-•\s]+/, '');
    if (clean.length > 20 && clean.length <= 120) {
      return clean.toUpperCase();
    }
  }
  const clean = full.replace(/^[#*\-•\s]+/, '');
  return (clean.length > 100 ? clean.slice(0, 100) : clean).toUpperCase();
}

function extractCategory(text) {
  const categories = {
    'POLÍTICA': ['governador', 'prefeito', 'vereador', 'deputado', 'senador', 'eleição', 'partido', 'projeto de lei', 'câmara municipal', 'assembleia legislativa', 'mandato', 'posse', 'gestão pública'],
    'SEGURANÇA': ['polícia', 'crime', 'homicídio', 'assalto', 'roubo', 'operação', 'prisão', 'suspeito', 'delegacia', 'ocorrência', 'investigação', 'fuga', 'captura', 'apreensão'],
    'ECONOMIA': ['economia', 'emprego', 'pib', 'inflação', 'dólar', 'mercado', 'investimento', 'comércio', 'receita', 'desemprego', 'salário', 'empresa'],
    'SAÚDE': ['saúde', 'hospital', 'sus', 'médico', 'vacina', 'doença', 'pandemia', 'posto de saúde', 'upa', 'samu', 'enfermagem', 'campanha de vacinação'],
    'EDUCAÇÃO': ['escola', 'educação', 'universidade', 'professor', 'aluno', 'matrícula', 'enem', 'vestibular', 'sec', 'recesso escolar', 'merenda'],
    'ESPORTE': ['futebol', 'campeonato', 'jogo', 'atleta', 'vitória', 'derrota', 'time', 'copa', 'gol', 'partida', 'torcida', 'estádio'],
    'CULTURA': ['cultura', 'música', 'teatro', 'cinema', 'festival', 'evento', 'arte', 'show', 'exposição', 'carnaval'],
    'MEIO AMBIENTE': ['meio ambiente', 'sustentabilidade', 'desmatamento', 'incêndio', 'mata', 'natureza', 'poluição', 'seca', 'enchente', 'recursos hídricos'],
    'INFRAESTRUTURA': ['obra', 'infraestrutura', 'estrada', 'ponte', 'saneamento', 'água', 'luz', 'asfalto', 'pavimentação'],
    'TRÂNSITO': ['trânsito', 'acidente', 'rodovia', 'engarrafamento', 'semáforo', 'batida', 'colisão', 'detran', 'blitz'],
    'AGRONEGÓCIO': ['agronegócio', 'safra', 'colheita', 'agricultura', 'pecuária', 'irrigação', 'agrícola', 'produtor rural', 'soja', 'milho'],
    'TURISMO': ['turismo', 'praia', 'hotel', 'pousada', 'feriado', 'carnaval', 'réveillon', 'roteiro', 'destino', 'visitante', 'hospedagem'],
    'RELIGIÃO': ['igreja', 'missa', 'culto', 'procissão', 'festividade', 'romaria', 'padroeiro', 'paróquia', 'diocese'],
    'JUDICIÁRIO': ['justiça', 'juiz', 'tribunal', 'sentença', 'processo', 'tjba', 'foro', 'vara', 'desembargador', 'decisão judicial'],
    'EMPREENDEDORISMO': ['empreendedorismo', 'startup', 'negócio', 'mei', 'microempresa', 'sebrae', 'incubadora', 'franquia'],
    'PODER PÚBLICO': ['decreto', 'portaria', 'licitação', 'concurso público', 'nomeação', 'exoneração', 'secretaria municipal', 'gabinete', 'prefeitura', 'governo do estado'],
    'SOCIEDADE': ['comunidade', 'voluntariado', 'doação', 'campanha solidária', 'ong', 'associação', 'mutirão', 'ação social'],
    'CLIMA': ['previsão do tempo', 'chuva', 'temporal', 'seca', 'alerta climático', 'inmet', 'temperatura', 'umidade', 'onda de calor', 'frente fria'],
    'TRANSPORTE': ['transporte público', 'ônibus', 'mobilidade urbana', 'terminal', 'passagem', 'frota', 'itinerário'],
  };
  const lower = text.toLowerCase();
  let bestScore = 0; let best = 'GERAL';
  for (const [cat, keywords] of Object.entries(categories)) {
    let score = 0;
    for (const kw of keywords) {
      const weight = kw.split(' ').length;
      const count = lower.split(kw).length - 1;
      score += count * weight;
    }
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

function extractLocation(text) {
  // Separador entre palavras = espaço/tab (NUNCA \s, que casa \n e atravessaria a
  // quebra de linha, colando o início do parágrafo seguinte no nome da cidade).
  let m = text.match(/([A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+(?:[ \t]+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+)*)[ \t]*\/[ \t]*BA/i);
  if (m) return `${m[1].trim()}, BA`;
  m = text.match(/([A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+(?:[ \t]+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+)*)[ \t]*,[ \t]*BA/i);
  if (m) return `${m[1].trim()}, BA`;
  m = text.match(/\bem[ \t]+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+(?:[ \t]+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+)*)/);
  if (m) return `${m[1].trim()}, BA`;
  const cities = ['Ilhéus','Itabuna','Salvador','Vitória da Conquista','Feira de Santana','Camaçari','Juazeiro','Porto Seguro','Lauro de Freitas','Teixeira de Freitas','Eunápolis','Itamaraju','Santa Cruz Cabrália','Canavieiras','Una','Belmonte','Mascote','Camacan','Arataca','Ibicaraí','Ibirapitanga','Gandu','Igrapiúna','Nilo Peçanha','Taperoá','Valença','Piraí do Norte','Presidente Tancredo Neves','Wenceslau Guimarães','Ibirataia','Aurelino Leal','Ubatã','Gongogi','Dário Meira','Nova Ibiá','Manoel Vitorino','Planaltino','Aiquara','Jiquiriçá','Laje','Mutuípe','São Miguel das Matas','Amargosa','Santo Antônio de Jesus','Cachoeira','São Félix','Maragogipe','Salinas da Margarida','Conceição do Almeida','Santo Amaro','Saúde','Irará','Ouriçangas','Sapeaçu','Castro Alves','Elísio Medrado','Santa Teresinha','Dom Macedo Costa','Pedrão','Tanquinho','Rafael Jambeiro'];
  for (const c of cities) if (text.includes(c)) return `${c}, BA`;
  const portal = State.portals[State.activePortalIndex] || State.portals[0] || {};
  return portal.location || 'Salvador, BA';
}

function extractFooter(lines) {
  if (!lines.length) return '';
  const last = lines[lines.length - 1];
  if (last.length <= 130) return last;
  return last.slice(0, 127) + '...';
}

/**
 * Faz parse estruturado da matéria gerada pela IA, separando
 * título, subtítulo e descrição (lead). Aceita 3 formatos:
 *
 * 1) Com prefixos asteriscos: "*Título: ...", "*Subtítulo: ...", "*Lead: ..."
 * 2) Com prefixos limpos:     "Título: ...",  "Subtítulo: ...",  "Lead: ..."
 * 3) Sem prefixos: linha 1 = título, linha 2 = subtítulo, linha 3+ = lead
 */
function parseGenerationStructure(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const result = { title: '', subtitle: '', description: '' };

  // First pass: label matching com suporte a valor multi-linha
  const labelRegex = /^[\*#\-•\s]*(t[íi]tulo|subt[íi]tulo|lead|corpo|descri[çc][ãa]o)\s*[:\-—]\s*(.*)$/i;
  const labeled = {};
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(labelRegex);
    if (match) {
      const key = match[1].toLowerCase()
        .replace(/[íi]/g, 'i')
        .replace(/[çc]/g, 'c')
        .replace(/[ãa]/g, 'a');
      let value = match[2].trim();
      // Se o label casou mas o valor está vazio, tenta a próxima linha
      if (!value && i + 1 < lines.length) {
        const next = lines[i + 1];
        if (!next.match(labelRegex)) {
          value = next;
          i++; // consome a linha seguinte
        }
      }
      labeled[key] = value;
    }
  }

  if (labeled.titulo) result.title = labeled.titulo;
  if (labeled.subtitulo) result.subtitle = labeled.subtitulo;
  if (labeled.lead) result.description = labeled.lead;
  else if (labeled.descricao) result.description = labeled.descricao;

  // Fallback posicional (quando a IA não usou labels)
  if (!result.title && lines.length >= 1) {
    result.title = stripPrefix(lines[0]);
  }
  if (!result.subtitle && lines.length >= 2) {
    // Varre TODAS as linhas após a 1ª, não só as 3 primeiras
    for (let i = 1; i < lines.length; i++) {
      const candidate = stripPrefix(lines[i]);
      if (candidate.length >= 5 && candidate.length <= 300) {
        result.subtitle = candidate;
        if (!result.description && i + 1 < lines.length) {
          for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
            const desc = stripPrefix(lines[j]);
            if (desc.length >= 30) {
              result.description = desc;
              break;
            }
          }
        }
        break;
      }
    }
  }

  // Second pass: título veio de label mas subtítulo não
  if (!result.subtitle && labeled.titulo) {
    // Acha a linha onde o título foi encontrado e pega a 1ª linha substancial depois dela
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(labelRegex);
      if (m) {
        const k = m[1].toLowerCase()
          .replace(/[íi]/g, 'i')
          .replace(/[çc]/g, 'c')
          .replace(/[ãa]/g, 'a');
        if (k === 'titulo') {
          for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
            if (!lines[j].match(labelRegex)) {
              const candidate = stripPrefix(lines[j]);
              if (candidate.length >= 5 && candidate.length <= 300) {
                result.subtitle = candidate;
                break;
              }
            }
          }
          break;
        }
      }
    }
  }

  return result;
}

/** Remove prefixos comuns de linha (asteriscos, "Título:", etc.) */
function stripPrefix(line) {
  return line
    .replace(/^[\*#\-•]+\s*/, '')
    .replace(/^(t[íi]tulo|subt[íi]tulo|lead|corpo|descri[çc][ãa]o)\s*[:\-—]\s*/i, '')
    .trim();
}

/* ============================================================
   REGRA ÚNICA DE AUTOPREENCHIMENTO — parseArticle()
   Fonte ÚNICA usada por TODOS os fluxos que enviam conteúdo para Cartaz/Carrossel
   (Gerar, Detector, Replicador…). Aproveita ao máximo o que a IA já produziu e
   DERIVA do próprio texto o que faltar. Retorna a estrutura normalizada:
   { title, subtitle, lead, body, bodyParagraphs, cta, category, location }.
   ============================================================ */
// Linhas de metadados (descartadas) e de estrutura (prefixo removido, valor mantido).
const ARTICLE_DROP_RE = /^[\*#>\-•\s]*(hashtags?|tags?|legenda|cr[eé]ditos?|fonte|imagem|foto)\s*[:\-—]/i;
const ARTICLE_LABEL_RE = /^[\*#>\-•\s]*(t[íi]tulo|subt[íi]tulo|lead|corpo|descri[çc][ãa]o|se[çc][ãa]o|intert[íi]tulo|chamada|resumo)\s*[:\-—]\s*/i;

/** Parágrafos do CORPO: sem metadados, sem o título, com rótulos removidos. */
function articleBodyParagraphs(raw, title) {
  const titleNorm = String(title || '').trim().toLowerCase();
  const out = [];
  for (const lineRaw of String(raw || '').split('\n')) {
    const t = lineRaw.trim();
    if (!t) continue;
    if (ARTICLE_DROP_RE.test(t)) continue;
    const line = t.replace(ARTICLE_LABEL_RE, '').replace(/^[\*#>\-•\s]+/, '').trim();
    if (line.length < 2) continue;
    if (line.toLowerCase() === titleNorm) continue;
    out.push(line);
  }
  return out;
}

/** 1ª frase de um texto (para derivar um subtítulo curto quando não há um). */
function firstSentence(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const m = s.match(/^[\s\S]*?[.!?](?=\s|$)/);
  const out = (m ? m[0] : s).trim();
  return out.length <= 200 ? out : truncate(out, 160);
}

/** Procura um subtítulo declarado por rótulo ("Subtítulo: ..."). */
function matchLabeledSubtitle(raw) {
  for (const lineRaw of String(raw || '').split('\n')) {
    const m = lineRaw.trim().match(/^[\*#>\-•\s]*subt[íi]tulo\s*[:\-—]\s*(.{5,})$/i);
    if (m) return m[1].trim();
  }
  return '';
}

function parseArticle(content) {
  const raw = String(content || '');
  const meta = parseFromText(raw);                 // categoria / local / footer / fallback de título
  const struct = parseGenerationStructure(raw);    // título (rótulo OU posicional)
  const title = (struct.title || meta.headline || '').trim();

  // Corpo completo (todas as linhas substanciais menos título/metadados).
  let bodyLines = articleBodyParagraphs(raw, title);

  // Subtítulo: rótulo explícito > 1ª linha curta do corpo > 1ª frase do lead.
  let subtitle = matchLabeledSubtitle(raw);
  if (subtitle) {
    bodyLines = bodyLines.filter((l) => l.toLowerCase() !== subtitle.toLowerCase());
  } else if (bodyLines.length >= 2 && bodyLines[0].length <= 160) {
    subtitle = bodyLines.shift();                   // 1ª linha curta = subtítulo; resto = corpo
  }

  const lead = bodyLines[0] || subtitle || '';
  if (!subtitle) subtitle = firstSentence(lead) || truncate(lead, 160) || title;

  const body = bodyLines.join('\n\n').trim() || lead || subtitle || title;

  return {
    title,
    subtitle: subtitle.trim(),
    lead: lead.trim(),
    body,
    bodyParagraphs: bodyLines,
    cta: '',                                        // sem "chamada" explícita na matéria
    category: meta.category,
    location: meta.location,
  };
}

function createPosterFromGeneration(g) {
  // Regra ÚNICA de autopreenchimento: distribui TODO o conteúdo disponível.
  // Gerações do pipeline trazem campos estruturados (sem reparse com perda);
  // as antigas caem no parseArticle sobre o texto plano.
  const art = (g.article && typeof artFromPipeline === 'function' && artFromPipeline(g)) || parseArticle(g.content);

  const poster = {
    id: uuid(),
    generationId: g.id,
    template: 'manchete',
    format: '3:4',
    headline: art.title,           // Título → Headline
    category: art.category,        // categoria inferida
    location: art.location,        // local inferido
    subtitle: art.subtitle,        // Subtítulo / resumo / chamada → Subtítulo
    description: art.body,          // Corpo COMPLETO → Texto longo
    footer: art.cta,
    image1: null,
    image2: null,
    image3: null,
    image4: null,
    avatar: null,
    image1PosX: 50,
    image1PosY: 50,
    image2PosX: 50,
    image2PosY: 50,
    image3PosX: 50,
    image3PosY: 50,
    image4PosX: 50,
    image4PosY: 50,
    image1Scale: 1,
    image2Scale: 1,
    image3Scale: 1,
    image4Scale: 1,
    portalSnapshot: { ...(State.portals[State.activePortalIndex] || State.portals[0] || {}) },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  State.posters.unshift(poster);
  savePosters();
  State.activePosterId = poster.id;
  _peOpen = true;                      // handoff (matéria → cartaz) abre o editor
  toast('Cartaz criado.', 'success');
  goTo('posters');
}

/* Estado de APRESENTAÇÃO da ferramenta (r98.1): a tela tem 3 modos —
   vazio → galeria "Meus cartazes" → editor focado. `_peOpen` diz se o editor
   está aberto; abrir/fechar passa por openPosterEditor()/closePosterEditor(). */
let _peOpen = false;

function openPosterEditor(id) {
  if (id) State.activePosterId = id;
  _peOpen = true;
  if (State.currentView !== 'posters') goTo('posters');
  else renderPosters();
}

function closePosterEditor() {
  // Descarrega qualquer edição ainda na janela de espera do auto-save.
  if (typeof _posterCommitFields === 'function') { try { _posterCommitFields({ flush: true }); } catch (_) {} }
  _posterCommitFields = null;   // o closure aponta para o cartaz que está saindo
  _peOpen = false;
  renderPosters();
  const main = document.querySelector('.main');
  if (main) main.scrollTo({ top: 0, behavior: 'auto' });
}

function renderPosters() {
  // O <select> de modelos é gerado do registro (fonte única) — precisa existir
  // antes de qualquer leitura de valor.
  if (typeof fillTemplateSelect === 'function') fillTemplateSelect();
  initPortalForm();
  const has = State.posters.length > 0;
  if (!has) _peOpen = false;
  if (has && (!State.activePosterId || !State.posters.find(p => p.id === State.activePosterId))) {
    State.activePosterId = State.posters[0].id;
  }
  const editing = has && _peOpen;

  // A GALERIA cobre o estado vazio (o tile "Novo cartaz" é o único ponto de
  // criação — r109.1: removido o botão duplicado do topo). #p-empty aposentado.
  $('#p-empty').classList.add('hidden');
  const gal = $('#p-gallery');
  if (gal) gal.classList.toggle('hidden', editing);
  $('#p-content').classList.toggle('hidden', !editing);
  // Modo focado: esconde appbar + tab bar (o editor tem topbar e dock próprios)
  document.body.classList.toggle('pe-full', editing);

  renderPostersList();
  // O botão "Histórico" existe TAMBÉM na galeria, mas quem o ligava era o
  // setupPostersChrome() lá embaixo — só alcançado no modo edição. Resultado:
  // na galeria o botão não fazia absolutamente nada. Como a função é
  // idempotente, ligá-la aqui cobre os dois modos.
  setupPostersChrome();
  if (!editing) { renderPosterGallery(); return; }

  renderPosterEditor();
  setupEditorChrome();
  // Refit após o layout assentar (a troca p/ modo focado muda o container do canvas):
  // síncrono (leitura força reflow) + RAF de reforço (RAF pode não disparar em aba oculta).
  if (typeof fitPosterPreview === 'function') {
    fitPosterPreview();
    requestAnimationFrame(() => fitPosterPreview());
  }
}

/** Galeria "Meus cartazes": grade com miniaturas + tile "Novo". Porta de entrada
 *  da ferramenta — tocar um cartaz abre o editor focado. */
function renderPosterGallery() {
  const host = $('#p-gallery');
  if (!host) return;
  host.innerHTML = `
    <button class="pg-card pg-new" id="pg-new" type="button" aria-label="Criar novo cartaz">
      <span class="pg-new-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>
      <span class="pg-new-label">Novo cartaz</span>
    </button>` + State.posters.map(p => {
    const isCar = (typeof posterIsCarousel === 'function' && posterIsCarousel(p));
    const title = ((typeof posterDisplayTitle === 'function') ? posterDisplayTitle(p) : p.headline) || 'Cartaz';
    const img = (typeof p.image1 === 'string' && p.image1.slice(0, 5) === 'data:') ? p.image1 : null;
    return `
    <div class="pg-card" data-pid="${p.id}" role="button" tabindex="0" aria-label="${escapeHtml(truncate(title, 60))}">
      <button class="pg-del" data-del="${p.id}" type="button" title="Excluir cartaz" aria-label="Excluir cartaz">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="pg-thumb">
        ${img ? `<img src="${img}" alt="" loading="lazy">` : `<span class="pg-thumb-ph">${escapeHtml(title.trim().charAt(0).toUpperCase() || '?')}</span>`}
        ${isCar ? `<span class="pg-badge">▤ ${p.slides.length}</span>` : ''}
      </div>
      <div class="pg-name">${escapeHtml(truncate(title, 52))}</div>
      <div class="pg-meta">${formatDate(p.updatedAt || p.createdAt)}</div>
    </div>`;
  }).join('');
  const nb = $('#pg-new');
  if (nb) nb.onclick = () => createBlankPoster();
  host.querySelectorAll('.pg-card[data-pid]').forEach(el => {
    const open = () => openPosterEditor(el.dataset.pid);
    el.onclick = (e) => { if (e.target.closest('[data-del]')) return; open(); };  // o × não abre o editor
    el.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('[data-del]')) { e.preventDefault(); open(); } };
  });
  host.querySelectorAll('.pg-del[data-del]').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); deletePosterById(btn.dataset.del); };
  });
}

/** Reorganiza o chrome do editor (idempotente): MOVE os botões de ação existentes
 *  — com seus handlers — para a topbar (#et-actions) e para o menu ⋯ (#et-menu).
 *  Frequente fica a 1 toque (desfazer/refazer/salvar/exportar); secundário
 *  (qualidade, IA, modo, zip, excluir) mora no menu. Nada é perdido. */
/* Divisor arrastável (mobile) entre o PREVIEW e o painel de edição. O usuário
   arrasta a barrinha: pra cima aumenta a edição (preview menor), pra baixo
   aumenta o preview (edição menor). A altura escolhida fica salva. Desktop não
   usa (lá o layout é lado a lado). */
function setupPreviewSplitter() {
  const editor = document.getElementById('p-editor');
  if (!editor) return;
  let handle = editor.querySelector(':scope > .pe-split-handle');
  if (!handle) {
    handle = document.createElement('div');
    handle.className = 'pe-split-handle';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-label', 'Arraste para ajustar o tamanho do preview');
    handle.innerHTML = '<span class="grab"></span>';
    editor.insertBefore(handle, editor.firstChild);
    _wirePreviewSplitter(handle, editor);
  }
  // aplica a altura salva (px). clamp defensivo contra telas menores.
  const saved = (typeof loadJSON === 'function') ? loadJSON(STORAGE_KEYS.posterPanelH, null) : null;
  if (typeof saved === 'number' && saved > 0) {
    const maxH = Math.round((window.innerHeight || 700) * 0.84);
    editor.style.setProperty('--pe-panel-h', Math.max(132, Math.min(maxH, saved)) + 'px');
    // re-encaixa o cartaz no espaço resultante (a altura salva muda o preview)
    if (typeof fitPosterPreview === 'function') requestAnimationFrame(() => fitPosterPreview());
  }
}
function _wirePreviewSplitter(handle, editor) {
  const panelOf = () => editor.querySelector(':scope > .pedit-panels');
  let drag = null;
  let rafId = 0;
  // Re-escala o cartaz pra caber no novo espaço — em tempo real. Sem isso, o
  // painel muda de tamanho mas o cartaz só re-encaixava quando algo chamava
  // fitPosterPreview() (ex.: mexer numa opção do editor). rAF junta as mudanças
  // num frame só (arraste fluido, sem re-layout a cada pixel).
  const refit = () => {
    rafId = 0;
    if (typeof fitPosterPreview === 'function') fitPosterPreview();
  };
  const scheduleRefit = () => { if (!rafId) rafId = requestAnimationFrame(refit); };

  handle.addEventListener('pointerdown', (e) => {
    const panel = panelOf();
    if (!panel) return;
    e.preventDefault();
    if (handle.setPointerCapture) { try { handle.setPointerCapture(e.pointerId); } catch (_) { /* */ } }
    drag = { startY: e.clientY, startH: panel.getBoundingClientRect().height };
    handle.classList.add('dragging');
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    e.preventDefault();
    // arrastar pra CIMA (clientY diminui) → painel MAIOR → preview menor
    const maxH = Math.round((window.innerHeight || 700) * 0.84);
    const h = Math.max(132, Math.min(maxH, drag.startH + (drag.startY - e.clientY)));
    editor.style.setProperty('--pe-panel-h', h + 'px');
    scheduleRefit();   // cartaz acompanha o arraste na hora
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    handle.classList.remove('dragging');
    if (typeof fitPosterPreview === 'function') fitPosterPreview();   // encaixe final exato
    const panel = panelOf();
    if (panel && typeof saveJSON === 'function') {
      saveJSON(STORAGE_KEYS.posterPanelH, Math.round(panel.getBoundingClientRect().height));
    }
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

function setupEditorChrome() {
  const top = $('#et-top');
  if (!top) return;
  if (typeof setupPreviewSplitter === 'function') setupPreviewSplitter();
  const acts = $('#et-actions');
  const menuItems = $('#et-menu-items');
  const put = (id, host) => { const el = $(`#${id}`); if (el && host && el.parentElement !== host) host.appendChild(el); };
  // Barra de ações enxuta: desfazer/refazer + UM ícone que abre a tela
  // "Finalizar" (salvar projeto ou exportar). Sem botão de salvar solto.
  ['p-undo', 'p-redo', 'p-export'].forEach(id => put(id, acts));
  ['p-improve', 'p-delete'].forEach(id => put(id, menuItems));
  // No menu, o botão de excluir (ícone-só na barra antiga) ganha rótulo
  const del = $('#p-delete');
  if (del && !del.dataset.labeled) { del.dataset.labeled = '1'; del.appendChild(document.createTextNode(' Excluir cartaz')); }
  // Título = cartaz ativo
  const p = State.posters.find(x => x.id === State.activePosterId);
  const t = $('#et-title');
  if (t && p) t.textContent = ((typeof posterDisplayTitle === 'function') ? posterDisplayTitle(p) : p.headline) || 'Cartaz';
  // "Transformar em carrossel" mora no menu ⋯ (r112) — só aparece na peça única.
  const toCar = $('#et-to-carousel');
  if (toCar) {
    const isCar = p && typeof posterIsCarousel === 'function' && posterIsCarousel(p);
    toCar.classList.toggle('hidden', !p || isCar);
    toCar.onclick = () => { if (p && typeof convertToCarousel === 'function') convertToCarousel(p); };
  }
  // Navegação
  const back = $('#et-back');
  if (back) back.onclick = () => closePosterEditor();
  const menu = $('#et-menu'), backdrop = $('#et-menu-backdrop');
  const openMenu = () => { if (menu) menu.classList.add('open'); if (backdrop) backdrop.classList.add('open'); };
  const closeMenu = () => { if (menu) menu.classList.remove('open'); if (backdrop) backdrop.classList.remove('open'); };
  const mb = $('#et-menu-btn');
  if (mb) mb.onclick = openMenu;
  if (backdrop) backdrop.onclick = closeMenu;
  if (menu && !menu._wired) {
    menu._wired = true;
    // Qualquer ação do menu fecha o sheet (a qualidade — select — mantém aberto)
    menu.addEventListener('click', (e) => { if (e.target.closest('.btn')) closeMenu(); });
  }
}

/** Abre/fecha o painel lateral (drawer) do histórico de cartazes. */
function openHistoryDrawer() {
  const d = $('#p-history-drawer'), b = $('#p-history-backdrop');
  if (d) d.classList.add('open');
  if (b) b.classList.remove('hidden');
}
function closeHistoryDrawer() {
  const d = $('#p-history-drawer'), b = $('#p-history-backdrop');
  if (d) d.classList.remove('open');
  if (b) b.classList.add('hidden');
}

/** Liga os controles da tela de cartazes: drawer do histórico + abas Edição/Preview
 *  (telas estreitas). Idempotente — o listener global de Esc é anexado uma só vez. */
function setupPostersChrome() {
  if ($('#p-history-open')) $('#p-history-open').onclick = openHistoryDrawer;
  if ($('#p-history-close')) $('#p-history-close').onclick = closeHistoryDrawer;
  if ($('#p-history-backdrop')) $('#p-history-backdrop').onclick = closeHistoryDrawer;
  if (!setupPostersChrome._esc) {
    setupPostersChrome._esc = true;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHistoryDrawer(); });
  }
  // Abas Edição / Preview (só visíveis em telas estreitas via CSS)
  const layout = $('#p-content .posters-layout');
  const tabs = $('#p-pp-tabs');
  if (layout && tabs) {
    if (!layout.dataset.ptab) layout.dataset.ptab = 'edit';
    tabs.querySelectorAll('button[data-ptab]').forEach(btn => {
      btn.onclick = () => {
        layout.dataset.ptab = btn.dataset.ptab;
        tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
        if (btn.dataset.ptab === 'preview') requestAnimationFrame(() => fitPosterPreview());
      };
    });
  }
}

function createBlankPoster() {
  const poster = {
    id: uuid(),
    generationId: null,
    template: 'manchete',
    format: '3:4',
    headline: 'NOVO CARTAZ',
    category: 'GERAL',
    location: (State.portals[State.activePortalIndex] || State.portals[0] || {}).location || 'Salvador, BA',
    subtitle: '',
    description: '',
    footer: '',
    image1: null,
    image2: null,
    image3: null,
    image4: null,
    avatar: null,
    image1PosX: 50,
    image1PosY: 50,
    image2PosX: 50,
    image2PosY: 50,
    image3PosX: 50,
    image3PosY: 50,
    image4PosX: 50,
    image4PosY: 50,
    image1Scale: 1,
    image2Scale: 1,
    image3Scale: 1,
    image4Scale: 1,
    portalSnapshot: { ...(State.portals[State.activePortalIndex] || State.portals[0] || {}) },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  State.posters.unshift(poster);
  savePosters();
  State.activePosterId = poster.id;
  _peOpen = true;                      // criar leva direto ao editor
  renderPosters();
  toast('Cartaz criado.', 'success');
}

/** Recebe uma imagem pronta (data URL — ex.: recorte do Removedor de Fundo) e a
 *  adiciona como CAMADA no cartaz ativo, reusando o sistema de camadas unificado
 *  (r116): a imagem chega já movível, redimensionável e excluível. Se não houver
 *  cartaz ativo, cria um em branco. Chamado pelo canal 'agente:image-out'
 *  (src/handoff.js). */
function addImageAsLayer(dataUrl) {
  if (!dataUrl || !/^data:image\//.test(String(dataUrl))) return;
  let p = State.posters.find((x) => x.id === State.activePosterId);
  if (!p) {
    createBlankPoster();               // já define activePosterId + abre o editor
    p = State.posters.find((x) => x.id === State.activePosterId);
  }
  if (!p) return;
  const s = (typeof getSlide === 'function') ? (getSlide(p) || p) : p;
  if (!Array.isArray(s.layers)) s.layers = [];
  const layer = { id: uuid(), src: String(dataUrl), x: 50, y: 50, scale: 1, rotation: 0, z: nextOverlayZ(s) };
  s.layers.push(layer);
  p.updatedAt = new Date().toISOString();
  savePosters();
  State.activePosterId = p.id;
  _peOpen = true;
  // Já chega SELECIONADA: as alças (girar/redimensionar/excluir) aparecem na hora,
  // então o recorte é imediatamente manipulável, sem precisar descobrir o toque.
  if (typeof _peSelected !== 'undefined') _peSelected = layer.id;
  goTo('posters');                     // troca para a view Cartazes (renderiza o editor)
  // Abre direto a aba onde moram os controles da camada (Imagens › Camadas) —
  // o recorte chega pronto para editar, sem o usuário ter de procurar onde.
  const tab = document.querySelector('#p-edit-tabs .pedit-tab[data-pgroup="images"]');
  if (tab) tab.click();
  if (typeof renderLayerList === 'function') renderLayerList();
  if (typeof _refreshPosterPreview === 'function') _refreshPosterPreview();
  toast('Recorte virou camada: arraste, gire e redimensione à vontade.', 'success');
}

function renderPostersList() {
  // "Limpar tudo" — apaga só o histórico de cartazes/carrosséis (padrão da Gerar).
  const clearBtn = $('#p-history-clear');
  if (clearBtn) {
    clearBtn.style.display = State.posters.length ? '' : 'none';
    clearBtn.onclick = () => {
      if (!State.posters.length) return;
      if (!confirm('Apagar TODO o histórico de cartazes e carrosséis?')) return;
      State.posters.forEach(freePosterImages);   // libera as imagens no IDB
      State.posters = [];
      State.activePosterId = null;
      savePosters();
      renderPosters();
      toast('Histórico limpo.', 'success');
    };
  }
  $('#p-list').innerHTML = State.posters.map(p => {
    const isCar = (typeof posterIsCarousel === 'function' && posterIsCarousel(p));
    const title = (typeof posterDisplayTitle === 'function') ? posterDisplayTitle(p) : p.headline;
    const cat = (typeof posterDisplayCategory === 'function') ? posterDisplayCategory(p) : p.category;
    const carBadge = isCar
      ? `<span class="badge" style="font-size: 0.65rem; background:#16140f; color:#fff;">▤ Carrossel · ${p.slides.length}</span>`
      : '';
    return `
    <div class="list-item ${State.activePosterId === p.id ? 'active' : ''}" data-pid="${p.id}">
      <button class="list-item-del" data-del="${p.id}" type="button" title="Excluir cartaz" aria-label="Excluir">×</button>
      <div class="list-item-header">
        <div class="list-item-title">${escapeHtml(truncate(title, 80))}</div>
      </div>
      <div class="list-item-meta">
        ${carBadge}
        <span class="badge" style="font-size: 0.65rem;">${escapeHtml(cat)}</span>
        <span>${formatDate(p.createdAt)}</span>
      </div>
    </div>
  `; }).join('');
  $('#p-list').querySelectorAll('[data-pid]').forEach(el => {
    el.onclick = (e) => {
      if (e.target.closest('[data-del]')) return;            // o × não seleciona
      if (typeof closeHistoryDrawer === 'function') closeHistoryDrawer();   // fecha o painel ao escolher
      openPosterEditor(el.dataset.pid);                      // abre direto no editor
    };
  });
  $('#p-list').querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); deletePosterById(btn.dataset.del); };  // 1 clique + desfazer
  });
}

function renderPosterEditor() {
  const p = State.posters.find(x => x.id === State.activePosterId);
  if (!p) return;

  // Alvo de edição: o próprio cartaz, ou o SLIDE ativo se for carrossel.
  // (getSlide devolve o próprio p quando não há slides → cartaz único intacto.)
  const s = (typeof getSlide === 'function') ? getSlide(p) : p;

  // Migra o z-order unificado dos overlays (1ª vez que abre um cartaz legado).
  if (typeof ensureOverlayZ === 'function' && ensureOverlayZ(s)) savePosters();

  // Barra de carrossel (slides) — additiva; fica vazia p/ cartaz único.
  if (typeof renderCarouselBar === 'function') renderCarouselBar(p);

  // Navegação por categorias (Layout/Conteúdo/Imagens/Cores/Portal/Elementos):
  // mostra só o grupo ativo. Re-liga os cliques a cada render (idempotente).
  if (typeof setupPosterEditorTabs === 'function') setupPosterEditorTabs();

  // Preencher campos com valores do alvo (cartaz ou slide)
  $('#p-headline').value = s.headline || '';
  $('#p-category').value = s.category || '';
  $('#p-location').value = s.location || '';
  $('#p-subtitle').value = s.subtitle || '';
  // Controle ÚNICO de encaixe do texto (r165): governa corpo de fonte E
  // quebras de linha de uma vez. Ausente = padrão (ver TS_DEFAULT_FIT).
  const _fitPad = (typeof TS_DEFAULT_FIT === 'number') ? TS_DEFAULT_FIT : 72;
  [['p-fit-headline', s.fitHeadline], ['p-fit-subtitle', s.fitSubtitle]].forEach(([id, v]) => {
    const el = $('#' + id); if (!el) return;
    el.value = (typeof v === 'number') ? v : _fitPad;
    const out = $('#' + id + '-val'); if (out) out.textContent = el.value;
  });
  if ($('#p-description')) $('#p-description').value = s.description || '';
  if ($('#p-template')) $('#p-template').value = s.template || 'manchete';
  if ($('#p-format')) $('#p-format').value = s.format || '3:4';
  // Área segura: opções vêm do catálogo (fonte única) e o valor é do cartaz.
  const zsel = $('#p-safezone');
  if (zsel && typeof POSTER_SAFE_ZONES !== 'undefined') {
    if (!zsel.options.length) {
      zsel.innerHTML = Object.entries(POSTER_SAFE_ZONES)
        .map(([id, z]) => `<option value="${escapeHtml(id)}">${escapeHtml(z.label)}</option>`).join('');
    }
    // Cartaz salvo antes desta versão não tem o campo: fica 'livre' e nada muda.
    zsel.value = s.safeZone || (posterEhModeloDeRede(s.template) ? POSTER_SAFE_DEFAULT : 'livre');
  }
  if ($('#p-mosaic')) $('#p-mosaic').value = s.mosaic || 'auto';
  if ($('#p-theme')) $('#p-theme').value = p.theme || '';   // tema do CARTAZ (vazio = herda o portal)
  // Campos dedicados opcionais (mostrados só nos modelos que usam — ver updateExtraFields).
  if ($('#p-person-name')) $('#p-person-name').value = s.personName || '';
  if ($('#p-person-role')) $('#p-person-role').value = s.personRole || '';
  if ($('#p-figure')) $('#p-figure').value = s.figure || '';
  if ($('#p-label-a')) $('#p-label-a').value = s.labelA || '';
  if ($('#p-label-b')) $('#p-label-b').value = s.labelB || '';

  // Controle "Disposição das imagens" — visível só p/ modelos de foto com ≥2 imagens;
  // popula as opções conforme a quantidade de imagens do alvo (slide ou cartaz).
  // Controle "Área segura": só faz sentido nos modelos que compõem dentro dela.
  // Nos demais, ficaria um seletor sem efeito nenhum na tela — pior que ausente.
  // O controle vale para a BIBLIOTECA INTEIRA (r189): qualquer modelo pode ser
  // publicado em rede vertical, e a adaptação é central. Nos modelos da família
  // "Redes sociais" a opção "Livre" não aparece — neles a área segura não é um
  // ajuste, é a própria composição.
  // A área segura só existe no 9:16 — é onde o aplicativo desenha a interface
  // por cima do cartaz. Nos outros formatos o seletor seria um controle sem
  // efeito nenhum, então some e dá lugar à explicação de por quê.
  const updateSafeZoneControl = () => {
    const field = $('#p-safezone-field');
    const sel = $('#p-safezone');
    const hint = $('#p-safezone-hint');
    if (!field || !sel || typeof POSTER_SAFE_ZONES === 'undefined') return;
    const fmtId = $('#p-format') ? $('#p-format').value : (s.format || '3:4');
    const fmt = POSTER_FORMATS[fmtId];
    field.style.display = '';
    // Esconder/mostrar é feito pelo SELECT-fonte, não pela linha do picker:
    // _syncPickerRowEl faz a linha seguir o display do select (é assim que
    // #pb-pattern já funciona). Mexer na linha direto era desfeito no próximo
    // setupPosterPickers().
    if (typeof ptFormatoDeRede === 'function' && !ptFormatoDeRede(fmt)) {
      sel.style.display = 'none';
      if (hint) hint.textContent = 'Vale para o formato 9:16 (Reels, Stories, TikTok) — é onde o aplicativo cobre parte do cartaz. Nos demais formatos o modelo sai na composição original.';
      if (typeof setupPosterPickers === 'function') setupPosterPickers();
      return;
    }
    sel.style.display = '';
    const tpl = $('#p-template') ? $('#p-template').value : (s.template || '');
    const ehRede = posterEhModeloDeRede(tpl);
    const anterior = sel.value;
    const zonas = Object.entries(POSTER_SAFE_ZONES).filter(([id]) => !(ehRede && id === 'livre'));
    const html = zonas.map(([id, z]) => `<option value="${escapeHtml(id)}">${escapeHtml(z.label)}</option>`).join('');
    if (sel.innerHTML !== html) sel.innerHTML = html;
    const valido = zonas.some(([id]) => id === anterior);
    sel.value = valido ? anterior : (ehRede ? POSTER_SAFE_DEFAULT : (s.safeZone || 'livre'));
    const z = POSTER_SAFE_ZONES[sel.value];
    if (hint && z) hint.textContent = z.hint || '';
  };

  const updateMosaicControl = () => {
    const field = $('#p-mosaic-field'); const sel = $('#p-mosaic');
    if (!field || !sel) return;
    const tpl = $('#p-template') ? $('#p-template').value : (s.template || '');
    const nImg = (typeof posterImageKeys === 'function'
      ? posterImageKeys(s)
      : [s.image1, s.image2, s.image3, s.image4].filter(Boolean)).length;
    const isMultiImage = /^(manchete|destaque-foto|headline-premium|photo-story|carousel-cover|mosaic-hero|lower-third)/.test(tpl);
    if (!isMultiImage || nImg < 2 || typeof mosaicOptionsFor !== 'function') { field.style.display = 'none'; return; }
    field.style.display = '';
    const opts = mosaicOptionsFor(nImg);
    const cur = s.mosaic || 'auto';
    sel.innerHTML = opts.map(o => `<option value="${o.v}">${escapeHtml(o.l)}</option>`).join('');
    sel.value = opts.some(o => o.v === cur) ? cur : 'auto';
  };
  // Campos dedicados — só aparecem nos modelos que os usam.
  const updateExtraFields = () => {
    const tpl = $('#p-template') ? $('#p-template').value : (s.template || '');
    const show = (id, on) => { const f = $(`#${id}`); if (f) f.style.display = on ? '' : 'none'; };
    const person = (tpl === 'face-to-news' || tpl === 'quote-impact');
    const figure = (tpl === 'numbers-data');
    const labels = (tpl === 'comparison');
    show('p-pf-name-field', person);
    show('p-pf-role-field', person);
    show('p-pf-figure-field', figure);
    show('p-pf-labels-row', labels);
    // A sub-aba "Campos" existe só nos modelos que têm campo dedicado; sem
    // isso a pílula abriria um painel vazio.
    const subCampos = document.querySelector('.pedit-panel[data-pgroup="content"] .style-sub[data-sub="campos"]');
    if (subCampos) subCampos.dataset.subOff = (person || figure || labels) ? '0' : '1';
    // "Texto longo" agora é a sub-aba Corpo: quem entra nela quer justamente o
    // corpo, então recolher viraria um clique a mais sem ganho de rolagem (a
    // sub-aba já esconde tudo que não é dela). Antes era <details> recolhido no
    // meio da pilha e custava rolagem só para ser encontrado.
    const txt = $('#p-text-section');
    if (txt) txt.open = true;
    // Os campos dedicados acabaram de mudar de visibilidade: a pílula "Campos"
    // some quando nenhum deles se aplica ao modelo atual.
    if (typeof activatePanelSub === 'function') activatePanelSub('content', _pSubByGroup.content);
  };
  const onMediaChange = () => { updateProgressiveVisibility(); updateMosaicControl(); };

  // Inicializa previews das 4 mídias + avatar
  setupMediaUpload(s, 'image1', 'p-image1', onMediaChange);
  setupMediaUpload(s, 'image2', 'p-image2', onMediaChange);
  setupMediaUpload(s, 'image3', 'p-image3', onMediaChange);
  setupMediaUpload(s, 'image4', 'p-image4', onMediaChange);
  setupMediaUpload(s, 'avatar', 'p-avatar');
  setupMediaReorder();   // arrastar-e-soltar para reordenar as imagens (r103)
  updateProgressiveVisibility();
  updateMosaicControl();
  updateExtraFields();
  updateSafeZoneControl();

  // Live preview: cada campo atualiza o cartaz em tempo real
  const updatePreview = () => {
    const draft = {
      ...s,
      portalSnapshot: p.portalSnapshot,
      ...((typeof posterIsCarousel === 'function' && posterIsCarousel(p)) ? { _idx: (p.slideIndex || 0) + 1, _total: p.slides.length } : {}),
      template: $('#p-template') ? $('#p-template').value : (s.template || 'manchete'),
      format: $('#p-format') ? $('#p-format').value : (s.format || '3:4'),
      safeZone: $('#p-safezone') ? $('#p-safezone').value : s.safeZone,
      headline: $('#p-headline').value,
      category: ($('#p-category').value || '').toUpperCase(),
      location: $('#p-location').value,
      subtitle: $('#p-subtitle').value,
      fitHeadline: $('#p-fit-headline') ? +$('#p-fit-headline').value : s.fitHeadline,
      fitSubtitle: $('#p-fit-subtitle') ? +$('#p-fit-subtitle').value : s.fitSubtitle,
      description: $('#p-description') ? $('#p-description').value : s.description,
      mosaic: $('#p-mosaic') ? $('#p-mosaic').value : s.mosaic,
      theme: $('#p-theme') ? $('#p-theme').value : p.theme,   // tema é do CARTAZ (não do slide)
      custom: (typeof readPosterCustom === 'function') ? readPosterCustom() : p.custom,   // identidade visual ao vivo

      personName: $('#p-person-name') ? $('#p-person-name').value : s.personName,
      personRole: $('#p-person-role') ? $('#p-person-role').value : s.personRole,
      figure: $('#p-figure') ? $('#p-figure').value : s.figure,
      labelA: $('#p-label-a') ? $('#p-label-a').value : s.labelA,
      labelB: $('#p-label-b') ? $('#p-label-b').value : s.labelB,
    };
    renderPosterTemplate(draft);
    updateCounters();
  };
  // Expõe o updatePreview ATUAL (closure com os inputs vivos) para funções de
  // topo — camadas (r107) precisam re-renderizar o preview de fora do editor.
  _posterUpdatePreview = updatePreview;

  function updateCounters() {
    const updateOne = (id, max) => {
      const len = ($(`#${id}`).value || '').length;
      const counterEl = $(`#${id}-counter`);
      if (counterEl) {
        counterEl.textContent = `${len} / ${max}`;
        counterEl.classList.toggle('warn', len > max * 0.9);
      }
    };
    updateOne('p-headline', 120);
    updateOne('p-subtitle', 160);
    updateOne('p-description', 900);
  }

  // Aplica os valores atuais do editor a um alvo (cartaz ou slide).
  const applyEditorTo = (t) => {
    t.headline = $('#p-headline').value;
    t.category = ($('#p-category').value || '').toUpperCase();
    t.location = $('#p-location').value;
    t.subtitle = $('#p-subtitle').value;
    if ($('#p-fit-headline')) t.fitHeadline = +$('#p-fit-headline').value;
    if ($('#p-fit-subtitle')) t.fitSubtitle = +$('#p-fit-subtitle').value;
    if ($('#p-description')) t.description = $('#p-description').value;
    if ($('#p-template')) t.template = $('#p-template').value;
    if ($('#p-format')) t.format = $('#p-format').value;
    if ($('#p-safezone')) t.safeZone = $('#p-safezone').value;
    if ($('#p-person-name')) t.personName = $('#p-person-name').value;
    if ($('#p-person-role')) t.personRole = $('#p-person-role').value;
    if ($('#p-figure')) t.figure = $('#p-figure').value;
    if ($('#p-label-a')) t.labelA = $('#p-label-a').value;
    if ($('#p-label-b')) t.labelB = $('#p-label-b').value;
  };

  // AUTO-SAVE dos campos de texto.
  // Bug corrigido: estes campos só chamavam updatePreview(), que renderiza um
  // objeto `draft` DESCARTÁVEL. O cartaz nunca era tocado, nada ia para o
  // IndexedDB e toda edição manual se perdia ao sair do editor — enquanto
  // modelo, formato, mosaico, imagens e visibilidade já salvavam normalmente.
  // A gravação em memória é imediata (barato e resolve o "sair e voltar"); a
  // escrita no IndexedDB é adiada para não acontecer a cada tecla.
  let _pSaveT = null;
  const commitFields = (opts) => {
    applyEditorTo(s);
    p.updatedAt = new Date().toISOString();
    if (_pSaveT) { clearTimeout(_pSaveT); _pSaveT = null; }
    if (opts && opts.flush) { savePosters(); return; }
    _pSaveT = setTimeout(() => { _pSaveT = null; savePosters(); }, 400);
  };
  _posterCommitFields = commitFields;

  ['p-headline', 'p-category', 'p-location', 'p-subtitle', 'p-description',
   'p-person-name', 'p-person-role', 'p-figure', 'p-label-a', 'p-label-b'].forEach(id => {
    const el = $(`#${id}`);
    if (!el) return;
    el.oninput = () => { commitFields(); updatePreview(); };
    // Sair do campo grava na hora: fecha a janela em que a espera de 400ms
    // poderia perder a edição (troca de aba, fechar o app).
    el.onblur = () => commitFields({ flush: true });
  });
  // Encaixe do texto: recompõe ao arrastar (o número ao lado acompanha).
  ['p-fit-headline', 'p-fit-subtitle'].forEach(id => {
    const el = $(`#${id}`);
    if (!el) return;
    el.oninput = () => {
      const out = $(`#${id}-val`); if (out) out.textContent = el.value;
      commitFields();
      updatePreview();
    };
    el.onchange = () => commitFields({ flush: true });
  });

  // Toggle ATIVAR/DESATIVAR de cada imagem (sem apagar do projeto). Alterna a
  // chave em s.imagesOff → o render usa só as imagens ativas (posterImageKeys).
  ['image1', 'image2', 'image3', 'image4'].forEach(key => {
    const btn = $(`#p-${key}-toggle`);
    if (!btn) return;
    btn.onclick = (e) => {
      e.stopPropagation();
      if (!s[key]) return;
      const off = Array.isArray(s.imagesOff) ? s.imagesOff.slice() : [];
      const i = off.indexOf(key);
      if (i >= 0) off.splice(i, 1); else off.push(key);
      s.imagesOff = off;
      p.updatedAt = new Date().toISOString();
      savePosters();
      refreshImageToggles();
      updateMosaicControl();
      updatePreview();
      requestAnimationFrame(() => setupImagePanning($('#p-stage')));
    };
  });

  // Olhos de VISIBILIDADE por elemento (título, logo, rodapé, categoria, etc.):
  // ocultam o elemento do cartaz SEM apagar o dado (s.hidden). Reflete no preview
  // na hora; o export fotografa o DOM já filtrado (preview ≡ PNG).
  const refreshElementEyes = () => {
    const hidden = Array.isArray(s.hidden) ? s.hidden : [];
    document.querySelectorAll('.el-eye[data-el]').forEach(btn => {
      const off = hidden.includes(btn.dataset.el);
      btn.classList.toggle('off', off);
      btn.setAttribute('aria-pressed', String(!off));
      const row = btn.closest('.el-eye-row');
      if (row) row.classList.toggle('off', off);
    });
  };
  document.querySelectorAll('.el-eye[data-el]').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      const key = btn.dataset.el;
      const hidden = Array.isArray(s.hidden) ? s.hidden.slice() : [];
      const idx = hidden.indexOf(key);
      if (idx >= 0) hidden.splice(idx, 1); else hidden.push(key);
      s.hidden = hidden;
      p.updatedAt = new Date().toISOString();
      savePosters();
      refreshElementEyes();
      updatePreview();
    };
  });
  refreshElementEyes();

  // Troca de modelo/formato: persiste e re-renderiza (re-ativa pan pois alguns
  // modelos passam a usar imagem arrastável, e o formato muda as dimensões).
  ['p-template', 'p-format', 'p-safezone'].forEach(id => {
    const el = $(`#${id}`);
    if (!el) return;
    el.onchange = () => {
      const tplAntes = s.template;
      s.template = $('#p-template') ? $('#p-template').value : s.template;
      s.safeZone = $('#p-safezone') ? $('#p-safezone').value : s.safeZone;
      let newFmt = $('#p-format') ? $('#p-format').value : s.format;
      // Ao ENTRAR num modelo de redes sociais, leva junto o formato vertical:
      // é para 9:16 que as áreas seguras foram medidas, e trocar à mão logo
      // depois era o ajuste manual que o modelo deveria poupar. Só na entrada,
      // e avisando — quem quiser outro formato troca em seguida e fica.
      if (id === 'p-template' && posterEhModeloDeRede(s.template)
          && !posterEhModeloDeRede(tplAntes) && newFmt !== '9:16') {
        newFmt = '9:16';
        if ($('#p-format')) $('#p-format').value = '9:16';
        if (typeof toast === 'function') toast('Formato ajustado para 9:16 — é a proporção das áreas seguras de Reels, Stories e TikTok.', 'info', 5000);
      }
      // Ir para 9:16 é o sinal de que o cartaz vai para rede vertical: liga a
      // área segura sozinho. Só quando ainda está em 'livre' — escolha manual
      // do usuário nunca é sobrescrita —, e avisando, porque muda a composição.
      // Sair do 9:16 NÃO apaga a escolha: ela fica guardada e volta a valer se o
      // usuário retornar ao formato vertical. Fora dele a trava de ptSafeZone
      // já garante que nada é aplicado.
      if (id === 'p-format' && newFmt === '9:16' && !posterEhModeloDeRede(s.template)
          && (!s.safeZone || s.safeZone === 'livre')) {
        s.safeZone = POSTER_SAFE_DEFAULT;
        if ($('#p-safezone')) $('#p-safezone').value = POSTER_SAFE_DEFAULT;
        if (typeof toast === 'function') toast('Área segura ligada: o conteúdo foi recolhido para fora das faixas de legenda e botões. Desligue em Estilo → Formato se preferir a composição original.', 'info', 7000);
      }
      s.format = newFmt;
      // FORMATO é propriedade do CONJUNTO no carrossel: sincroniza TODOS os
      // slides + o nível do carrossel (o usuário muda uma vez e vale p/ todos).
      if (typeof posterIsCarousel === 'function' && posterIsCarousel(p)) {
        p.format = newFmt;
        p.slides.forEach(sl => { sl.format = newFmt; });
        if (typeof renderCarouselBar === 'function') renderCarouselBar(p);
      }
      p.updatedAt = new Date().toISOString();
      savePosters();
      updateMosaicControl();
      updateExtraFields();
      updateSafeZoneControl();
      if (typeof setupPosterPickers === 'function') setupPosterPickers();   // sincroniza a linha do picker
      updatePreview();
      requestAnimationFrame(() => {
        fitPosterPreview();
        setupImagePanning($('#p-stage'));
      });
    };
  });

  // Disposição das imagens (mosaico) — escolha manual do usuário.
  if ($('#p-mosaic')) {
    $('#p-mosaic').onchange = () => {
      s.mosaic = $('#p-mosaic').value;
      p.updatedAt = new Date().toISOString();
      savePosters();
      updatePreview();
      requestAnimationFrame(() => {
        fitPosterPreview();
        setupImagePanning($('#p-stage'));
        if (typeof posterIsCarousel === 'function' && posterIsCarousel(p) && typeof renderCarouselBar === 'function') renderCarouselBar(p);
      });
    };
  }

  // Tema visual do CARTAZ (override do tema do portal; '' = herda). É nível-cartaz.
  // FIX r100: a personalização de cor (p.custom: paleta/cores/fundo) roda POR CIMA
  // do tema no render — com ela ativa, trocar o tema não tinha efeito visível.
  // Escolher um tema agora REDEFINE a personalização de cor (o tema vale de verdade).
  if ($('#p-theme')) {
    $('#p-theme').onchange = () => {
      p.theme = $('#p-theme').value;
      if (p.custom) {
        p.custom = undefined;
        if (typeof writeControlsFromCustom === 'function') writeControlsFromCustom(null);
        toast('Tema aplicado — cores personalizadas redefinidas.', 'info');
      }
      p.updatedAt = new Date().toISOString();
      savePosters();
      updatePreview();
      requestAnimationFrame(() => {
        fitPosterPreview();
        setupImagePanning($('#p-stage'));
        if (typeof posterIsCarousel === 'function' && posterIsCarousel(p) && typeof renderCarouselBar === 'function') renderCarouselBar(p);
      });
    };
  }

  // Identidade visual (paleta/cores/gradiente/fundo/presets): nível-CARTAZ (p.custom),
  // persistido ao vivo como o tema, para export/carrossel/reload baterem com o preview.
  if (typeof setupPosterStyleControls === 'function') {
    setupPosterStyleControls(p, () => {
      p.custom = readPosterCustom();
      p.updatedAt = new Date().toISOString();
      savePosters();
      updatePreview();
      if (typeof renderCarouselBar === 'function' && typeof posterIsCarousel === 'function' && posterIsCarousel(p)) renderCarouselBar(p);
    });
  }

  updatePreview();
  requestAnimationFrame(() => {
    fitPosterPreview();
    setupImagePanning($('#p-stage'));
    if (typeof setupPosterElementEditing === 'function') setupPosterElementEditing();
  });
  // Painel "Elementos" (adicionar formas/badges, camadas, controles do selecionado).
  if (typeof renderPosterElementsPanel === 'function') renderPosterElementsPanel();
  // Recursos pro do editor (desfazer/refazer, modo simples/pro, melhorar design).
  if (typeof setupPosterProUI === 'function') setupPosterProUI();

  const isCarousel = () => (typeof posterIsCarousel === 'function' && posterIsCarousel(p));

  // "Salvar" agora vive DENTRO da tela de exportação (openPosterExportSettings),
  // via _savePosterProject() — a barra de ferramentas fica só com desfazer/
  // refazer + o ícone de exportar. (As edições já são auto-salvas ao longo do uso.)

  $('#p-delete').onclick = () => {
    if (!confirm('Remover este cartaz?')) return;
    freePosterImages(p);   // libera as imagens no IndexedDB (recupera espaço)
    State.posters = State.posters.filter(x => x.id !== p.id);
    savePosters();
    State.activePosterId = State.posters[0]?.id || null;
    _peOpen = false;       // após excluir, volta à galeria (feedback claro)
    renderPosters();
    toast('Cartaz removido.', 'success');
  };

  // Exportação: um ÍCONE abre a tela de configurações (proporção, resolução,
  // formato do arquivo e — no carrossel — imagens/zip), já pré-preenchida.
  $('#p-export').onclick = () => openPosterExportSettings(p);

  // Pickers em cards (r100): selects visuais viram áreas dedicadas com cards.
  if (typeof setupPosterPickers === 'function') setupPosterPickers();
  // Sub-navegação da aba Estilo (r111): Modelo·Formato·Temas·Ajustes·Favoritos.
  if (typeof setupStyleSubnav === 'function') setupStyleSubnav();
  // Aba Visibilidade (r106): linhas de imagem sincronizadas com imagesOff.
  if (typeof setupVisibilityImages === 'function') setupVisibilityImages();
  // Camadas (r107): botão adicionar + lista.
  if (typeof setupLayerControls === 'function') setupLayerControls();
}

/* ===== CAMADAS — controles na aba Imagens (r107) ===== */
// Ponte para o updatePreview vivo do editor (setado por renderPosterEditor).
let _posterUpdatePreview = null;
/** Grava os campos do editor no cartaz REAL. Exposto no escopo global porque a
 *  tela de exportação (fora do closure do editor) precisa dele — antes ela
 *  chamava `applyEditorTo`, que é `const` de outra função e nunca esteve
 *  visível ali: o "Salvar" silenciosamente não gravava os textos. */
let _posterCommitFields = null;
function _refreshPosterPreview() { if (typeof _posterUpdatePreview === 'function') _posterUpdatePreview(); }

/** Realça na LISTA a camada selecionada no cartaz (e vice-versa) — só troca a
 *  classe, sem repintar a lista: as miniaturas são data URLs pesadas e recriá-las
 *  a cada toque custaria caro. Chamado por _peApplySelection (poster-elements.js). */
function syncLayerListSelection() {
  const host = $('#p-layers-list');
  if (!host) return;
  const sel = (typeof _peSelected !== 'undefined') ? _peSelected : null;
  host.querySelectorAll('.layer-row').forEach((row) => {
    row.classList.toggle('sel', !!sel && row.dataset.lid === sel);
  });
}

function _activeSlideForLayers() {
  const p = State.posters.find(x => x.id === State.activePosterId);
  if (!p) return null;
  return (typeof getSlide === 'function') ? getSlide(p) : p;
}

function setupLayerControls() {
  const addBtn = $('#p-layer-add');
  const input = $('#p-layer-file');
  // Atalho "Recortar fundo": abre o Removedor sem sair do fluxo do cartaz. O
  // recorte volta sozinho como camada (postMessage 'agente:image-out').
  const cutBtn = $('#p-layer-cut');
  if (cutBtn) cutBtn.onclick = () => { if (typeof goTo === 'function') goTo('removedor'); };
  if (!addBtn || !input) return;
  addBtn.onclick = () => input.click();
  input.onchange = () => {
    const files = Array.from(input.files || []).filter(f => /^image\//.test(f.type));
    if (!files.length) return;
    const s = _activeSlideForLayers();
    if (!s) return;
    if (!Array.isArray(s.layers)) s.layers = [];
    let pending = files.length;
    files.forEach((f) => {
      const rd = new FileReader();
      rd.onload = () => {
        s.layers.push({ id: uuid(), src: String(rd.result), x: 50, y: 50, scale: 1, rotation: 0, z: nextOverlayZ(s) });
        if (--pending === 0) {
          const p = State.posters.find(x => x.id === State.activePosterId);
          if (p) p.updatedAt = new Date().toISOString();
          savePosters();
          renderLayerList();
          _refreshPosterPreview();
        }
      };
      rd.onerror = () => { if (--pending === 0) { renderLayerList(); _refreshPosterPreview(); } };
      rd.readAsDataURL(f);
    });
    input.value = '';
  };
  renderLayerList();
}

function renderLayerList() {
  const host = $('#p-layers-list');
  if (!host) return;
  const s = _activeSlideForLayers();
  const layers = (s && Array.isArray(s.layers)) ? s.layers : [];
  if (!layers.length) {
    host.innerHTML = '<div class="layers-empty">Nenhuma camada. Use “Recortar fundo” para transformar uma foto em recorte com fundo transparente — ele volta como camada livre — ou “Adicionar” para sobrepor uma imagem que já tenha.</div>';
    return;
  }
  // Cada linha traz os controles NUMÉRICOS da camada (tamanho e giro) — o mesmo
  // objeto também é manipulável direto no cartaz (arrastar/alça/pinça/rotação).
  const selId = (typeof _peSelected !== 'undefined') ? _peSelected : null;
  host.innerHTML = layers.map((L, i) => `
    <div class="layer-row${L.id === selId ? ' sel' : ''}" data-lid="${L.id}">
      <div class="layer-thumb" data-lsel="${L.id}"><img src="${escapeHtml(L.src)}" alt=""></div>
      <div class="layer-info">
        <div class="layer-name" data-lsel="${L.id}">Camada ${i + 1}</div>
        <div class="layer-ctl">
          <span class="layer-ctl-ico" title="Tamanho">⤢</span>
          <input type="range" class="layer-size" data-lid="${L.id}" min="15" max="300" value="${Math.round((L.scale || 1) * 100)}" title="Tamanho">
          <span class="layer-ctl-val">${Math.round((L.scale || 1) * 100)}%</span>
        </div>
        <div class="layer-ctl">
          <span class="layer-ctl-ico" title="Girar">↻</span>
          <input type="range" class="layer-rot" data-lid="${L.id}" min="0" max="359" value="${Math.round(L.rotation || 0)}" title="Girar">
          <span class="layer-ctl-val">${Math.round(L.rotation || 0)}°</span>
        </div>
      </div>
      <div class="layer-actions">
        <button type="button" class="layer-btn" data-lrot90="${L.id}" title="Girar 90°">⟳</button>
        <button type="button" class="layer-btn" data-ldup="${L.id}" title="Duplicar camada">⧉</button>
        <button type="button" class="layer-btn" data-lup="${L.id}" title="Trazer para frente">▲</button>
        <button type="button" class="layer-btn" data-ldown="${L.id}" title="Enviar para trás">▼</button>
        <button type="button" class="layer-btn danger" data-ldel="${L.id}" title="Excluir camada">×</button>
      </div>
    </div>`).join('');

  const commitAndRerender = (rerenderList) => {
    const p = State.posters.find(x => x.id === State.activePosterId);
    if (p) p.updatedAt = new Date().toISOString();
    savePosters();
    _refreshPosterPreview();
    if (rerenderList) renderLayerList();
  };
  // Enquanto o usuário arrasta o slider, atualiza SÓ o nó da camada no cartaz
  // (sem repintar o editor inteiro) — resposta imediata, sem engasgo.
  const liveNode = (lid) => {
    const stage = $('#p-stage');
    const root = stage && stage.querySelector('.poster-1440');
    return root ? root.querySelector(`[data-pt="layer"][data-lid="${lid}"]`) : null;
  };

  host.querySelectorAll('.layer-size').forEach(sl => {
    sl.oninput = () => {
      const L = layers.find(x => x.id === sl.dataset.lid);
      if (!L) return;
      L.scale = Math.max(0.15, Math.min(3, (parseInt(sl.value, 10) || 100) / 100));
      const val = sl.parentElement && sl.parentElement.querySelector('.layer-ctl-val');
      if (val) val.textContent = Math.round(L.scale * 100) + '%';
      const node = liveNode(L.id);
      if (node) node.style.width = Math.round(LAYER_BASE_W * L.scale) + 'px';
      else commitAndRerender(false);
    };
    sl.onchange = () => commitAndRerender(false);
  });
  host.querySelectorAll('.layer-rot').forEach(sl => {
    sl.oninput = () => {
      const L = layers.find(x => x.id === sl.dataset.lid);
      if (!L) return;
      L.rotation = ((parseInt(sl.value, 10) || 0) % 360 + 360) % 360;
      const val = sl.parentElement && sl.parentElement.querySelector('.layer-ctl-val');
      if (val) val.textContent = Math.round(L.rotation) + '°';
      const node = liveNode(L.id);
      if (node) node.style.transform = `translate(-50%,-50%) rotate(${L.rotation}deg)`;
      else commitAndRerender(false);
    };
    sl.onchange = () => commitAndRerender(false);
  });
  host.querySelectorAll('[data-lrot90]').forEach(b => {
    b.onclick = () => {
      const L = layers.find(x => x.id === b.dataset.lrot90);
      if (!L) return;
      L.rotation = (Math.round(L.rotation || 0) + 90) % 360;
      commitAndRerender(true);
    };
  });
  // Duplicar: cópia independente, deslocada 3% para não ficar exatamente atrás.
  host.querySelectorAll('[data-ldup]').forEach(b => {
    b.onclick = () => {
      const idx = layers.findIndex(x => x.id === b.dataset.ldup);
      if (idx < 0) return;
      const L = layers[idx];
      const copy = Object.assign({}, L, {
        id: uuid(),
        x: Math.min(96, (typeof L.x === 'number' ? L.x : 50) + 3),
        y: Math.min(96, (typeof L.y === 'number' ? L.y : 50) + 3),
        z: nextOverlayZ(s),
      });
      layers.splice(idx + 1, 0, copy);
      if (typeof _peSelected !== 'undefined') _peSelected = copy.id;
      commitAndRerender(true);
    };
  });
  // Selecionar pela lista = selecionar no cartaz (mostra alças de giro/tamanho).
  host.querySelectorAll('[data-lsel]').forEach(el => {
    el.onclick = () => { if (typeof _peSelectOverlay === 'function') _peSelectOverlay(el.dataset.lsel); };
  });
  host.querySelectorAll('[data-ldel]').forEach(b => {
    b.onclick = () => {
      const idx = layers.findIndex(x => x.id === b.dataset.ldel);
      if (idx < 0) return;
      layers.splice(idx, 1);
      commitAndRerender(true);
    };
  });
  // Reordenar usa a HIERARQUIA UNIFICADA (z-order de todos os overlays), não só
  // entre camadas — assim a imagem pode passar à frente/atrás de texto, avatar etc.
  host.querySelectorAll('[data-lup]').forEach(b => { b.onclick = () => reorderOverlay(b.dataset.lup, 'up'); });
  host.querySelectorAll('[data-ldown]').forEach(b => { b.onclick = () => reorderOverlay(b.dataset.ldown, 'down'); });
}

/** Aba VISIBILIDADE — linhas das imagens 1..4 ([data-imgvis]). Os demais itens
 *  usam .el-eye[data-el] (wiring genérico). Aqui: estado vem de s.imagesOff e o
 *  clique é PROXY para o toggle da miniatura (#p-imageN-toggle) — reusa toda a
 *  lógica existente (persistir + preview + estado do tile). */
function setupVisibilityImages() {
  const p = State.posters.find(x => x.id === State.activePosterId);
  if (!p) return;
  const s = (typeof getSlide === 'function') ? getSlide(p) : p;
  const off = Array.isArray(s.imagesOff) ? s.imagesOff : [];
  document.querySelectorAll('[data-imgvis]').forEach(row => {
    const key = row.dataset.imgvis;                 // 'image1'..'image4'
    const has = !!s[key];
    const isOff = has && off.includes(key);
    row.classList.toggle('empty', !has);
    row.classList.toggle('off', isOff);
    const btn = row.querySelector('.vis-img-eye');
    if (!btn) return;
    btn.classList.toggle('off', isOff);
    btn.disabled = !has;
    btn.onclick = () => {
      if (!has) return;
      const t = $(`#p-${key}-toggle`);
      if (t) { t.click(); setTimeout(setupVisibilityImages, 0); }
    };
  });
}

/* ===========================================================================
 * PICKERS EM CARDS (r100) — escolhas visuais (modelo/formato/tema/paleta/mosaico)
 * abrem uma ÁREA DEDICADA com um card por opção, no lugar do dropdown.
 * O <select> original permanece no DOM (oculto) como FONTE DA VERDADE: os cards
 * apenas setam .value e disparam 'change' — todo o wiring existente continua igual.
 * ==========================================================================*/
const POSTER_PICKER_DEFS = {
  'p-template':     { title: 'Modelo',                 kind: 'plain' },
  'p-format':       { title: 'Formato',                kind: 'format' },
  'p-safezone':     { title: 'Área segura da rede',    kind: 'safezone' },
  'p-theme':        { title: 'Tema',                   kind: 'theme' },
  'p-palette':      { title: 'Paleta de cores',        kind: 'palette' },
  'p-mosaic':       { title: 'Disposição das imagens', kind: 'plain' },
  'pb-type':        { title: 'Fundo do cartaz',        kind: 'plain' },
  'pb-pattern':     { title: 'Padrão gráfico',         kind: 'plain' },
  'pg-preset':      { title: 'Gradiente pronto',       kind: 'gradient' },
  's-portal-theme': { title: 'Tema visual do perfil',  kind: 'theme' },
};

function _pickerSwatch(value, kind) {
  const sw = (bg, a, b, c) => `<span class="pk-sw" style="background:${bg}"><i style="background:${a}"></i><i style="background:${b}"></i><i style="background:${c}"></i></span>`;
  if (kind === 'theme') {
    const t = (typeof PT_THEMES !== 'undefined') ? PT_THEMES[value] : null;
    if (!t) return '<span class="pk-sw pk-sw-auto">Perfil</span>';   // '' = herda o tema do perfil ativo
    return sw(t.navy, t.red, t.orange, t.cream);
  }
  if (kind === 'palette') {
    const t = (typeof POSTER_PALETTES !== 'undefined') ? POSTER_PALETTES[value] : null;
    if (!t) return '<span class="pk-sw pk-sw-auto">Tema</span>';     // '' = sem paleta (usa o tema)
    return sw(t.bg, t.accent, t.accent2, t.light ? '#1E1E1E' : '#FFFFFF');
  }
  if (kind === 'format') {
    const f = (typeof POSTER_FORMATS !== 'undefined') ? POSTER_FORMATS[value] : null;
    const ar = f ? `${f.w}/${f.h}` : '3/4';
    return `<span class="pk-fmt-wrap"><span class="pk-fmt" style="aspect-ratio:${ar}"></span></span>`;
  }
  if (kind === 'safezone') {
    // Miniatura 9:16 com as faixas que o aplicativo cobre — o usuário entende a
    // escolha olhando, sem precisar decorar percentuais.
    const z = (typeof POSTER_SAFE_ZONES !== 'undefined') ? POSTER_SAFE_ZONES[value] : null;
    if (!z) return '<span class="pk-sw pk-sw-auto">—</span>';
    const faixa = (css) => `<i style="position:absolute;background:rgba(207,52,24,.34);${css}"></i>`;
    return `<span class="pk-safe">
      ${faixa(`left:0;right:0;top:0;height:${z.top}%;`)}
      ${faixa(`left:0;right:0;bottom:0;height:${z.bottom}%;`)}
      ${faixa(`top:${z.top}%;bottom:${z.bottom}%;right:0;width:${z.right}%;`)}
      <i style="position:absolute;left:${z.left}%;right:${z.right}%;top:${z.top}%;bottom:${z.bottom}%;border:1.5px dashed rgba(13,148,136,.9);background:transparent;"></i>
    </span>`;
  }
  if (kind === 'gradient') {
    const g = (typeof POSTER_GRADIENTS !== 'undefined') ? POSTER_GRADIENTS[value] : null;
    if (!g) return '<span class="pk-sw pk-sw-auto">Livre</span>';   // '' = personalizado (De/Até)
    return `<span class="pk-sw" style="background:linear-gradient(135deg,${g.from},${g.to})"></span>`;
  }
  return '';
}

/** Esconde os selects-alvo e coloca no lugar uma linha "valor atual ›" que abre
 *  a área de cards. Também liga QUALQUER `.picker-row[data-for]` estática — os
 *  ATALHOS CONTEXTUAIS em outros painéis (ex.: Modelo/Formato dentro de Imagens)
 *  usam o mesmo mecanismo e ficam sincronizados. Idempotente. */
function setupPosterPickers() {
  Object.keys(POSTER_PICKER_DEFS).forEach((id) => {
    const sel = $(`#${id}`);
    if (!sel || !sel.parentElement) return;
    sel.classList.add('picker-bound');
    let row = sel.parentElement.querySelector(`.picker-row[data-for="${id}"]`);
    if (!row) {
      row = document.createElement('button');
      row.type = 'button';
      row.className = 'picker-row';
      row.dataset.for = id;
      row.innerHTML = '<span class="picker-row-value"></span><svg class="picker-row-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      sel.insertAdjacentElement('afterend', row);
    }
  });
  // Fiação + sincronização de TODAS as linhas (dinâmicas e atalhos estáticos)
  document.querySelectorAll('.picker-row[data-for]').forEach((row) => {
    if (!row._wired) {
      row._wired = true;
      row.onclick = () => openPosterPicker(row.dataset.for);
    }
    _syncPickerRowEl(row);
  });
  // Linha "Temas" unificada (aba Estilo) — tema-base + variações por família
  const ur = $('#p-unified-theme-row');
  if (ur) {
    if (!ur._wired) { ur._wired = true; ur.onclick = openUnifiedThemePicker; }
    syncUnifiedThemeRow();
  }
}

function _syncPickerRowEl(row) {
  const sel = $(`#${row.dataset.for}`);
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const v = row.querySelector('.picker-row-value');
  if (v) v.textContent = opt ? opt.textContent : '—';
  // Linhas junto do select seguem a visibilidade que o wiring lhe dá (ex.:
  // #pb-pattern só aparece com Fundo = Padrão). Atalhos (.picker-quick) não.
  if (!row.classList.contains('picker-quick')) {
    row.style.display = sel.style.display === 'none' ? 'none' : '';
  }
}

function _syncPickerRow(id) {
  document.querySelectorAll(`.picker-row[data-for="${id}"]`).forEach(_syncPickerRowEl);
}

function openPosterPicker(id) {
  const def = POSTER_PICKER_DEFS[id];
  const sel = $(`#${id}`);
  const box = $('#p-picker');
  if (!def || !sel || !box) return;
  box.dataset.for = id;
  const title = $('#p-picker-title');
  if (title) title.textContent = def.title;
  const grid = $('#p-picker-grid');
  grid.innerHTML = Array.from(sel.options).map(o => `
    <button type="button" class="pk-card ${o.value === sel.value ? 'active' : ''}" data-val="${escapeHtml(o.value)}">
      ${_pickerSwatch(o.value, def.kind)}
      <span class="pk-card-label">${escapeHtml(o.textContent)}</span>
    </button>`).join('');
  grid.querySelectorAll('.pk-card').forEach(card => {
    card.onclick = () => {
      sel.value = card.dataset.val;
      sel.dispatchEvent(new Event('change'));   // aciona o wiring existente (preview ao vivo)
      grid.querySelectorAll('.pk-card').forEach(c => c.classList.toggle('active', c === card));
      setupPosterPickers();                      // re-sincroniza as linhas de valor
    };
  });
  const panels = document.querySelector('#p-editor .pedit-panels');
  if (panels) panels.classList.add('picker-open');
  box.classList.remove('hidden');
  const back = $('#p-picker-back');
  if (back) back.onclick = closePosterPicker;
}

function closePosterPicker() {
  const panels = document.querySelector('#p-editor .pedit-panels');
  if (panels) panels.classList.remove('picker-open');
  const box = $('#p-picker');
  if (box) box.classList.add('hidden');
}

/* ===== TEMAS UNIFICADO (r105) =====
 * Um único seletor de cards que junta: temas-base (identidade/marca, select
 * #p-theme) + variações de cor POR FAMÍLIA DE FUNDO (paletas geradas, select
 * #p-palette). Tema-base limpa a personalização (regra r100); variação mantém
 * o fundo da família e troca só as cores dos demais elementos. */
function syncUnifiedThemeRow() {
  const row = $('#p-unified-theme-row');
  if (!row) return;
  const v = row.querySelector('.picker-row-value');
  if (!v) return;
  const palSel = $('#p-palette');
  const themeSel = $('#p-theme');
  const palVal = palSel && palSel.value;
  if (palVal && typeof POSTER_PALETTES !== 'undefined' && POSTER_PALETTES[palVal]) {
    const entry = POSTER_PALETTES[palVal];
    const fam = entry.family && (typeof POSTER_BG_FAMILIES !== 'undefined') && POSTER_BG_FAMILIES[entry.family];
    v.textContent = fam ? `${fam.label} · ${entry.label}` : entry.label;
  } else if (themeSel) {
    const opt = themeSel.options[themeSel.selectedIndex];
    v.textContent = opt ? opt.textContent : '—';
  }
}

/** Constrói o grid unificado de temas (identidade + famílias de fundo + clássicas)
 *  em QUALQUER elemento — usado inline (sub-aba Temas) e no overlay legado. */
function _renderUnifiedThemeInto(grid) {
  const themeSel = $('#p-theme');
  const palSel = $('#p-palette');
  if (!grid || !themeSel || !palSel) return;
  const activeKey = palSel.value ? `palette:${palSel.value}` : `theme:${themeSel.value}`;
  const card = (kind, val, label, swatch) => `
    <button type="button" class="pk-card ${activeKey === `${kind}:${val}` ? 'active' : ''}" data-kind="${kind}" data-val="${escapeHtml(val)}">
      ${swatch}
      <span class="pk-card-label">${escapeHtml(label)}</span>
    </button>`;
  let html = '<div class="pk-section">Identidade &amp; marca</div>';
  html += Array.from(themeSel.options).map(o => card('theme', o.value, o.textContent, _pickerSwatch(o.value, 'theme'))).join('');
  const pals = (typeof POSTER_PALETTES !== 'undefined') ? POSTER_PALETTES : {};
  if (typeof POSTER_BG_FAMILIES !== 'undefined') {
    Object.entries(POSTER_BG_FAMILIES).forEach(([famKey, fam]) => {
      const keys = Object.keys(pals).filter(k => pals[k].family === famKey);
      if (!keys.length) return;
      html += `<div class="pk-section">${escapeHtml(fam.label)}</div>`;
      html += keys.map(k => card('palette', k, pals[k].label, _pickerSwatch(k, 'palette'))).join('');
    });
  }
  const classics = Object.keys(pals).filter(k => !pals[k].family);
  if (classics.length) {
    html += '<div class="pk-section">Combinações clássicas</div>';
    html += classics.map(k => card('palette', k, pals[k].label, _pickerSwatch(k, 'palette'))).join('');
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.pk-card').forEach(c => {
    c.onclick = () => {
      const kind = c.dataset.kind, val = c.dataset.val;
      if (kind === 'theme') {
        themeSel.value = val;
        themeSel.dispatchEvent(new Event('change'));   // limpa personalização (r100) + re-render
      } else {
        palSel.value = val;
        palSel.dispatchEvent(new Event('change'));     // aplica a variação por cima do tema
      }
      const ak = kind === 'theme' ? `theme:${val}` : `palette:${val}`;
      grid.querySelectorAll('.pk-card').forEach(x =>
        x.classList.toggle('active', `${x.dataset.kind}:${x.dataset.val}` === ak));
      if (typeof syncUnifiedThemeRow === 'function') syncUnifiedThemeRow();
      if (typeof setupPosterPickers === 'function') setupPosterPickers();
    };
  });
}

function openUnifiedThemePicker() {
  const box = $('#p-picker');
  const grid = $('#p-picker-grid');
  if (!box || !grid) return;
  const title = $('#p-picker-title');
  if (title) title.textContent = 'Temas';
  _renderUnifiedThemeInto(grid);
  const panels = document.querySelector('#p-editor .pedit-panels');
  if (panels) panels.classList.add('picker-open');
  box.classList.remove('hidden');
  const back = $('#p-picker-back');
  if (back) back.onclick = closePosterPicker;
}

/* ===========================================================================
 * ABA ESTILO — sub-navegação horizontal (r111): Modelo · Formato · Temas ·
 * Ajustes manuais · Favoritos. Barra sempre visível; cada botão mostra sua
 * sub-área. Modelo/Formato/Temas = grids de cards inline (mesmos selects-fonte).
 * ==========================================================================*/
/* A sub-aba ativa da aba Estilo mora em `_pSubByGroup.colors` desde que as
 * subabas viraram genéricas (ver activatePanelSub). */

/** Popula o <select> de modelos a partir do REGISTRO (fonte única). Chamado
 *  no boot: acrescentar um modelo em POSTER_TEMPLATES basta para ele aparecer
 *  no editor, sem tocar no HTML. Mantém a ordem do registro, que é a ordem
 *  pensada de apresentação. */
function fillTemplateSelect() {
  const sel = $('#p-template');
  if (!sel || typeof POSTER_TEMPLATES === 'undefined') return;
  if (sel.options.length) return;                    // já preenchido
  sel.innerHTML = Object.entries(POSTER_TEMPLATES)
    .map(([id, t]) => `<option value="${escapeHtml(id)}" data-cat="${escapeHtml(t.cat || 'conteudo')}">${escapeHtml(t.label || id)}</option>`)
    .join('');
}

/** Categoria ativa no seletor de modelos (só navegação; não persiste no cartaz). */
let _pTplCat = 'todos';

/** Abas de categoria + grade filtrada. A biblioteca passou de 32 para 44
 *  modelos — uma lista corrida deixou de ser navegável. */
function _renderTemplatePicker(grid, sel) {
  if (!grid || !sel) return;
  const cats = (typeof POSTER_CATEGORIES !== 'undefined') ? POSTER_CATEGORIES : [{ id: 'todos', label: 'Todos' }];
  const catDe = (o) => o.dataset.cat || 'conteudo';
  const opts = Array.from(sel.options);
  // Só mostra abas que têm modelo (e "Todos" sempre).
  const usadas = new Set(opts.map(catDe));
  const abas = cats.filter((c) => c.id === 'todos' || usadas.has(c.id));
  if (!abas.some((c) => c.id === _pTplCat)) _pTplCat = 'todos';
  const visiveis = opts.filter((o) => _pTplCat === 'todos' || catDe(o) === _pTplCat);
  // O próprio contêiner é .picker-grid; com as abas dentro ele precisa voltar a
  // ser bloco e delegar a grade ao filho .tpl-grid.
  grid.classList.add('tpl-picker');
  grid.innerHTML =
    `<div class="tpl-cats">${abas.map((c) => {
      const n = c.id === 'todos' ? opts.length : opts.filter((o) => catDe(o) === c.id).length;
      return `<button type="button" class="tpl-cat${c.id === _pTplCat ? ' active' : ''}" data-cat="${escapeHtml(c.id)}">${escapeHtml(c.label)}<span class="tpl-cat-n">${n}</span></button>`;
    }).join('')}</div>` +
    (visiveis.length
      ? `<div class="picker-grid tpl-grid">${visiveis.map((o) =>
          `<button type="button" class="pk-card ${o.value === sel.value ? 'active' : ''}" data-val="${escapeHtml(o.value)}">${_pickerSwatch(o.value, 'plain')}<span class="pk-card-label">${escapeHtml(o.textContent)}</span></button>`).join('')}</div>`
      : '<p class="layers-empty">Nenhum modelo nesta categoria.</p>');
  grid.querySelectorAll('.tpl-cat').forEach((b) => {
    b.onclick = () => { _pTplCat = b.dataset.cat; _renderTemplatePicker(grid, sel); };
  });
  grid.querySelectorAll('.pk-card').forEach((card) => {
    card.onclick = () => {
      sel.value = card.dataset.val;
      sel.dispatchEvent(new Event('change'));
      grid.querySelectorAll('.pk-card').forEach((c) => c.classList.toggle('active', c === card));
      if (typeof setupPosterPickers === 'function') setupPosterPickers();
    };
  });
}

/** Cards inline a partir das options de um <select> (Modelo/Formato). */
function _renderSelectCards(grid, sel, kind) {
  if (!grid || !sel) return;
  grid.innerHTML = Array.from(sel.options).map(o =>
    `<button type="button" class="pk-card ${o.value === sel.value ? 'active' : ''}" data-val="${escapeHtml(o.value)}">${_pickerSwatch(o.value, kind)}<span class="pk-card-label">${escapeHtml(o.textContent)}</span></button>`).join('');
  grid.querySelectorAll('.pk-card').forEach(card => {
    card.onclick = () => {
      sel.value = card.dataset.val;
      sel.dispatchEvent(new Event('change'));   // aciona o wiring existente (preview ao vivo)
      grid.querySelectorAll('.pk-card').forEach(c => c.classList.toggle('active', c === card));
      if (typeof setupPosterPickers === 'function') setupPosterPickers();   // sincroniza atalhos
    };
  });
}

function activateStyleSub(key) {
  activatePanelSub('colors', key);
}

/* ===========================================================================
 * SUBABAS DE PAINEL — o segundo nível de navegação do editor.
 *
 * No celular a metade de baixo da tela é tudo o que os controles têm. Um
 * painel que empilha Modelo + Headline + Ajuste + Categoria + Localização +
 * Subtítulo + Corpo numa coluna só obriga o usuário a rolar muito num espaço
 * curto — e rolagem vertical é justamente o que sobra menos.
 *
 * A aba Estilo já resolvia isso com uma barra de pílulas horizontal
 * (.style-subnav + .style-sub). Isto aqui é a MESMA mecânica, promovida a
 * genérica: qualquer .pedit-panel que declare uma .style-subnav ganha
 * subabas, sem código próprio. A memória do que estava aberto é POR GRUPO,
 * então voltar para uma aba devolve o usuário onde ele parou.
 * ==========================================================================*/

/** Sub-aba ativa por grupo do editor. `colors` começa em 'model' por herança
 *  do comportamento anterior; os demais caem na primeira sub-aba declarada. */
const _pSubByGroup = { colors: 'model' };

/** Alguns grupos precisam desenhar conteúdo só quando a sub-aba abre (grades
 *  pesadas de cards). Mantido como tabela para o controlador seguir genérico. */
const _pSubLazy = {
  colors: {
    model: () => _renderTemplatePicker($('#p-sub-model'), $('#p-template')),
    format: () => _renderSelectCards($('#p-sub-format'), $('#p-format'), 'format'),
    themes: () => _renderUnifiedThemeInto($('#p-sub-themes')),
  },
};

/** Ativa uma sub-aba dentro do painel do grupo.
 *
 *  Disponibilidade é EXPLÍCITA (`dataset.subOff`), não medida do layout: as
 *  grades de Modelo/Formato/Temas nascem vazias e só são preenchidas quando a
 *  sub-aba abre, então "está vazio agora" não significa "não se aplica" —
 *  medir escondia justamente as abas que ainda não tinham sido desenhadas.
 *  Quem sabe se um grupo se aplica é a lógica do app (ver updateExtraFields). */
function activatePanelSub(group, key) {
  const painel = document.querySelector(`.pedit-panel[data-pgroup="${group}"]`);
  if (!painel) return;
  const nav = painel.querySelector('.style-subnav');
  if (!nav) return;

  const subs = [...painel.querySelectorAll(':scope > .style-sub[data-sub]')];
  const disponiveis = [];
  subs.forEach((s) => {
    const ok = s.dataset.subOff !== '1';
    const btn = nav.querySelector(`button[data-sub="${s.dataset.sub}"]`);
    if (btn) btn.hidden = !ok;
    if (ok) disponiveis.push(s.dataset.sub);
  });
  if (!disponiveis.length) return;
  if (!disponiveis.includes(key)) key = disponiveis[0];

  _pSubByGroup[group] = key;
  nav.querySelectorAll('button[data-sub]').forEach(b => b.classList.toggle('active', b.dataset.sub === key));
  subs.forEach(s => s.classList.toggle('active', s.dataset.sub === key));
  const lazy = _pSubLazy[group] && _pSubLazy[group][key];
  if (typeof lazy === 'function') lazy();
  // A pílula ativa pode estar fora da janela do trilho rolável.
  const ativo = nav.querySelector('button.active');
  if (ativo && typeof ativo.scrollIntoView === 'function') {
    ativo.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

/** Liga TODAS as subabas do editor (idempotente — roda a cada render). */
function setupPanelSubnavs() {
  document.querySelectorAll('.pedit-panel .style-subnav').forEach((nav) => {
    const painel = nav.closest('.pedit-panel');
    const group = painel && painel.dataset.pgroup;
    if (!group) return;
    nav.querySelectorAll('button[data-sub]').forEach((b) => {
      b.onclick = () => activatePanelSub(group, b.dataset.sub);
    });
    const primeira = nav.querySelector('button[data-sub]');
    const lembrado = _pSubByGroup[group];
    const existe = lembrado && nav.querySelector(`button[data-sub="${lembrado}"]`);
    activatePanelSub(group, existe ? lembrado : (primeira && primeira.dataset.sub));
  });
}

function setupStyleSubnav() { setupPanelSubnavs(); }

/* ===========================================================================
 * NAVEGAÇÃO POR CATEGORIAS do editor — só o grupo ativo fica visível.
 * Os controles são os MESMOS (mesmos IDs/handlers); muda só a organização.
 * O grupo ativo persiste entre re-renders (variável de módulo).
 * ==========================================================================*/
let _pEditGroup = 'portal';   // r111: 'layout' (Modelo) foi fundido em Estilo
function setupPosterEditorTabs() {
  const tabs = document.querySelectorAll('#p-edit-tabs .pedit-tab');
  const panels = document.querySelectorAll('#p-editor .pedit-panel');
  if (!tabs.length) return;
  const activate = (g) => {
    if (g) _pEditGroup = g;
    if (typeof closePosterPicker === 'function') closePosterPicker();   // troca de categoria sai do picker
    tabs.forEach(t => t.classList.toggle('active', t.dataset.pgroup === _pEditGroup));
    panels.forEach(pa => pa.classList.toggle('active', pa.dataset.pgroup === _pEditGroup));
  };
  tabs.forEach(t => { t.onclick = () => {
    // Mobile: o painel da categoria é um SHEET sob demanda — tocar a categoria
    // ativa fecha; tocar outra troca. O canvas recalcula a escala para o
    // espaço restante (fitPosterPreview usa a altura real do container).
    const editor = $('#p-editor');
    // Refit imediato (leitura força reflow → medidas corretas) + RAF de reforço.
    const refit = () => {
      if (typeof fitPosterPreview !== 'function') return;
      fitPosterPreview();
      requestAnimationFrame(() => fitPosterPreview());
    };
    if (window.innerWidth <= 900 && editor) {
      if (editor.classList.contains('sheet-open') && _pEditGroup === t.dataset.pgroup) {
        editor.classList.remove('sheet-open');
        refit();
        return;
      }
      editor.classList.add('sheet-open');
      refit();
    }
    activate(t.dataset.pgroup);
  }; });
  // restaura o grupo salvo; se não existir mais, cai no primeiro
  const exists = [...tabs].some(t => t.dataset.pgroup === _pEditGroup);
  activate(exists ? _pEditGroup : (tabs[0] && tabs[0].dataset.pgroup));
}

/* ===========================================================================
 * IDENTIDADE VISUAL — controles do editor (paleta/cores/gradiente/fundo/presets).
 * Lê/escreve o objeto `p.custom` consumido por applyPosterCustom() no render.
 * ==========================================================================*/

// Mapa controle→chave de cor (a caixinha "-on" liga o override; sem ela, herda o tema).
const PC_COLOR_MAP = { bg: '#pc-bg', card: '#pc-card', accent: '#pc-accent', accent2: '#pc-accent2', text: '#pc-text', text2: '#pc-text2', border: '#pc-border' };

/** Lê os controles → objeto `custom` (ou undefined se nada foi personalizado). */
function readPosterCustom() {
  const val = sel => { const el = $(sel); return el ? el.value : ''; };
  const on = sel => { const el = $(sel); return !!(el && el.checked); };
  const colors = {};
  Object.keys(PC_COLOR_MAP).forEach(k => { if (on(PC_COLOR_MAP[k] + '-on')) colors[k] = val(PC_COLOR_MAP[k]); });
  const bg = val('#pb-type') || 'theme';
  const num = (sel, d) => { const n = parseInt(val(sel), 10); return Number.isFinite(n) ? n : d; };
  const custom = {
    palette: val('#p-palette') || '',
    font: val('#p-font') || '',
    colors,
    autoContrast: on('#pc-auto'),
    gradient: { from: val('#pg-from'), to: val('#pg-to'), angle: parseInt(val('#pg-angle'), 10) || 150 },
    useGradientAccent: on('#pg-accent'),
    bg,
    pattern: val('#pb-pattern') || 'dots',
    // opções do padrão gráfico — só quando o fundo é padrão (mantém o custom enxuto)
    patternOpts: bg === 'pattern' ? {
      c1: on('#pat-c1-on') ? val('#pat-c1') : undefined,
      c2: on('#pat-c2-on') ? val('#pat-c2') : undefined,
      alpha: num('#pat-alpha', 12) / 100,
      scale: num('#pat-scale', 100) / 100,
      angle: num('#pat-angle', 0),
      posX: num('#pat-px', 0),
      posY: num('#pat-py', 0),
    } : undefined,
  };
  const active = custom.palette || custom.font || Object.keys(colors).length || custom.useGradientAccent || (bg && bg !== 'theme');
  return active ? custom : undefined;
}

/** Escreve um objeto `custom` (ou null = limpar) de volta nos controles. */
function writeControlsFromCustom(c) {
  c = c || {};
  const set = (sel, v) => { const el = $(sel); if (el && v != null) el.value = v; };
  const chk = (sel, b) => { const el = $(sel); if (el) el.checked = !!b; };
  set('#p-palette', c.palette || '');
  set('#p-font', c.font || '');
  const cols = c.colors || {};
  Object.keys(PC_COLOR_MAP).forEach(k => { chk(PC_COLOR_MAP[k] + '-on', cols[k] != null); if (cols[k]) set(PC_COLOR_MAP[k], cols[k]); });
  chk('#pc-auto', c.autoContrast !== false);
  const g = c.gradient || {};
  if (g.from) set('#pg-from', g.from);
  if (g.to) set('#pg-to', g.to);
  set('#pg-angle', g.angle != null ? g.angle : 150);
  chk('#pg-accent', !!c.useGradientAccent);
  set('#pb-type', c.bg || 'theme');
  set('#pb-pattern', c.pattern || 'dots');
  // opções do padrão gráfico
  const po = c.patternOpts || {};
  chk('#pat-c1-on', po.c1 != null); if (po.c1) set('#pat-c1', po.c1);
  chk('#pat-c2-on', po.c2 != null); if (po.c2) set('#pat-c2', po.c2);
  set('#pat-alpha', po.alpha != null ? Math.round(po.alpha * 100) : patternDefaultAlpha(c.pattern));
  set('#pat-scale', po.scale != null ? Math.round(po.scale * 100) : 100);
  set('#pat-angle', po.angle != null ? po.angle : 0);
  set('#pat-px', po.posX != null ? po.posX : 0);
  set('#pat-py', po.posY != null ? po.posY : 0);
  const pf = $('#pb-pattern'); if (pf) pf.style.display = (c.bg === 'pattern') ? '' : 'none';
  const pc = $('#pat-controls'); if (pc) pc.style.display = (c.bg === 'pattern') ? '' : 'none';
}

/** Opacidade-padrão (0–100) de um padrão — usada como ponto de partida do slider. */
function patternDefaultAlpha(id) {
  const e = (typeof POSTER_PATTERNS !== 'undefined') && POSTER_PATTERNS[id];
  return e ? Math.round(e.a * 100) : 12;
}

function savePosterPresets() { saveJSON(STORAGE_KEYS.posterPresets, State.posterPresets || []); }

function refreshPosterPresetList(selName) {
  const lst = $('#pp-list');
  if (!lst) return;
  const list = Array.isArray(State.posterPresets) ? State.posterPresets : [];
  lst.innerHTML = '<option value="">— escolher preset —</option>' +
    list.map(x => `<option value="${escapeHtml(x.name)}">${escapeHtml(x.name)}</option>`).join('');
  if (selName) lst.value = selName;
}

/** Popula selects, carrega valores de p.custom e liga os handlers. `onChange`
 * persiste p.custom + re-renderiza (passado por renderPosterEditor). */
function setupPosterStyleControls(p, onChange) {
  const pal = $('#p-palette');
  if (pal && typeof POSTER_PALETTES !== 'undefined') {
    pal.innerHTML = '<option value="">Sem paleta (usar tema)</option>' +
      Object.entries(POSTER_PALETTES).map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`).join('');
  }
  const fontSel = $('#p-font');
  if (fontSel && typeof POSTER_FONTS !== 'undefined') {
    fontSel.innerHTML = '<option value="">Do tema</option>' +
      Object.entries(POSTER_FONTS).map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`).join('');
  }
  const gp = $('#pg-preset');
  if (gp && typeof POSTER_GRADIENTS !== 'undefined') {
    gp.innerHTML = '<option value="">Personalizado</option>' +
      Object.entries(POSTER_GRADIENTS).map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`).join('');
  }
  // Biblioteca de padrões gráficos — optgroups por categoria (data-driven: novos
  // padrões em POSTER_PATTERNS aparecem aqui sozinhos).
  const pbPat = $('#pb-pattern');
  if (pbPat && typeof POSTER_PATTERNS !== 'undefined' && typeof POSTER_PATTERN_CATS !== 'undefined') {
    pbPat.innerHTML = Object.entries(POSTER_PATTERN_CATS).map(([catKey, catLabel]) => {
      const items = Object.entries(POSTER_PATTERNS).filter(([, v]) => v.cat === catKey);
      if (!items.length) return '';
      return `<optgroup label="${escapeHtml(catLabel)}">` +
        items.map(([id, v]) => `<option value="${id}">${escapeHtml(v.label)}</option>`).join('') + '</optgroup>';
    }).join('');
  }
  refreshPosterPresetList();
  writeControlsFromCustom(p.custom);

  const fire = () => onChange();
  // Todos os controles de cor/gradiente/padrão/checagem disparam o mesmo onChange.
  ['#p-palette', '#p-font', '#pc-auto', '#pg-from', '#pg-to', '#pg-angle', '#pg-accent',
   '#pat-c1', '#pat-c2', '#pat-c1-on', '#pat-c2-on', '#pat-alpha', '#pat-scale', '#pat-angle', '#pat-px', '#pat-py']
    .concat(Object.values(PC_COLOR_MAP))
    .concat(Object.values(PC_COLOR_MAP).map(s => s + '-on'))
    .forEach(sel => { const el = $(sel); if (el) { el.oninput = fire; el.onchange = fire; } });

  // Gradiente pronto → preenche De/Até e dispara.
  if (gp) gp.onchange = () => {
    const g = (typeof POSTER_GRADIENTS !== 'undefined') ? POSTER_GRADIENTS[gp.value] : null;
    if (g) { const f = $('#pg-from'), t = $('#pg-to'); if (f) f.value = g.from; if (t) t.value = g.to; }
    fire();
  };
  // Trocar de PADRÃO → reseta a opacidade para o default afinado do novo padrão e dispara.
  const pbp = $('#pb-pattern');
  if (pbp) pbp.onchange = () => { const a = $('#pat-alpha'); if (a) a.value = patternDefaultAlpha(pbp.value); fire(); };
  // Tipo de fundo → mostra/oculta o seletor de padrão e os controles do padrão.
  const bt = $('#pb-type');
  if (bt) bt.onchange = () => {
    const isPat = bt.value === 'pattern';
    const pf = $('#pb-pattern'); if (pf) pf.style.display = isPat ? '' : 'none';
    const pc = $('#pat-controls'); if (pc) pc.style.display = isPat ? '' : 'none';
    if (isPat) { const a = $('#pat-alpha'); if (a) a.value = patternDefaultAlpha(pf ? pf.value : 'dots'); }
    if (typeof _syncPickerRow === 'function') _syncPickerRow('pb-pattern');   // a linha do picker acompanha
    fire();
  };
  // Limpar personalização.
  const rs = $('#pc-reset');
  if (rs) rs.onclick = () => { writeControlsFromCustom(null); fire(); toast('Personalização removida — voltou ao tema.', 'success'); };

  // Presets: salvar / aplicar / excluir.
  const sv = $('#pp-save');
  if (sv) sv.onclick = () => {
    const cur = readPosterCustom();
    if (!cur) { toast('Nada para salvar — personalize alguma cor antes.', 'info'); return; }
    const name = (prompt('Nome do preset (ex.: Meu Portal, Política, Esportes):') || '').trim();
    if (!name) return;
    if (!Array.isArray(State.posterPresets)) State.posterPresets = [];
    const ix = State.posterPresets.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
    const entry = { name, custom: cur };
    if (ix >= 0) State.posterPresets[ix] = entry; else State.posterPresets.push(entry);
    savePosterPresets();
    refreshPosterPresetList(name);
    toast('Preset salvo.', 'success');
  };
  const lst = $('#pp-list');
  if (lst) lst.onchange = () => {
    const e = (State.posterPresets || []).find(x => x.name === lst.value);
    if (e) { writeControlsFromCustom(e.custom); fire(); toast(`Preset "${e.name}" aplicado.`, 'success'); }
  };
  const del = $('#pp-del');
  if (del) del.onclick = () => {
    const cur = $('#pp-list');
    if (!cur || !cur.value) { toast('Escolha um preset para excluir.', 'info'); return; }
    State.posterPresets = (State.posterPresets || []).filter(x => x.name !== cur.value);
    savePosterPresets();
    refreshPosterPresetList();
    toast('Preset excluído.', 'success');
  };
}

/**
 * Configura um uploader de mídia (clique para escolher arquivo,
 * lê como base64 e salva no objeto poster).
 */
/* ===== Reordenar mídias por arrastar-e-soltar (r103) =====
 * As imagens 1..4 trocam de posição arrastando a miniatura (mouse ou toque).
 * A imagem viaja com TODOS os seus metadados (enquadramento posX/posY/scale e
 * o estado ativado/desativado em imagesOff). */
function reorderPosterImages(from, to) {
  const p = State.posters.find(x => x.id === State.activePosterId);
  if (!p) return;
  const s = (typeof getSlide === 'function') ? getSlide(p) : p;
  const off = new Set(Array.isArray(s.imagesOff) ? s.imagesOff : []);
  const tuple = (i) => ({
    img: s[`image${i + 1}`],
    px: s[`image${i + 1}PosX`],
    py: s[`image${i + 1}PosY`],
    sc: s[`image${i + 1}Scale`],
    off: off.has(`image${i + 1}`),
  });
  const arr = [0, 1, 2, 3].map(tuple);
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved);
  arr.forEach((o, i) => {
    s[`image${i + 1}`] = o.img;
    s[`image${i + 1}PosX`] = o.px;
    s[`image${i + 1}PosY`] = o.py;
    s[`image${i + 1}Scale`] = o.sc;
  });
  s.imagesOff = arr.map((o, i) => (o.off ? `image${i + 1}` : null)).filter(Boolean);
  p.updatedAt = new Date().toISOString();
  savePosters();
  renderPosterEditor();   // re-popula miniaturas + preview na nova ordem
}

/** Wiring DELEGADO no host .media-uploads (uma vez): setupMediaUpload CLONA os
 *  tiles a cada render (para limpar handlers) — listeners diretos morreriam.
 *  Toque: touch-action pan-y nas miniaturas (CSS) mantém o scroll vertical;
 *  o arraste do reorder é essencialmente horizontal (grade de 1 linha). */
function setupMediaReorder() {
  const host = document.querySelector('.media-uploads');
  if (!host || host._reorderWired) return;
  host._reorderWired = true;
  // Cinto e suspensório contra o drag NATIVO (ghost de imagem) — ele cancelaria
  // os pointer events do reorder em arrastes reais de mouse.
  host.addEventListener('dragstart', (e) => e.preventDefault(), true);
  const slotAt = (el) => {
    const t = el && el.closest ? el.closest('.media-upload[id^="p-image"]') : null;
    if (!t) return null;
    const m = t.id.match(/^p-image(\d)-upload$/);
    return m ? { idx: +m[1] - 1, tile: t } : null;
  };
  // Após um arraste, o click subsequente NÃO deve abrir o seletor de arquivo
  host.addEventListener('click', (e) => {
    if (host._justDragged) {
      host._justDragged = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  host.addEventListener('pointerdown', (e) => {
    const src = slotAt(e.target);
    if (!src) return;
    // Só reordena slots COM imagem (vazio segue abrindo o upload no click)
    const p = State.posters.find(x => x.id === State.activePosterId);
    const s = p && ((typeof getSlide === 'function') ? getSlide(p) : p);
    if (!s || !s[`image${src.idx + 1}`]) return;
    const startX = e.clientX, startY = e.clientY;
    let dragging = false, target = null;
    const clearTarget = () => { if (target) { target.tile.classList.remove('drop-target'); target = null; } };
    const onMove = (ev) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) return;
        dragging = true;
        src.tile.classList.add('dragging');
        try { src.tile.setPointerCapture(ev.pointerId); } catch (_) {}
      }
      ev.preventDefault();
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const hit = slotAt(under);
      clearTarget();
      if (hit && hit.idx !== src.idx) {
        target = hit;
        hit.tile.classList.add('drop-target');
      }
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      src.tile.classList.remove('dragging');
      const dest = target ? target.idx : null;
      clearTarget();
      if (dragging) {
        host._justDragged = true;
        setTimeout(() => { host._justDragged = false; }, 250);
        if (dest != null) reorderPosterImages(src.idx, dest);
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
}

function setupMediaUpload(poster, field, idPrefix, onChange) {
  let wrap = $(`#${idPrefix}-upload`);
  let input = $(`#${idPrefix}-file`);
  let preview = $(`#${idPrefix}-preview`);
  let clearBtn = $(`#${idPrefix}-clear`);
  if (!wrap || !input || !preview || !clearBtn) return;

  const refresh = () => {
    const value = poster[field];
    // Só data-URLs de imagem (vêm do FileReader) — nunca injetar outra string como src.
    if (value && /^data:image\//.test(String(value))) {
      preview.innerHTML = '';
      const img = document.createElement('img');
      img.src = value;
      img.alt = '';
      // CRÍTICO p/ o reorder: o drag NATIVO de <img> do navegador cancela os
      // pointer events (pointercancel) — sem isto, arrastar a miniatura com o
      // mouse dispara o ghost nativo e o arrastar-e-soltar nunca acontece.
      img.draggable = false;
      preview.appendChild(img);
      clearBtn.classList.remove('hidden');
    } else {
      preview.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>`;
      clearBtn.classList.add('hidden');
    }
  };
  refresh();

  // Clonar para limpar handlers anteriores
  const newWrap = wrap.cloneNode(true);
  wrap.parentNode.replaceChild(newWrap, wrap);

  // Re-resgatar referências (depois do replace)
  wrap = $(`#${idPrefix}-upload`);
  input = $(`#${idPrefix}-file`);
  preview = $(`#${idPrefix}-preview`);
  clearBtn = $(`#${idPrefix}-clear`);
  refresh();

  wrap.addEventListener('click', (e) => {
    if (e.target.closest(`#${idPrefix}-clear`) || e.target.closest(`#${idPrefix}-toggle`)) return;
    input.click();
  });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Apenas imagens são aceitas.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('A imagem é muito grande (máximo 10 MB).', 'error');
      return;
    }
    try {
      const base64 = await fileToBase64Compressed(file);
      poster[field] = base64;
      poster.updatedAt = new Date().toISOString();
      savePosters();
      refresh();
      renderPosterTemplate(poster);
      if (onChange) onChange();
      toast('Imagem adicionada.', 'success');
    } catch (err) {
      toast('Não foi possível ler a imagem: ' + err.message, 'error');
    }
    input.value = '';
  });

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    poster[field] = null;
    // ao apagar, tira o slot de imagesOff (não fica "desativado fantasma")
    if (Array.isArray(poster.imagesOff)) poster.imagesOff = poster.imagesOff.filter(k => k !== field);
    poster.updatedAt = new Date().toISOString();
    savePosters();
    refresh();
    renderPosterTemplate(poster);
    if (onChange) onChange();
    toast('Imagem removida.', 'success');
  });
}

/**
 * Os 4 uploaders de imagem ficam SEMPRE visíveis — as miniaturas não somem ao
 * trocar de modelo, limpar um slot ou trocar de slide. O usuário sobe cada
 * imagem uma vez e liga/desliga quais usar via o toggle de cada miniatura
 * (refreshImageToggles), sem precisar apagar/reenviar.
 */
function updateProgressiveVisibility() {
  ['p-image2-upload', 'p-image3-upload', 'p-image4-upload'].forEach(id => {
    const el = $(`#${id}`); if (el) el.style.display = '';
  });
  refreshImageToggles();
}

/**
 * Sincroniza o estado ATIVO/INATIVO de cada miniatura de imagem:
 * - botão de toggle (olho) visível só quando o slot tem imagem;
 * - `.is-off` (esmaecida) quando a imagem está em `s.imagesOff` (desativada).
 */
function refreshImageToggles() {
  const p = State.posters.find(x => x.id === State.activePosterId);
  if (!p) return;
  const s = (typeof getSlide === 'function') ? getSlide(p) : p;
  const off = Array.isArray(s.imagesOff) ? s.imagesOff : [];
  ['image1', 'image2', 'image3', 'image4'].forEach(key => {
    const idx = key.slice(5);
    const wrap = $(`#p-image${idx}-upload`);
    const toggle = $(`#p-image${idx}-toggle`);
    if (!wrap) return;
    const has = !!s[key];
    const isOff = off.includes(key);
    wrap.classList.toggle('is-off', has && isOff);
    if (toggle) {
      toggle.classList.toggle('hidden', !has);
      toggle.classList.toggle('off', isOff);
      toggle.setAttribute('aria-pressed', String(!isOff));
      toggle.title = isOff ? 'Ativar imagem neste cartaz' : 'Desativar (sem apagar)';
    }
  });
}

/**
 * Lê uma imagem do disco, redimensiona para no máximo 1200px no maior lado
 * e devolve como dataURL (JPEG quality 0.85). Isso reduz drasticamente o
 * tamanho que vai para o localStorage.
 */
function fileToBase64Compressed(file, maxDimension = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
          } else {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // Mantém PNG se a imagem original era PNG (preserva transparência)
        const isPng = file.type === 'image/png';
        const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

// Manchete — usa o layout "front page" tplManchete2 (definido em poster-templates.js).
function tplManchete(p, fmt, portal) { return tplManchete2(p, fmt, portal); }
/* Layout anterior da manchete — INERTE, mantido apenas como referência histórica:
  const logoHtml = posterLogoBlock(portal, 160);

  const px1 = p.image1PosX ?? 50;
  const py1 = p.image1PosY ?? 50;
  const px2 = p.image2PosX ?? 50;
  const py2 = p.image2PosY ?? 50;
  const px3 = p.image3PosX ?? 50;
  const py3 = p.image3PosY ?? 50;
  const px4 = p.image4PosX ?? 50;
  const py4 = p.image4PosY ?? 50;
  const sc1 = p.image1Scale ?? 1;
  const sc2 = p.image2Scale ?? 1;
  const sc3 = p.image3Scale ?? 1;
  const sc4 = p.image4Scale ?? 1;

  // Imagem 1 (wrapper separado para zoom, img para pan via object-position)
  const img1Html = p.image1
    ? `<div data-zoomscale="${sc1}" style="width: 100%; height: 100%; transform: scale(${sc1}); transform-origin: center center; display: flex; align-items: center; justify-content: center;">
        <img src="${p.image1}" data-draggable="image1" data-posx="${px1}" data-posy="${py1}" data-scale="${sc1}" style="width: 100%; height: 100%; object-fit: cover; object-position: ${px1}% ${py1}%; cursor: grab; display: block; user-select: none; -webkit-user-drag: none; touch-action: none;" alt="" crossorigin="anonymous" />
       </div>`
    : `<div style="width: 100%; height: 100%; background: #f0ece4; display: flex; align-items: center; justify-content: center; color: #b8b1a3; font-family: 'IBM Plex Sans', sans-serif; font-size: 22px; font-weight: 500; letter-spacing: 0.05em;">
         <div style="text-align: center;">
           <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 10px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
           <div>imagem 1</div>
         </div>
       </div>`;

  // Imagem 2 (wrapper separado para zoom, img para pan via object-position)
  const img2Html = p.image2
    ? `<div data-zoomscale="${sc2}" style="width: 100%; height: 100%; transform: scale(${sc2}); transform-origin: center center; display: flex; align-items: center; justify-content: center;">
        <img src="${p.image2}" data-draggable="image2" data-posx="${px2}" data-posy="${py2}" data-scale="${sc2}" style="width: 100%; height: 100%; object-fit: cover; object-position: ${px2}% ${py2}%; cursor: grab; display: block; user-select: none; -webkit-user-drag: none; touch-action: none;" alt="" crossorigin="anonymous" />
       </div>`
    : `<div style="width: 100%; height: 100%; background: #e8e3d8; display: flex; align-items: center; justify-content: center; color: #b8b1a3; font-family: 'IBM Plex Sans', sans-serif; font-size: 22px; font-weight: 500; letter-spacing: 0.05em;">
         <div style="text-align: center;">
           <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 10px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
           <div>imagem 2</div>
         </div>
       </div>`;

  // Imagem 3
  const img3Html = p.image3
    ? `<div data-zoomscale="${sc3}" style="width: 100%; height: 100%; transform: scale(${sc3}); transform-origin: center center; display: flex; align-items: center; justify-content: center;">
        <img src="${p.image3}" data-draggable="image3" data-posx="${px3}" data-posy="${py3}" data-scale="${sc3}" style="width: 100%; height: 100%; object-fit: cover; object-position: ${px3}% ${py3}%; cursor: grab; display: block; user-select: none; -webkit-user-drag: none; touch-action: none;" alt="" crossorigin="anonymous" />
       </div>`
    : '';

  // Imagem 4
  const img4Html = p.image4
    ? `<div data-zoomscale="${sc4}" style="width: 100%; height: 100%; transform: scale(${sc4}); transform-origin: center center; display: flex; align-items: center; justify-content: center;">
        <img src="${p.image4}" data-draggable="image4" data-posx="${px4}" data-posy="${py4}" data-scale="${sc4}" style="width: 100%; height: 100%; object-fit: cover; object-position: ${px4}% ${py4}%; cursor: grab; display: block; user-select: none; -webkit-user-drag: none; touch-action: none;" alt="" crossorigin="anonymous" />
       </div>`
    : '';

  // Avatar centralizado entre as imagens (overlay) — moldura creme premium.
  // SEM box-shadow: o html2canvas não a pinta (vira mancha cinza no PNG) e o
  // avatar saía diferente do preview. A borda creme já o destaca do fundo.
  const avatarOverlayHtml = p.avatar
    ? `<img src="${p.avatar}" style="width: 130px; height: 130px; border-radius: 50%; object-fit: cover; display: block; border: 5px solid #F5F0E7;" alt="" crossorigin="anonymous" />`
    : `<div style="width: 130px; height: 130px; border-radius: 50%; background: #17130D; color: #F5F0E7; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 900; font-size: 48px; border: 5px solid #F5F0E7;">
         ${escapeHtml(portal.acronym || 'PT')}
       </div>`;

  // Calcula tamanho de fonte adaptativo do título (varia conforme o tamanho do texto)
  const headlineText = p.headline || 'Título principal';
  const headlineFontSize = computeHeadlineFontSize(headlineText);
  const hasImg = [p.image1, p.image2, p.image3, p.image4].filter(Boolean).length > 0;

  return `
    <div class="poster-1440" style="
      width: ${fmt.w}px; height: ${fmt.h}px; background: #F7F3EC;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      color: #17130D;
      position: relative; overflow: hidden;
      display: flex; flex-direction: column;
      box-sizing: border-box;
    ">

      <!-- ═══════════════════════════════════════════════════
           ZONA 1 — Cabeçalho (220px fixo)
           ═══════════════════════════════════════════════════ -->
      <div style="
        height: 220px;
        flex-shrink: 0;
        display: flex; align-items: center;
        padding: 36px 56px 22px;
        gap: 26px;
        overflow: hidden;
      ">
        <div style="flex-shrink: 0;">
          ${logoHtml}
        </div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
          <div style="
            font-family: 'Fraunces', serif;
            font-size: 50px; font-weight: 700; line-height: 1.08; letter-spacing: -0.02em;
            color: #17130D;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
          ">${escapeHtml(portal.name || 'Nome do projeto')}</div>
          ${portal.tagline ? `<div style="
            font-family: 'IBM Plex Sans', sans-serif;
            font-size: 24px; font-weight: 400; line-height: 1.3;
            color: #857A67;
            margin-top: 7px;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          ">${escapeHtml(portal.tagline)}</div>` : ''}
        </div>
      </div>

      <!-- Hairline -->
      <div style="height: 1.5px; background: #E4DCCB; margin: 0 56px; flex-shrink: 0;"></div>

      <!-- ═══════════════════════════════════════════════════
           ZONA 2 — Conteúdo (500px fixo)
           ═══════════════════════════════════════════════════ -->
      <div style="
        height: 500px;
        flex-shrink: 0;
        display: flex; flex-direction: column;
        padding: 38px 56px 26px;
        overflow: hidden;
      ">

        <!-- Kicker (eyebrow) com a categoria -->
        <div style="margin-bottom: 26px; flex-shrink: 0;">${posterKicker(p.category)}</div>

        <!-- Título — máx 3 linhas -->
        <h1 style="
          font-family: 'Oswald', sans-serif;
          text-transform: uppercase;
          font-size: ${headlineFontSize}px;
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -0.01em;
          color: #17130D;
          margin: 0 0 22px 0;
          flex-shrink: 0;
          max-height: 330px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          word-wrap: break-word;
        ">${escapeHtml(headlineText)}</h1>

        <!-- Subtítulo — serifada itálica, clamp em 3 linhas -->
        ${p.subtitle ? `
        <p style="
          font-family: 'Fraunces', serif;
          font-style: italic;
          font-size: 33px; font-weight: 500; line-height: 1.32;
          color: #3C352A;
          letter-spacing: -0.005em;
          margin: 0;
          flex-shrink: 0;
          max-height: 150px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          text-overflow: ellipsis;
          word-wrap: break-word;
        ">${escapeHtml(p.subtitle)}</p>` : ''}

      </div>

      <!-- ═══════════════════════════════════════════════════
           ZONA 3 — Mídia (flex: 1 — ocupa todo o espaço restante)
           ═══════════════════════════════════════════════════ -->
      ${(() => {
        const imgs = [p.image1, p.image2, p.image3, p.image4];
        const count = imgs.filter(Boolean).length;
        const colWidth = count > 0 ? (100 / count) + '%' : '0';
        const imgHtmls = [img1Html, img2Html, img3Html, img4Html];
        const cells = imgs.map((img, i) =>
          img
            ? `<div style="width: ${colWidth}; height: 100%; overflow: hidden;">${imgHtmls[i]}</div>`
            : ''
        ).join('');
        return `
      <div style="
        flex: 1;
        min-height: 0;
        position: relative;
        display: flex;
        flex-direction: row;
        padding: 0 56px 56px;
      ">
        ${cells}`})()}

        <!-- Scrim inferior sobre as imagens (legibilidade dos overlays) -->
        ${hasImg ? `<div style="position: absolute; left: 56px; right: 56px; bottom: 56px; height: 156px; background: linear-gradient(to top, rgba(15,12,8,0.82) 0%, rgba(15,12,8,0) 100%); pointer-events: none;"></div>` : ''}

        <!-- Overlay: localização (top-left) -->
        ${p.location ? `<div style="position: absolute; top: 0; left: 56px; max-width: calc(100% - 112px);">${posterLocationPill(p.location, false)}</div>` : ''}

        ${(() => {
          const singleImg = [p.image1, p.image2, p.image3, p.image4].filter(Boolean).length === 1;
          return singleImg
            ? `<div style="position: absolute; top: 16px; right: 70px; z-index: 5; border-radius: 50%; overflow: hidden;">
                 ${avatarOverlayHtml}
               </div>`
            : `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 5;">
                 ${avatarOverlayHtml}
               </div>`
        })()}

        <!-- Overlay: meta inferior (handle + nome do portal) -->
        <div style="
          position: absolute;
          left: 56px; right: 56px; bottom: 66px;
          z-index: 4;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        ">
          <span style="font-family: 'IBM Plex Sans', sans-serif; font-size: 23px; font-weight: 600; letter-spacing: 0.02em; color: ${hasImg ? '#ffffff' : '#17130D'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(portal.handle || '@portal')}</span>
          <span style="font-family: 'Fraunces', serif; font-weight: 700; font-size: 24px; color: ${hasImg ? 'rgba(245,240,231,0.92)' : '#857A67'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 50%;">${escapeHtml(portal.name || '')}</span>
        </div>
      </div>
    </div>
  `;
}
*/

/** O modelo pertence à família "Redes sociais" (composição em área segura)? */
function posterEhModeloDeRede(tplId) {
  const t = (typeof POSTER_TEMPLATES !== 'undefined') && POSTER_TEMPLATES[tplId];
  return !!(t && t.cat === 'redes');
}

/** Formato (dimensões) do cartaz/slide ativo (em carrossel, o do slide visível). */
function posterActiveFormat() {
  const p = State.posters.find(x => x.id === State.activePosterId);
  const src = (p && typeof getSlide === 'function') ? getSlide(p) : p;
  const f = (src && typeof POSTER_FORMATS !== 'undefined' && POSTER_FORMATS[src.format]);
  return f || { w: 1080, h: 1440 };
}

/* ==========================================================================
 * ADAPTAÇÃO À ÁREA SEGURA — vale para a BIBLIOTECA INTEIRA (r189).
 *
 * A família "Redes sociais" nasce composta dentro da área útil. Os outros 60
 * modelos, não: uma auditoria com layout real mostrou que 60 de 66 deixavam
 * texto sob as faixas do aplicativo, quase sempre o rodapé (@ e local), que os
 * modelos encostam na base — exatamente onde a legenda do Reels começa.
 *
 * Reescrever 60 modelos à mão destruiria a identidade de cada um e seria
 * impossível de manter. Em vez disso a adaptação acontece em UM lugar, sobre o
 * DOM já montado, e faz só duas coisas:
 *
 *   1. Aumenta o PADDING do nó raiz até a margem segura. Como os modelos põem
 *      o conteúdo em fluxo (flex column), tudo desliza para dentro sem que a
 *      composição mude de natureza. O fundo NÃO se mexe: `position:absolute;
 *      inset:0` se resolve contra a caixa de padding, então foto e gradiente
 *      seguem sangrando o cartaz inteiro — que é o que se quer.
 *
 *   2. Empurra para dentro os blocos de texto POSICIONADOS EM ABSOLUTO, que o
 *      padding não alcança (faixas sobre foto, selos, tarjas). Move só o que
 *      carrega informação: decoração translúcida e marca-d'água ficam onde
 *      estão, porque sangrar é a função delas.
 *
 * Nada disso roda sem o usuário escolher uma plataforma: o padrão é 'livre'.
 * ========================================================================== */

/** Um nó é decoração (pode sangrar) em vez de informação (precisa caber)? */
function _safeEhDecoracao(el) {
  const cs = getComputedStyle(el);
  if (cs.pointerEvents === 'none') return true;            // convenção do próprio catálogo
  const m = /rgba?\(([^)]+)\)/.exec(cs.color || '');
  if (m) {
    const partes = m[1].split(',').map((x) => parseFloat(x));
    if (partes.length >= 4 && partes[3] < 0.35) return true;   // marca-d'água / número fantasma
  }
  return (cs.opacity !== '' && parseFloat(cs.opacity) < 0.35);
}

/** Blocos absolutos mais externos que carregam texto visível. */
function _safeBlocosAbsolutos(raiz) {
  const out = [];
  const anda = (el) => {
    for (const ch of el.children) {
      const cs = getComputedStyle(ch);
      if (cs.position === 'absolute' || cs.position === 'fixed') {
        // Não desce: os filhos acompanham o pai quando ele for deslocado.
        if ((ch.textContent || '').trim() && !_safeEhDecoracao(ch)) out.push(ch);
      } else {
        anda(ch);
      }
    }
  };
  anda(raiz);
  return out;
}

/** Etapa 1 — respiro em fluxo. Roda ANTES da composição tipográfica, que
 *  precisa medir a caixa final para achar o corpo de fonte que cabe. */
function posterAdaptarAreaSegura(raiz, p, fmt) {
  if (!raiz || typeof ptSafeAtiva !== 'function' || !ptSafeAtiva(p, fmt)) return;
  if (typeof posterEhModeloDeRede === 'function' && posterEhModeloDeRede(p.template)) return;
  const r = ptSafeRect(p, fmt);
  const cs = getComputedStyle(raiz);
  const atual = (lado) => parseFloat(cs['padding' + lado]) || 0;
  raiz.style.paddingTop = Math.max(atual('Top'), r.top) + 'px';
  raiz.style.paddingBottom = Math.max(atual('Bottom'), r.bottom) + 'px';
  raiz.style.paddingLeft = Math.max(atual('Left'), r.left) + 'px';
  raiz.style.paddingRight = Math.max(atual('Right'), r.right) + 'px';
  raiz.dataset.safeArea = p.safeZone || '';
}

/** Etapa 2 — o que o padrão do fluxo não alcança. Roda DEPOIS do typeset, com
 *  o texto no tamanho final: é a caixa real que decide quanto mover e encolher.
 *
 *  A auditoria mostrou três causas distintas de vazamento, e todas caem aqui:
 *    a) bloco absoluto posicionado sobre a foto (faixa, selo, tarja);
 *    b) bloco absoluto MAIS LARGO que a área útil — deslocar não adianta, e sem
 *       limitar a largura ele sempre sobra do lado direito;
 *    c) linha em fluxo que não encolhe (flex com colunas de largura mínima),
 *       estourando a caixa já reduzida pelo padding.
 *  Para (b) e (c) a correção é a mesma: limitar a largura ao que sobra. O texto
 *  reflui, que é o comportamento natural do modelo em telas estreitas. */
function posterAjustarBlocosSeguros(raiz, p, fmt) {
  if (!raiz || typeof ptSafeAtiva !== 'function' || !ptSafeAtiva(p, fmt)) return 0;
  if (typeof posterEhModeloDeRede === 'function' && posterEhModeloDeRede(p.template)) return 0;
  const r = ptSafeRect(p, fmt);
  const rb = raiz.getBoundingClientRect();
  if (!rb.width) return 0;
  const k = rb.width / fmt.w;              // o preview é escalado; medir em px do cartaz
  const limiteDir = fmt.w - r.right;
  let n = 0;

  // IDEMPOTÊNCIA: a etapa roda duas vezes (antes e depois da recomposição
  // tipográfica). Sem desfazer o ajuste anterior, o segundo passe somaria outra
  // translação sobre a primeira e o bloco sairia do outro lado.
  raiz.querySelectorAll('[data-safe-clamp]').forEach((el) => {
    el.style.maxWidth = ''; el.style.minWidth = '';
    delete el.dataset.safeClamp;
  });
  raiz.querySelectorAll('[data-safe-shift]').forEach((el) => {
    el.style.transform = el.dataset.safeT0 || '';
    delete el.dataset.safeShift;
  });

  // (a) e (b) — blocos absolutos com informação.
  _safeBlocosAbsolutos(raiz).forEach((el) => {
    const bb = el.getBoundingClientRect();
    if (!bb.width || !bb.height) return;
    const topo = (bb.top - rb.top) / k, esq = (bb.left - rb.left) / k;
    const alt = bb.height / k, larg = bb.width / k;
    // Largura primeiro: um bloco mais largo que a área útil não tem para onde
    // ser empurrado — encolhe e o texto se reacomoda.
    if (larg > r.w + 1) {
      el.style.maxWidth = Math.round(r.w) + 'px';
      el.dataset.safeClamp = '1';
      n++;
    }
    let dy = 0, dx = 0;
    if (topo < r.top) dy = r.top - topo;
    else if (topo + alt > fmt.h - r.bottom) dy = -((topo + alt) - (fmt.h - r.bottom));
    const largFinal = Math.min(larg, r.w);
    if (esq < r.left) dx = r.left - esq;
    else if (esq + largFinal > limiteDir) dx = -((esq + largFinal) - limiteDir);
    // Bloco mais alto que a faixa útil: prioriza o começo do texto, que é o que
    // carrega a informação — descer para caber cortaria o título.
    if (topo + dy < r.top) dy = r.top - topo;
    if (esq + dx < r.left) dx = r.left - esq;
    if (!dx && !dy) return;
    if (el.dataset.safeT0 === undefined) el.dataset.safeT0 = el.style.transform || '';
    el.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px) ${el.dataset.safeT0}`.trim();
    el.dataset.safeShift = '1';
    n++;
  });

  // (c) — quem está em fluxo e mesmo assim estoura à direita. Limita o nó mais
  // EXTERNO que vaza: encolher o pai reacomoda os filhos de uma vez.
  const anda = (el) => {
    for (const ch of el.children) {
      const cs = getComputedStyle(ch);
      if (cs.position === 'absolute' || cs.position === 'fixed') continue;   // já tratado acima
      const bb = ch.getBoundingClientRect();
      if (!bb.width) continue;
      const esq = (bb.left - rb.left) / k;
      const dir = (bb.right - rb.left) / k;
      if (dir > limiteDir + 1 && (ch.textContent || '').trim() && !_safeEhDecoracao(ch)) {
        ch.style.maxWidth = Math.max(40, Math.round(limiteDir - esq)) + 'px';
        ch.style.minWidth = '0';           // sem isto, item de flex não encolhe
        ch.dataset.safeClamp = '1';
        n++;
      } else {
        anda(ch);
      }
    }
  };
  anda(raiz);
  return n;
}

/** Renderiza o cartaz escolhendo template + formato (delega ao catálogo). */
function renderPosterTemplate(p) {
  const portal = { ...(p.portalSnapshot || {}), ...(State.portals[State.activePortalIndex] || State.portals[0] || {}) };
  const fmt = (typeof POSTER_FORMATS !== 'undefined' && POSTER_FORMATS[p.format]) || { w: 1080, h: 1440 };
  const reg = (typeof POSTER_TEMPLATES !== 'undefined') ? POSTER_TEMPLATES : null;
  const tpl = (reg && reg[p.template]) || (reg && reg.manchete);
  if (typeof applyTheme === 'function') applyTheme(p.theme || portal.theme);   // tema do cartaz (override) ou do portal
  if (typeof applyPosterCustom === 'function') applyPosterCustom(p.custom);    // identidade visual (paleta/cores/gradiente) por cima do tema
  if (typeof setPosterHidden === 'function') setPosterHidden(p);   // elementos ocultos (olho) ativos neste render
  // r103: dedupe de marca em 2 passadas ("o de baixo vence") quando disponível.
  $('#p-stage').innerHTML = tpl
    ? (typeof renderTemplateDeduped === 'function'
        ? renderTemplateDeduped(() => tpl.render(p, fmt, portal))
        : tpl.render(p, fmt, portal))
    : tplManchete(p, fmt, portal);
  if (typeof applyPosterRootBg === 'function') applyPosterRootBg(p.custom, $('#p-stage'), fmt);   // fundo custom (sólido/gradiente/padrão) no nó raiz
  // ÁREA SEGURA (r189): respiro em fluxo antes do typeset — ele mede a caixa
  // final para escolher o corpo de fonte, então precisa da caixa já encolhida.
  posterAdaptarAreaSegura($('#p-stage').querySelector('.poster-1440'), p, fmt);
  // COMPOSIÇÃO TIPOGRÁFICA (r165): mede o título/subtítulo no DOM já montado e
  // acha o corpo de fonte que realmente cabe, com quebras equilibradas. Roda
  // ANTES de escalar o preview — o fit precisa das medidas em escala 1:1.
  if (typeof typesetPoster === 'function') typesetPoster(p, $('#p-stage'));
  // ÁREA SEGURA, etapa 2: com o texto no tamanho final, empurra para dentro os
  // blocos absolutos (faixas sobre foto, selos) que o padding não alcança e
  // limita a largura do que ainda estoura.
  const _raizSegura = $('#p-stage').querySelector('.poster-1440');
  if (posterAjustarBlocosSeguros(_raizSegura, p, fmt)) {
    // Encolher uma caixa invalida a composição que acabou de ser calculada para
    // a largura antiga — sem recompor, o título vinha truncado com reticências.
    // Recompõe na caixa final e reajusta (a etapa é idempotente).
    if (typeof typesetPoster === 'function') typesetPoster(p, $('#p-stage'));
    posterAjustarBlocosSeguros(_raizSegura, p, fmt);
  }
  fitPosterPreview();
  applyAllImageTransforms($('#p-stage'));
  // OVERLAYS unificados (r116): elementos livres + avatar + camadas de imagem numa
  // ÚNICA hierarquia de z-order, no MESMO stacking context — o usuário controla a
  // ordem de qualquer objeto entre si. Interações do editor reatam a cada render
  // (elementos ficam editáveis em QUALQUER aba, não só na aba Elementos).
  if (typeof renderPosterOverlays === 'function') renderPosterOverlays(p, fmt);
}

/** Núcleo de ARRASTE de overlay (r107, compartilhado por avatar e camadas): mouse
 *  OU toque; converte o delta de tela → % do formato (÷ escala do stage); snap com
 *  LINHAS-GUIA (.pe-guides, escondidas no export) no centro (50%) e margens (8/92).
 *  getBase() → {x,y} iniciais; commit(x,y) persiste ao soltar.
 *  pinchOpts (opcional, r118): habilita PINÇA de 2 dedos p/ "zoom" (escala) direto
 *  na camada, sem precisar tocar na alça — { min, max, getScale(), onScale(sc)
 *  (visual, a cada movimento), onScaleCommit(sc) (persiste ao soltar) }. Rastreia
 *  ponteiros por pointerId (Map) para não misturar coordenadas de dois dedos: com
 *  1 ponteiro ativo é arraste normal; ao pousar o 2º (com pinchOpts), o gesto vira
 *  pinça e o arraste em curso é cancelado sem persistir posição.*/
function _overlayDrag(el, rootEl, fmt, getBase, commit, pinchOpts) {
  const SNAPS = [8, 50, 92];
  const TOL = 1.6;
  const mkGuide = (axis, pct) => {
    const g = document.createElement('div');
    g.className = 'pe-guides';
    g.style.cssText = axis === 'v'
      ? `position:absolute;top:0;bottom:0;left:${pct}%;width:0;border-left:3px dashed rgba(207,52,24,0.9);z-index:60;pointer-events:none;`
      : `position:absolute;left:0;right:0;top:${pct}%;height:0;border-top:3px dashed rgba(207,52,24,0.9);z-index:60;pointer-events:none;`;
    rootEl.appendChild(g);
    return g;
  };
  let gv = null, gh = null;
  const clearGuides = () => { if (gv) gv.remove(); if (gh) gh.remove(); gv = gh = null; };

  const pointers = new Map();   // pointerId -> {x,y} — todos os ponteiros ativos sobre o overlay
  let moveState = null;         // arraste (mover) em curso
  let pinchState = null;        // pinça (escala) em curso
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const beginMove = (e) => {
    const stage = $('#p-stage');
    let scale = 1;
    try { scale = (new DOMMatrixReadOnly(getComputedStyle(stage).transform)).a || 1; } catch (_) {}
    const base = getBase();
    // `pid`: o arraste pertence a UM ponteiro. Sem isso, um 2º dedo pousado num
    // overlay sem pinça (o avatar) passaria a comandar o movimento com as SUAS
    // coordenadas contra o ponto inicial do 1º dedo — e a peça daria um salto.
    moveState = { pid: e.pointerId, scale, startX: e.clientX, startY: e.clientY, base, curX: base.x, curY: base.y };
    el.style.cursor = 'grabbing';
  };
  const endMove = (doCommit) => {
    if (!moveState) return;
    el.style.cursor = 'grab';
    clearGuides();
    if (doCommit) commit(Math.round(moveState.curX * 10) / 10, Math.round(moveState.curY * 10) / 10);
    moveState = null;
  };
  const beginPinch = () => {
    const pts = Array.from(pointers.values());
    if (pts.length < 2 || !pinchOpts) return;
    const sc0 = pinchOpts.getScale ? pinchOpts.getScale() : 1;
    pinchState = { startDist: dist(pts[0], pts[1]) || 1, startScale: sc0, curScale: sc0 };
  };
  const endPinch = (doCommit) => {
    if (!pinchState) return;
    if (doCommit && pinchOpts && pinchOpts.onScaleCommit) pinchOpts.onScaleCommit(pinchState.curScale);
    pinchState = null;
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-lresize]') || e.target.closest('[data-lrotate]')) return;   // as alças cuidam de si
    e.preventDefault();
    e.stopPropagation();                       // não aciona o pan das imagens do modelo
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      beginMove(e);
    } else if (pointers.size === 2 && pinchOpts) {
      // 2º dedo pousou → o gesto vira pinça. PERSISTE o que já foi arrastado
      // (senão o deslocamento ficaria só no visual e voltaria no próximo render).
      endMove(true);
      beginPinch();
    }
  });
  el.addEventListener('pointermove', (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (pinchState) {
      const pts = Array.from(pointers.values());
      if (pts.length < 2) return;
      const ratio = dist(pts[0], pts[1]) / pinchState.startDist;
      const min = (pinchOpts.min != null) ? pinchOpts.min : 0.15;
      const max = (pinchOpts.max != null) ? pinchOpts.max : 3;
      pinchState.curScale = Math.round(Math.max(min, Math.min(max, pinchState.startScale * ratio)) * 100) / 100;
      if (pinchOpts.onScale) pinchOpts.onScale(pinchState.curScale);
      return;
    }
    if (!moveState || ev.pointerId !== moveState.pid) return;
    let px = moveState.base.x + (((ev.clientX - moveState.startX) / moveState.scale) / fmt.w) * 100;
    let py = moveState.base.y + (((ev.clientY - moveState.startY) / moveState.scale) / fmt.h) * 100;
    px = Math.max(2, Math.min(98, px));
    py = Math.max(2, Math.min(98, py));
    let sx = null, sy = null;
    SNAPS.forEach(t => { if (Math.abs(px - t) < TOL) sx = t; });
    SNAPS.forEach(t => { if (Math.abs(py - t) < TOL) sy = t; });
    if (sx != null) { px = sx; if (!gv) gv = mkGuide('v', sx); gv.style.left = sx + '%'; }
    else if (gv) { gv.remove(); gv = null; }
    if (sy != null) { py = sy; if (!gh) gh = mkGuide('h', sy); gh.style.top = sy + '%'; }
    else if (gh) { gh.remove(); gh = null; }
    moveState.curX = px; moveState.curY = py;
    el.style.left = px + '%';
    el.style.top = py + '%';
  });
  const onUp = (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    pointers.delete(ev.pointerId);
    try { el.releasePointerCapture(ev.pointerId); } catch (_) {}
    if (pinchState) { if (pointers.size < 2) endPinch(true); return; }
    if (moveState && ev.pointerId === moveState.pid) endMove(true);
  };
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
}

/** AVATAR arrastável — persiste avatarX/avatarY no slide REAL. */
function setupAvatarDrag(av, rootEl, fmt) {
  _overlayDrag(av, rootEl, fmt,
    () => ({ x: parseFloat(av.style.left) || 84, y: parseFloat(av.style.top) || 84 }),
    (x, y) => {
      const tp = State.posters.find(p => p.id === State.activePosterId);
      if (!tp) return;
      const ts = (typeof getSlide === 'function') ? getSlide(tp) : tp;
      ts.avatarX = x; ts.avatarY = y;
      tp.updatedAt = new Date().toISOString();
      savePosters();
    });
}

const LAYER_BASE_W = 360;   // largura (px, no cartaz 1080) de uma camada com escala 1
const AVATAR_BASE_W = 150;  // diâmetro (px) do avatar com escala 1

/* ===== Chrome compartilhado dos overlays (avatar/camadas) — resize + excluir (r115) ===== */
/** Alça de redimensionamento (canto inferior-direito). `.pe-ov-chrome` = só visível
 *  quando o overlay está selecionado; some no export. */
function _overlayResizeHandle() {
  const h = document.createElement('div');
  h.className = 'pe-layer-handle pe-ov-chrome';
  h.style.cssText = 'position:absolute;right:-15px;bottom:-15px;width:30px;height:30px;' +
    'border-radius:50%;background:#fff;border:2px solid var(--accent,#cf3418);' +
    'box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:nwse-resize;touch-action:none;z-index:9;';
  return h;
}
/** Botão X VAZADO (sem fundo, traço branco com sombra → visível em qualquer fundo).
 *  Maior p/ toque; `.pe-ov-chrome` = só quando selecionado; some no export. */
function _overlayDeleteBtn(onDel) {
  const d = document.createElement('button');
  d.type = 'button';
  d.className = 'pe-del-badge pe-ov-chrome';
  d.setAttribute('aria-label', 'Excluir');
  d.style.cssText = 'position:absolute;right:-18px;top:-44px;width:38px;height:38px;border:none;' +
    'background:none;cursor:pointer;padding:0;z-index:10;touch-action:none;';
  d.innerHTML = '<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.9));"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
  d.onpointerdown = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
  d.onclick = (ev) => { ev.stopPropagation(); onDel(); };
  return d;
}
/** Alça de ROTAÇÃO (canto superior-esquerdo, espelhando o X do outro lado). r118.
 *  `.pe-ov-chrome` = só visível quando o overlay está selecionado; some no export. */
function _overlayRotateHandle() {
  const h = document.createElement('div');
  h.className = 'pe-rotate-handle pe-ov-chrome';
  // NÃO define `display` inline: o inline venceria a regra `.pe-ov-chrome{display:none}`
  // e a alça apareceria SEMPRE (inclusive no export). O `display:flex` de quando
  // está selecionada mora no CSS (regra de `.pe-ov-sel > .pe-rotate-handle`).
  h.style.cssText = 'position:absolute;left:-16px;top:-40px;width:32px;height:32px;' +
    'border-radius:50%;background:#fff;border:2px solid var(--accent,#cf3418);' +
    'box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:grab;touch-action:none;z-index:10;' +
    'align-items:center;justify-content:center;color:var(--accent,#cf3418);';
  h.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>';
  return h;
}

/** ROTAÇÃO genérica de overlay pela alça (r118). O ângulo acompanha o dedo/cursor
 *  de forma RELATIVA (a alça fica sempre sob o ponteiro) e faz snap de 15° perto
 *  dos ângulos "redondos". A caixa gira em torno do PRÓPRIO CENTRO: o `left/top`
 *  do overlay é o centro (translate(-50%,-50%)), e `rotate()` na mesma transform
 *  usa o transform-origin padrão (50% 50%) — ou seja, gira sem sair do lugar.
 *  opts: { getRotation(), onRotate(deg) (visual), commit(deg) (persiste). } */
function _setupOverlayRotate(handle, box, opts) {
  opts = opts || {};
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const r = box.getBoundingClientRect();          // o centro do retângulo envolvente
    const cx = r.left + r.width / 2;               // continua sendo o centro real
    const cy = r.top + r.height / 2;               // mesmo com a caixa já girada
    const ang0 = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    const rot0 = (opts.getRotation ? opts.getRotation() : 0) || 0;
    let cur = rot0;
    try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    handle.style.cursor = 'grabbing';
    const onMove = (ev) => {
      const ang = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
      let deg = Math.round(rot0 + (ang - ang0));
      deg = ((deg % 360) + 360) % 360;
      const off = deg % 15;                         // snap 15° (cobre 0/90/180/270)
      if (off < 4) deg -= off; else if (off > 11) deg += (15 - off);
      cur = ((deg % 360) + 360) % 360;
      if (opts.onRotate) opts.onRotate(cur);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      handle.style.cursor = 'grab';
      if (opts.commit) opts.commit(cur);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  });
}

/** Resize genérico de overlay pela alça. A escala segue a DISTÂNCIA do ponteiro
 *  até o centro da caixa (razão distância-atual ÷ distância-inicial) — método
 *  RADIAL, imune à rotação: com a caixa girada, o eixo X da tela não é mais o
 *  eixo X do objeto, então o delta horizontal puro (antes de r118) redimensionava
 *  para o lado errado. Afastar o dedo do centro aumenta; aproximar diminui.
 *  opts: { square, min, max, commit(scale) }. Usado por camadas e avatar. */
function _setupOverlayResize(handle, box, baseW, opts) {
  opts = opts || {};
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = parseFloat(box.style.width) || baseW;
    const r = box.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const d0 = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
    let curScale = startW / baseW;
    try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    const onMove = (ev) => {
      const d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
      const w = Math.max(baseW * (opts.min || 0.15), Math.min(baseW * (opts.max || 3), startW * (d / d0)));
      curScale = Math.round((w / baseW) * 100) / 100;
      box.style.width = Math.round(w) + 'px';
      if (opts.square) box.style.height = Math.round(w) + 'px';
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      if (opts.commit) opts.commit(curScale);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  });
}
/** Grava campos do avatar no slide REAL. */
function _commitAvatar(patch) {
  const tp = State.posters.find((x) => x.id === State.activePosterId);
  if (!tp) return;
  const ts = (typeof getSlide === 'function') ? getSlide(tp) : tp;
  Object.assign(ts, patch);
  tp.updatedAt = new Date().toISOString();
  savePosters();
}
/** Remove o avatar (X sobre ele) e re-renderiza o editor (some do cartaz e da mídia). */
function _clearAvatar() {
  _commitAvatar({ avatar: null });
  if (typeof renderPosterEditor === 'function') renderPosterEditor();
  else if (typeof _refreshPosterPreview === 'function') _refreshPosterPreview();
}
/** Remove uma camada (X sobre ela). */
function _deleteLayer(lid) {
  const tp = State.posters.find((x) => x.id === State.activePosterId);
  if (!tp) return;
  const ts = (typeof getSlide === 'function') ? getSlide(tp) : tp;
  if (!Array.isArray(ts.layers)) return;
  const i = ts.layers.findIndex((l) => l && l.id === lid);
  if (i < 0) return;
  ts.layers.splice(i, 1);
  tp.updatedAt = new Date().toISOString();
  savePosters();
  if (typeof renderLayerList === 'function') renderLayerList();
  if (typeof _refreshPosterPreview === 'function') _refreshPosterPreview();
}

/* ============================================================
   SISTEMA UNIFICADO DE CAMADAS/OVERLAYS (r116)
   Elementos livres, avatar e camadas de imagem participam de UMA hierarquia
   de z-order (campo `z`) e são pintados no MESMO stacking context, permitindo
   ordenar qualquer objeto entre si. Um único `_peSelected` (poster-elements.js)
   controla qual overlay mostra os controles.
   ============================================================ */

function _overlayZMax(s) {
  let m = 0;
  if (s && typeof s.avatarZ === 'number') m = Math.max(m, s.avatarZ);
  if (s && Array.isArray(s.layers)) s.layers.forEach((L) => { if (typeof L.z === 'number') m = Math.max(m, L.z); });
  if (s && Array.isArray(s.elements)) s.elements.forEach((e) => { if (typeof e.z === 'number') m = Math.max(m, e.z); });
  return m;
}
function nextOverlayZ(s) { return _overlayZMax(s) + 1; }

/** Garante `z` em todo overlay. Legado (nenhum z): ordem de pintura antiga
 *  (avatar < camadas < elementos). Novos itens: topo. Retorna se mudou algo. */
function ensureOverlayZ(s) {
  if (!s) return false;
  const anyZ = (typeof s.avatarZ === 'number')
    || (Array.isArray(s.layers) && s.layers.some((L) => typeof L.z === 'number'))
    || (Array.isArray(s.elements) && s.elements.some((e) => typeof e.z === 'number'));
  let changed = false;
  if (!anyZ) {
    let z = 1;
    if (s.avatar) { s.avatarZ = z++; changed = true; }
    (s.layers || []).forEach((L) => { L.z = z++; changed = true; });
    (s.elements || []).forEach((e) => { e.z = z++; changed = true; });
    return changed;
  }
  if (s.avatar && typeof s.avatarZ !== 'number') { s.avatarZ = nextOverlayZ(s); changed = true; }
  (s.layers || []).forEach((L) => { if (typeof L.z !== 'number') { L.z = nextOverlayZ(s); changed = true; } });
  (s.elements || []).forEach((e) => { if (typeof e.z !== 'number') { e.z = nextOverlayZ(s); changed = true; } });
  return changed;
}

/** TODOS os overlays do cartaz/slide, ordenados por z ascendente (trás→frente). */
function collectOverlays(p) {
  const items = [];
  (Array.isArray(p.elements) ? p.elements : []).forEach((e) => items.push({ kind: 'element', id: e.id, z: (typeof e.z === 'number' ? e.z : 0), ref: e }));
  if (p.avatar && (typeof posterShow !== 'function' || posterShow('avatar'))) items.push({ kind: 'avatar', id: '__avatar', z: (typeof p.avatarZ === 'number' ? p.avatarZ : 0) });
  (Array.isArray(p.layers) ? p.layers : []).forEach((L) => items.push({ kind: 'layer', id: L.id, z: (typeof L.z === 'number' ? L.z : 0), ref: L }));
  items.sort((a, b) => (a.z - b.z));
  return items;
}
function _ovZGet(s, it) { return it.kind === 'avatar' ? s.avatarZ : (it.ref ? it.ref.z : 0); }
function _ovZSet(s, it, v) { if (it.kind === 'avatar') s.avatarZ = v; else if (it.ref) it.ref.z = v; }

/** Reordena um overlay trocando z com o vizinho. dir: 'up'(frente)|'down'(trás). */
function reorderOverlay(id, dir) {
  const tp = State.posters.find((x) => x.id === State.activePosterId);
  if (!tp) return;
  const s = (typeof getSlide === 'function') ? getSlide(tp) : tp;
  ensureOverlayZ(s);
  const items = collectOverlays(s);
  const idx = items.findIndex((it) => it.id === id);
  const j = dir === 'up' ? idx + 1 : idx - 1;
  if (idx < 0 || j < 0 || j >= items.length) return;
  const a = _ovZGet(s, items[idx]), b = _ovZGet(s, items[j]);
  _ovZSet(s, items[idx], b); _ovZSet(s, items[j], a);
  tp.updatedAt = new Date().toISOString();
  savePosters();
  if (typeof _refreshPosterPreview === 'function') _refreshPosterPreview();
  if (typeof renderPosterElementsPanel === 'function') renderPosterElementsPanel();
  if (typeof renderLayerList === 'function') renderLayerList();
}

/** Nó do AVATAR (arrastável, redimensionável, excluível), com z-index dado. */
function buildAvatarOverlay(p, rootEl, fmt, zi) {
  const ax = (typeof p.avatarX === 'number') ? p.avatarX : 84;
  const ay = (typeof p.avatarY === 'number') ? p.avatarY : 84;
  const asc = (typeof p.avatarScale === 'number') ? p.avatarScale : 1;
  const aw = Math.round(AVATAR_BASE_W * asc);
  const av = document.createElement('div');
  av.setAttribute('data-pt', 'avatar-overlay');
  av.style.cssText = 'position:absolute;left:' + ax + '%;top:' + ay + '%;' +
    'transform:translate(-50%,-50%);width:' + aw + 'px;height:' + aw + 'px;' +
    'border-radius:50%;background-image:url("' + p.avatar.replace(/"/g, '%22') + '");' +
    'background-size:cover;background-position:center;border:6px solid rgba(255,255,255,0.94);' +
    'z-index:' + zi + ';cursor:grab;touch-action:none;';
  rootEl.appendChild(av);
  if (typeof _peSelectOverlay === 'function') av.addEventListener('pointerdown', () => _peSelectOverlay('__avatar'), true);
  if (typeof _peOpenEditorFor === 'function') av.addEventListener('dblclick', (e) => { e.stopPropagation(); _peOpenEditorFor('avatar', '__avatar'); });
  setupAvatarDrag(av, rootEl, fmt);
  const ah = _overlayResizeHandle();
  av.appendChild(ah);
  _setupOverlayResize(ah, av, AVATAR_BASE_W, { square: true, min: 0.3, max: 3, commit: (sc) => _commitAvatar({ avatarScale: sc }) });
  av.appendChild(_overlayDeleteBtn(() => _clearAvatar()));
  return av;
}

/** Nó de uma CAMADA de imagem, com z-index dado.
 *  A camada é um OBJETO INDEPENDENTE: move (arrastar), redimensiona (alça ou
 *  pinça de 2 dedos), gira (alça de rotação) e empilha (z-order unificado) —
 *  tudo sobre o PNG original com transparência intacta (o <img> carrega o data
 *  URL do recorte como veio; nenhuma etapa rasteriza/achata a camada). */
function buildLayerOverlay(p, layer, rootEl, fmt, zi) {
  const x = (typeof layer.x === 'number') ? layer.x : 50;
  const y = (typeof layer.y === 'number') ? layer.y : 50;
  const sc = (typeof layer.scale === 'number') ? layer.scale : 1;
  const rot = (typeof layer.rotation === 'number') ? layer.rotation : 0;
  const w = Math.round(LAYER_BASE_W * sc);
  const box = document.createElement('div');
  box.setAttribute('data-pt', 'layer');
  box.dataset.lid = layer.id;
  // translate(-50%,-50%) + rotate() na MESMA transform: o transform-origin padrão
  // (centro da caixa) vale para a matriz composta → gira no lugar, sem deslocar.
  box.style.cssText = `position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${rot}deg);width:${w}px;z-index:${zi};cursor:grab;touch-action:none;`;
  const img = document.createElement('img');
  img.src = layer.src; img.alt = ''; img.draggable = false;
  img.style.cssText = 'width:100%;height:auto;display:block;pointer-events:none;user-select:none;';
  box.appendChild(img);
  const handle = _overlayResizeHandle();
  handle.dataset.lresize = layer.id;
  box.appendChild(handle);
  const rotHandle = _overlayRotateHandle();
  rotHandle.dataset.lrotate = layer.id;
  box.appendChild(rotHandle);
  box.appendChild(_overlayDeleteBtn(() => _deleteLayer(layer.id)));
  rootEl.appendChild(box);
  if (typeof _peSelectOverlay === 'function') box.addEventListener('pointerdown', () => _peSelectOverlay(layer.id), true);
  if (typeof _peOpenEditorFor === 'function') box.addEventListener('dblclick', (e) => { e.stopPropagation(); _peOpenEditorFor('layer', layer.id); });
  const setRot = (deg) => { box.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`; };
  const curRot = () => {
    const m = /rotate\((-?[\d.]+)deg\)/.exec(box.style.transform || '');
    return m ? parseFloat(m[1]) : 0;
  };
  _overlayDrag(box, rootEl, fmt,
    () => ({ x: parseFloat(box.style.left) || 50, y: parseFloat(box.style.top) || 50 }),
    (nx, ny) => _commitLayer(layer.id, { x: nx, y: ny }),
    // PINÇA (2 dedos) sobre a própria camada — "zoom" sem precisar mirar a alça.
    {
      min: 0.15, max: 3,
      getScale: () => (parseFloat(box.style.width) || LAYER_BASE_W) / LAYER_BASE_W,
      onScale: (s2) => { box.style.width = Math.round(LAYER_BASE_W * s2) + 'px'; },
      onScaleCommit: (s2) => { _commitLayer(layer.id, { scale: s2 }); if (typeof renderLayerList === 'function') renderLayerList(); },
    });
  _setupOverlayResize(handle, box, LAYER_BASE_W, {
    min: 0.15, max: 3,
    commit: (sc2) => { _commitLayer(layer.id, { scale: sc2 }); if (typeof renderLayerList === 'function') renderLayerList(); },
  });
  _setupOverlayRotate(rotHandle, box, {
    getRotation: curRot,
    onRotate: setRot,
    commit: (deg) => { _commitLayer(layer.id, { rotation: deg }); if (typeof renderLayerList === 'function') renderLayerList(); },
  });
  return box;
}

/** Render UNIFICADO de todos os overlays em z-order (limpa e repinta). */
function renderPosterOverlays(p, fmt) {
  const rootEl = $('#p-stage') && $('#p-stage').querySelector('.poster-1440');
  if (!rootEl) return;
  rootEl.querySelectorAll('.pe-el, [data-pt="avatar-overlay"], [data-pt="layer"], .pe-layer, .pe-ui-layer, .pe-guides, .pe-safe').forEach((n) => n.remove());
  if (getComputedStyle(rootEl).position === 'static') rootEl.style.position = 'relative';
  const H = (fmt && fmt.h) || 1440;
  collectOverlays(p).forEach((it, i) => {
    const zi = 10 + i;
    if (it.kind === 'element') {
      if (it.ref.hidden) return;
      const node = buildElementNode(it.ref, H);
      node.style.zIndex = zi;
      rootEl.appendChild(node);
    } else if (it.kind === 'avatar') {
      buildAvatarOverlay(p, rootEl, fmt, zi);
    } else if (it.kind === 'layer') {
      buildLayerOverlay(p, it.ref, rootEl, fmt, zi);
    }
  });
  // Interações + seleção dos elementos livres, guias e classes de seleção dos overlays.
  if (typeof setupPosterElementEditing === 'function') setupPosterElementEditing();
}

/** Compat: chamadas antigas delegam ao render unificado. */
function renderPosterLayers(p, fmt) { renderPosterOverlays(p, fmt); }

/** Grava campos de uma camada no slide REAL (o render usa draft descartável). */
function _commitLayer(lid, patch) {
  const tp = State.posters.find(p => p.id === State.activePosterId);
  if (!tp) return;
  const ts = (typeof getSlide === 'function') ? getSlide(tp) : tp;
  if (!Array.isArray(ts.layers)) return;
  const L = ts.layers.find(l => l && l.id === lid);
  if (!L) return;
  Object.assign(L, patch);
  tp.updatedAt = new Date().toISOString();
  savePosters();
}

/**
 * Calcula o tamanho de fonte do título adaptativo:
 * títulos curtos ficam GRANDES (impacto), longos diminuem para caber.
 * Faixas baseadas em testes visuais com a área disponível (~360px alto, ~984px largo).
 */
function computeHeadlineFontSize(text) {
  const len = (text || '').length;
  if (len <= 30)  return 96;
  if (len <= 50)  return 86;
  if (len <= 75)  return 76;
  if (len <= 100) return 66;
  return 56;
}

/**
 * Calcula a escala ideal do preview baseado na largura
 * disponível do container e ajusta a altura do wrap para reservar
 * o espaço correto (cartaz é 1080x1440 — formato vertical 3:4).
 */
function fitPosterPreview() {
  const stage = $('#p-stage');
  const wrap = $('#p-stage-wrap');
  const outer = $('#p-stage-outer');
  if (!stage || !wrap || !outer) return;
  // Largura útil do container do preview (descontando padding)
  const cs = window.getComputedStyle(outer);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availableWidth = outer.clientWidth - padX;
  if (availableWidth <= 0) return;
  // Escala = menor entre o ajuste por LARGURA e por ALTURA (capped em 1.0). O eixo
  // altura usa o VIEWPORT (− cabeçalho/margens) para o preview STICKY caber inteiro
  // na tela e o preview em ABA (mobile) não estourar a vertical.
  const fmt = posterActiveFormat();
  // Mobile (≤900px): o canvas tem ALTURA FIXA (38vh, ver CSS) e fica sempre visível
  // no topo enquanto as ferramentas rolam abaixo — escala para caber nesse container.
  // Desktop: usa o viewport (preview sticky cabe inteiro na tela).
  const mobile = window.innerWidth <= 900;
  const budget = mobile && outer.clientHeight > 40
    ? outer.clientHeight - padY
    : window.innerHeight - 160 - padY;
  const availableHeight = Math.max(180, budget);
  const scale = Math.min(1, availableWidth / fmt.w, availableHeight / fmt.h);
  stage.style.transform = `scale(${scale})`;
  // O wrap precisa reservar a altura escalada para que o card cresça corretamente
  wrap.style.height = (fmt.h * scale) + 'px';
  wrap.style.width = (fmt.w * scale) + 'px';
}

// Reescalar quando a janela mudar de tamanho ou trocar de aba
let _resizeRaf = null;
window.addEventListener('resize', () => {
  if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
  _resizeRaf = requestAnimationFrame(() => {
    if (State.currentView === 'posters') fitPosterPreview();
  });
});

/**
 * Reproduz o "…" do preview no EXPORT. O html2canvas 1.4.1 NÃO renderiza o
 * ellipsis do `-webkit-line-clamp` nem do `text-overflow:ellipsis` — só corta
 * por `overflow:hidden`, sem indicar continuação. Aqui, ANTES de capturar (com
 * o stage já em escala 1 = MESMO layout do preview), achamos os elementos de
 * TEXTO que transbordam e trocamos o texto pelo maior prefixo que cabe + "…"
 * (caractere real, que o html2canvas desenha). Devolve a lista p/ restaurar.
 */
function _applyExportEllipsis(target) {
  const restores = [];
  target.querySelectorAll('h1,h2,h3,h4,p,span,div,blockquote').forEach(el => {
    // só elementos de TEXTO puro (filhos só text-node) — não destruir estrutura
    if (!el.childNodes.length) return;
    let hasText = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 1) return;                                  // tem filho-elemento → pula
      if (n.nodeType === 3 && n.nodeValue.trim()) hasText = true;
    }
    if (!hasText) return;
    const cs = getComputedStyle(el);
    // NÃO checar cs.display: com -webkit-line-clamp o display computado pode vir
    // como "flow-root" mesmo com o clamp ativo. O line-clamp em si (>0) já indica.
    const clampN = parseInt(cs.webkitLineClamp || cs.getPropertyValue('-webkit-line-clamp'), 10);
    const multiline = clampN > 0;
    const singleline = cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap' && cs.overflow !== 'visible';
    // TOLERÂNCIA = ~meia linha: o scrollHeight excede o clientHeight em ~7-8px por
    // arredondamento de line-box MESMO quando o texto cabe; um overflow real é ≥1
    // linha (~40px). Meia linha separa os dois casos com folga.
    const lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.2) || 20;
    const tolH = lh * 0.5;
    let axis = null;
    if (multiline && (el.scrollHeight - el.clientHeight) > tolH) axis = 'h';
    else if (singleline && (el.scrollWidth - el.clientWidth) > 2) axis = 'w';
    if (!axis) return;
    const orig = el.textContent;
    const fits = () => axis === 'h' ? (el.scrollHeight - el.clientHeight) <= tolH : (el.scrollWidth - el.clientWidth) <= 2;
    // maior prefixo tal que `prefixo…` ainda cabe (busca binária; predicado monotônico)
    let lo = 1, hi = orig.length, best = '';
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      el.textContent = orig.slice(0, mid).replace(/\s+$/, '') + '…';
      if (fits()) { best = el.textContent; lo = mid + 1; } else { hi = mid - 1; }
    }
    el.textContent = best || '…';
    restores.push({ el, text: orig });
  });
  return restores;
}

/**
 * Captura o que está no #p-stage (.poster-1440) num canvas full-res, fazendo o
 * "flatten" das imagens arrastáveis (html2canvas não suporta object-fit/position).
 * Reutilizado pela exportação de cartaz único E de carrossel. Restaura o stage.
 * @returns {Promise<HTMLCanvasElement|null>}
 */
// Geometria de enquadramento (cover + zoom + pan) do EXPORT — pura e testável.
// É o "contrato" do recorte que o flatten do PNG deve reproduzir do preview:
// a imagem (original) é cover-fit, escalada por `scale` e deslocada por pan
// (posX/posY 0..100, onde 50 = centro). Devolve o retângulo de destino no canvas.
function posterCoverRect(W, H, iw, ih, scale, posX, posY) {
  const cl = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const scaleCover = Math.max(W / iw, H / ih);
  const sc = cl(scale || 1, 0.05, 3);
  const renderW = iw * scaleCover * sc;
  const renderH = ih * scaleCover * sc;
  const txMax = Math.max(0, (renderW - W) / 2);
  const tyMax = Math.max(0, (renderH - H) / 2);
  const tx = txMax * (1 - cl(posX, 0, 100) / 50);
  const ty = tyMax * (1 - cl(posY, 0, 100) / 50);
  return { renderW, renderH, dx: (W - renderW) / 2 + tx, dy: (H - renderH) / 2 + ty };
}

/* Cobertura durante a captura. Pra exportar em alta resolução o html2canvas
   precisa renderizar o cartaz no tamanho real (scale 1) e trocar as imagens/logo
   por canvas — isso faz o cartaz "dar zoom" e piscar na tela. Cobrimos a área da
   prévia com um card de "gerando…" enquanto acontece, então o usuário não vê a
   bagunça. Contador de referências: no carrossel a cobertura fica de pé durante
   o loop inteiro (não pisca a cada slide). */
let _stageCoverEl = null;
let _stageCoverRefs = 0;
function showStageCaptureCover() {
  _stageCoverRefs++;
  if (_stageCoverEl) return;
  const outer = document.getElementById('p-stage-outer');
  if (!outer) return;
  const r = outer.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const c = document.createElement('div');
  c.className = 'p-export-cover';
  c.style.left = r.left + 'px';
  c.style.top = r.top + 'px';
  c.style.width = r.width + 'px';
  c.style.height = r.height + 'px';
  c.innerHTML = '<div class="p-export-cover-in"><div class="spin"></div><div class="cap">Gerando em alta resolução…</div></div>';
  document.body.appendChild(c);
  _stageCoverEl = c;
}
function hideStageCaptureCover(force) {
  _stageCoverRefs = force ? 0 : Math.max(0, _stageCoverRefs - 1);
  if (_stageCoverRefs === 0 && _stageCoverEl) {
    if (_stageCoverEl.remove) _stageCoverEl.remove();
    _stageCoverEl = null;
  }
}

async function captureStageCanvas(fmt, scale) {
  // Sem o html2canvas (CDN bloqueado/offline) a exportação apenas "não
  // acontecia": ReferenceError no console e botão sem reação nenhuma. Confere
  // ANTES de preparar o palco — quem chamou avisa o usuário. Ver ensureLib().
  if (!(await ensureLib('html2canvas'))) return null;
  const s = Math.max(1, scale || 1);   // 1× (padrão) ou 2× (alta resolução)
  const stage = $('#p-stage');
  const wrap = $('#p-stage-wrap');
  const target = stage && stage.querySelector('.poster-1440');
  if (!stage || !wrap || !target) return null;
  // Alvo com 0 de largura/altura (palco numa view oculta, render abortado): o
  // html2canvas não devolve erro tratável — ele estoura lá dentro com
  // "addColorStop: The provided double value is non-finite", porque a linha do
  // gradiente mede zero e a parada vira NaN. Quem chamou mostrava esse texto
  // cru ao usuário. Detecta antes e devolve null, que é o contrato já
  // existente para "não deu para capturar".
  const medida = target.getBoundingClientRect();
  if (medida.width < 1 || medida.height < 1) {
    console.warn('[cartaz] exportação abortada: alvo sem dimensão', medida.width, '×', medida.height);
    return null;
  }
  showStageCaptureCover();   // esconde o zoom/piscada da captura
  if (typeof stage.__exitReframe === 'function') stage.__exitReframe();   // sai do reframe se ativo
  // Garante as fontes carregadas antes de exportar — com a fonte ainda baixando o
  // layout fica instável e o html2canvas pode lançar "addColorStop non-finite" ao
  // processar gradientes. Carrega a display (Poppins) explicitamente (fonts.ready
  // sozinho não basta se a fonte ainda não foi requisitada). Teto de 3,5s (offline).
  if (document.fonts && document.fonts.load) {
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('700 40px Poppins'),
          document.fonts.load('500 22px Poppins'),
          document.fonts.ready,
        ]),
        new Promise(r => setTimeout(r, 3500)),
      ]);
    } catch (e) { /* ignora */ }
  }
  // Salva estado atual e restaura escala 1 para captura full-res
  const originalTransform = stage.style.transform;
  const originalWrapW = wrap.style.width;
  const originalWrapH = wrap.style.height;
  stage.style.transform = 'scale(1)';
  wrap.style.width = fmt.w + 'px';
  wrap.style.height = fmt.h + 'px';
  target.classList.add('exporting');

  // Reticências "…" nos textos longos (o html2canvas não renderiza o ellipsis do
  // line-clamp/text-overflow) — feito com o layout já em escala 1 (= preview).
  const ellipsisRestores = _applyExportEllipsis(target);

  // --- Flatten: renderiza cada imagem num canvas com zoom+pan+cover. ---
  const snapshots = [];
  const imgs = [...target.querySelectorAll('[data-draggable]')];
  for (const img of imgs) {
    const wrapEl = img.parentElement?.closest?.('[data-zoomscale]') || img.parentElement;
    if (!wrapEl) continue;
    const container = wrapEl.parentElement;
    if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) continue;

    const scale = parseFloat(img.dataset.scale) || 1;
    const posX = numAttr(img.dataset.posx, 50);
    const posY = numAttr(img.dataset.posy, 50);
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) continue;

    const W = container.offsetWidth;
    const H = container.offsetHeight;

    const cvs = document.createElement('canvas');
    cvs.width = W * s;            // bitmap em alta-res; CSS continua 100% (= W×H px)
    cvs.height = H * s;
    cvs.style.cssText = 'display: block; width: 100%; height: 100%;';
    const ctx = cvs.getContext('2d');

    // Enquadramento desenhado por RETÂNGULO DE DESTINO (preserva a proporção em
    // QUALQUER zoom). Mesma geometria do preview (applyImageTransform): a imagem
    // (cheia, original) é cover-fit centralizada, escalada por `scale` e deslocada
    // por (tx,ty). Ao AFASTAR além do cover, a imagem fica MENOR que a célula e as
    // margens transparentes do canvas revelam o matte (cor da junção) → a foto
    // INTEIRA aparece, sem distorção nem recorte permanente. posX/posY 0..100 = bordas.
    const { renderW, renderH, dx, dy } = posterCoverRect(W, H, iw, ih, scale, posX, posY);
    // Recorte DIAGONAL (mosaicos com data-clip): clipa o canvas no MESMO polígono
    // que o clip-path usa no preview — assim a forma diagonal sobrevive ao PNG.
    const clipPts = container.dataset.clip;
    if (clipPts) {
      ctx.save();
      ctx.beginPath();
      // O parâmetro NÃO pode se chamar `s`: sombreava a escala do export e
      // `W * s` virava `W * "0 0"` = NaN → polígono degenerado, ctx.clip()
      // descartava tudo e a foto sumia do PNG (o preview ficava certo).
      clipPts.split(',').forEach((pt, i) => {
        const xy = pt.trim().split(/\s+/).map(Number);
        const X = (xy[0] / 100) * W * s, Y = (xy[1] / 100) * H * s;
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      });
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(img, dx * s, dy * s, renderW * s, renderH * s);
    if (clipPts) ctx.restore();

    // `display` original guardado: o wrapper de posterImageLayer é `display:flex`
    // inline e restaurar com '' o rebaixava a `block` — depois de exportar, o
    // preview ficava silenciosamente diferente do que era, até o próximo render.
    // Ver o `finally` desta função.
    snapshots.push({ container, wrapEl, cvs, display: wrapEl.style.display });
    wrapEl.style.display = 'none';
    container.insertBefore(cvs, wrapEl);
  }

  // --- Flatten da LOGO: o html2canvas 1.4.1 IGNORA object-fit → a logo (não
  // quadrada) ESTICARIA no PNG. Redesenhamos cada logo num canvas com cover +
  // cantos arredondados (igual ao preview) e a trocamos durante a captura. ---
  for (const logo of [...target.querySelectorAll('img[data-logo-cover]')]) {
    const lw = logo.offsetWidth, lh = logo.offsetHeight;
    const iw = logo.naturalWidth, ih = logo.naturalHeight;
    if (!lw || !lh || !iw || !ih) continue;
    const radius = numAttr(logo.dataset.radius, 0);
    const lc = document.createElement('canvas');
    lc.width = lw * s; lc.height = lh * s;   // bitmap em alta-res; CSS continua em px
    lc.style.cssText = `display:block;width:${lw}px;height:${lh}px;flex-shrink:0;`;
    const lctx = lc.getContext('2d');
    if (radius > 0 && typeof _mbRoundRect === 'function') { _mbRoundRect(lctx, 0, 0, lw * s, lh * s, radius * s); lctx.clip(); }
    const sCover = Math.max(lw / iw, lh / ih);   // cover: preenche, recorta o excedente
    const rW = iw * sCover * s, rH = ih * sCover * s;
    lctx.drawImage(logo, (lw * s - rW) / 2, (lh * s - rH) / 2, rW, rH);
    snapshots.push({ wrapEl: logo, cvs: lc, display: logo.style.display });   // restaurado no finally (display + remove)
    logo.style.display = 'none';
    logo.parentNode.insertBefore(lc, logo);
  }

  try {
    return await html2canvas(target, {
      width: fmt.w,
      height: fmt.h,
      scale: s,
      backgroundColor: '#FFFFFF',
      useCORS: true,
      logging: false,
    });
  } finally {
    for (const s of snapshots) {
      if (s.cvs && s.cvs.parentNode) s.cvs.remove();
      if (s.wrapEl) s.wrapEl.style.display = s.display || '';
    }
    for (const r of ellipsisRestores) { r.el.textContent = r.text; }   // restaura o texto original
    target.classList.remove('exporting');
    stage.style.transform = originalTransform;
    wrap.style.width = originalWrapW;
    wrap.style.height = originalWrapH;
    hideStageCaptureCover();   // libera a cobertura (o preview já foi restaurado)
  }
}

async function exportPoster(p, scale, fileType) {
  const jpg = fileType === 'jpg' || fileType === 'jpeg';
  const mime = jpg ? 'image/jpeg' : 'image/png';
  const ext = jpg ? 'jpg' : 'png';
  try {
    const canvas = await captureStageCanvas(posterActiveFormat(), scale);
    if (!canvas) { toast(libReady('html2canvas') ? 'Não foi possível exportar.' : libUnavailableMsg('html2canvas'), 'error', 6000); return; }
    const name = `cartaz-${(p.headline || 'export').slice(0, 40).replace(/[^a-z0-9]/gi, '-').toLowerCase()}.${ext}`;
    const blob = await canvasToBlob(canvas, mime, jpg ? 0.92 : undefined);
    // Mostra a PRÉVIA + botão salvar/compartilhar. O salvamento vira uma ação
    // nova do usuário → o share nativo do iPhone funciona (não pode ser
    // disparado automático logo após o html2canvas, o iOS bloqueia).
    presentExport([{ name, blob }], { title: 'Cartaz pronto', subtitle: 'Confira e salve na galeria ou compartilhe.' });
  } catch (err) {
    toast('Não foi possível exportar: ' + err.message, 'error');
  } finally {
    fitPosterPreview();
  }
}

/** Salva o PROJETO do cartaz (mantém editável). Vive na tela de exportação. */
function _savePosterProject(p) {
  if (!p) return;
  if (typeof _posterCommitFields === 'function') _posterCommitFields({ flush: true });
  if ($('#p-theme')) p.theme = $('#p-theme').value;
  if (typeof readPosterCustom === 'function') p.custom = readPosterCustom();
  p.updatedAt = new Date().toISOString();
  if (typeof savePosters === 'function') savePosters();
  if (typeof renderPostersList === 'function') renderPostersList();
  toast((typeof posterIsCarousel === 'function' && posterIsCarousel(p)) ? 'Carrossel salvo.' : 'Cartaz salvo.', 'success');
}

/* Tela de FINALIZAR: um ícone abre esta tela única com as duas ações —
   SALVAR o projeto (mantém editável) e EXPORTAR (arquivo final). Já vem
   pré-preenchida com as escolhas da edição; o usuário ajusta e conclui.
   - Proporção (formato) com sugestão de plataforma;
   - Resolução (1×/2×); Formato do arquivo (PNG/JPG);
   - Carrossel: imagens separadas ou .zip. */
function openPosterExportSettings(p) {
  if (!p || typeof document === 'undefined') return;
  const isCar = (typeof posterIsCarousel === 'function') && posterIsCarousel(p);
  const s = (typeof getSlide === 'function') ? getSlide(p) : p;
  const FORMATS = (typeof POSTER_FORMATS !== 'undefined') ? POSTER_FORMATS : {};
  const PLAT = {
    '4:5': 'Instagram, Facebook',
    '1:1': 'Feed quadrado',
    '9:16': 'Stories, Reels',
    '3:4': 'Feed padrão',
  };
  let selFmt = (s && s.format) || (p && p.format) || '3:4';
  if (!FORMATS[selFmt]) selFmt = Object.keys(FORMATS)[0] || '3:4';
  let selScale = 1, selFile = 'png', selMode = 'images';

  const fmtCards = Object.keys(FORMATS).map((k) => {
    const parts = k.split(':').map(Number);
    const boxH = 26, boxW = Math.max(12, Math.round(boxH * (parts[0] / parts[1])));
    return `<button type="button" class="exps-fmt${k === selFmt ? ' sel' : ''}" data-fmt="${k}">
      <span class="exps-fmt-box" style="width:${boxW}px;height:${boxH}px;"></span>
      <span class="exps-fmt-txt">
        <span class="exps-fmt-ratio">${k}</span>
        <span class="exps-fmt-hint">${escapeHtml(PLAT[k] || (FORMATS[k] && FORMATS[k].hint) || '')}</span>
      </span>
    </button>`;
  }).join('');

  const backdrop = document.createElement('div');
  backdrop.className = 'xport-backdrop';
  backdrop.innerHTML = `<div class="xport-card exps-card" role="dialog" aria-modal="true">
    <div class="xport-head">
      <div><div class="xport-title">Finalizar ${isCar ? 'carrossel' : 'cartaz'}</div>
      <div class="xport-sub">Salve o projeto ou exporte o arquivo final.</div></div>
      <button class="xport-close" type="button" aria-label="Fechar">&times;</button>
    </div>
    <div class="exps-body">
      <div class="exps-group">
        <div class="exps-label">Proporção <span class="exps-note">sugestão por plataforma</span></div>
        <div class="exps-formats">${fmtCards}</div>
      </div>
      <div class="exps-group">
        <div class="exps-label">Resolução</div>
        <div class="exps-seg" data-seg="scale">
          <button type="button" data-v="1" class="sel">1080px</button>
          <button type="button" data-v="2">2160px</button>
        </div>
      </div>
      <div class="exps-group">
        <div class="exps-label">Formato</div>
        <div class="exps-seg" data-seg="file">
          <button type="button" data-v="png" class="sel">PNG</button>
          <button type="button" data-v="jpg">JPG</button>
        </div>
      </div>
      ${isCar ? `<div class="exps-group">
        <div class="exps-label">Entrega do carrossel</div>
        <div class="exps-seg" data-seg="mode">
          <button type="button" data-v="images" class="sel">Imagens</button>
          <button type="button" data-v="zip">Arquivo .zip</button>
        </div>
      </div>` : ''}
    </div>
    <div class="exps-actions">
      <button class="exps-btn exps-btn-save" type="button" id="exps-save">Salvar projeto</button>
      <button class="exps-btn exps-btn-go" type="button" id="exps-go">Exportar</button>
    </div>
  </div>`;

  let closed = false;
  const cleanup = () => { if (closed) return; closed = true; if (backdrop.remove) backdrop.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') cleanup(); };
  const closeBtn = backdrop.querySelector('.xport-close');
  if (closeBtn) closeBtn.onclick = cleanup;
  backdrop.onclick = (e) => { if (e.target === backdrop) cleanup(); };
  document.addEventListener('keydown', onKey);

  backdrop.querySelectorAll('.exps-fmt').forEach((btn) => { btn.onclick = () => {
    selFmt = btn.dataset.fmt;
    backdrop.querySelectorAll('.exps-fmt').forEach((b) => b.classList.toggle('sel', b === btn));
  }; });
  backdrop.querySelectorAll('.exps-seg').forEach((seg) => {
    seg.querySelectorAll('button').forEach((btn) => { btn.onclick = () => {
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b === btn));
      const v = btn.dataset.v, k = seg.dataset.seg;
      if (k === 'scale') selScale = Number(v);
      else if (k === 'file') selFile = v;
      else if (k === 'mode') selMode = v;
    }; });
  });

  const saveBtn = backdrop.querySelector('#exps-save');
  if (saveBtn) saveBtn.onclick = () => { _savePosterProject(p); cleanup(); };

  const goBtn = backdrop.querySelector('#exps-go');
  if (goBtn) goBtn.onclick = async () => {
    cleanup();
    // Aplica a proporção escolhida pelo MESMO seletor de formato (trata carrossel:
    // sincroniza todos os slides) e espera o re-render.
    const fsel = $('#p-format');
    if (fsel && fsel.value !== selFmt) {
      fsel.value = selFmt;
      if (typeof fsel.onchange === 'function') fsel.onchange();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    if (typeof _posterCommitFields === 'function') _posterCommitFields({ flush: true });
    else if (typeof savePosters === 'function') savePosters();
    if (isCar) exportCarousel(p, selMode, selScale, selFile);
    else exportPoster(p, selScale, selFile);
  };

  document.body.appendChild(backdrop);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => backdrop.classList.add('open'));
  else backdrop.classList.add('open');
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Lê um número de atributo/dataset com fallback SEGURO p/ o valor 0 (que `|| dflt`
// trocaria pelo default por ser falsy — bug que fazia posX/posY=0 virar 50 no preview).
function numAttr(v, dflt) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : dflt;
}

/**
 * Aplica enquadramento (pan + zoom) a UMA imagem via transform no wrapper.
 * Pan é translate em PX (não mais object-position): ganho uniforme e bordas reais
 * sempre alcançáveis em qualquer zoom, formato ou template. posX/posY ∈ [0,100]
 * (0 = borda esquerda/topo, 50 = centro, 100 = borda direita/base). Precisa do
 * tamanho natural carregado — por isso é chamada no load e a cada render/pan/zoom.
 */
/**
 * Geometria de pan/zoom de uma imagem: célula, tamanho natural, escala de cover e
 * o ZOOM MÍNIMO. `minScale` permite AFASTAR até a foto INTEIRA caber na célula
 * (contain) — assim o "recorte" do layout é só visual: a imagem original (cheia)
 * fica sempre acessível por arraste/zoom. Teto 0.5 (não sobe o piso de peças
 * antigas); piso 0.08 (evita zoom-out absurdo). 1 = cover (padrão, sem margens).
 */
function imgPanZoomGeom(img) {
  const wrap = img && img.parentElement && img.parentElement.closest('[data-zoomscale]');
  const cell = wrap && wrap.parentElement;
  if (!wrap || !cell) return null;
  const Wc = cell.offsetWidth, Hc = cell.offsetHeight;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!Wc || !Hc || !iw || !ih) return { wrap, cell, Wc, Hc, iw, ih, ok: false, minScale: 0.5 };
  const scaleCover = Math.max(Wc / iw, Hc / ih);
  const containRatio = Math.min(Wc / iw, Hc / ih) / scaleCover; // ≤ 1; foto inteira cabe
  const minScale = Math.max(0.08, Math.min(0.5, containRatio));
  return { wrap, cell, Wc, Hc, iw, ih, scaleCover, minScale, ok: true };
}

function applyImageTransform(img) {
  if (!img) return;
  const g = imgPanZoomGeom(img);
  if (!g) return;
  const sc = clamp(parseFloat(img.dataset.scale) || 1, g.minScale, 3);
  if (!g.ok) { g.wrap.style.transform = `translate(0px,0px) scale(${sc})`; return; }
  // PREVIEW ≡ EXPORT: a IMG é dimensionada no tamanho COVER (iw·scaleCover ×
  // ih·scaleCover) com object-fit:fill — a imagem INTEIRA cabe nessa caixa (mesma
  // proporção, sem distorção) e o wrap (scale+translate) faz zoom/pan. Assim ABAIXO
  // do cover (sc<1) a imagem encolhe e aparece INTEIRA (letterbox), idêntico ao PNG;
  // o object-fit:cover anterior recortava na caixa da célula e divergia no zoom-out.
  const coverW = g.iw * g.scaleCover;
  const coverH = g.ih * g.scaleCover;
  const cw = coverW + 'px', ch = coverH + 'px';
  if (img.style.width !== cw) img.style.width = cw;
  if (img.style.height !== ch) img.style.height = ch;
  if (img.style.objectFit !== 'fill') img.style.objectFit = 'fill';
  // Centraliza a IMG (que é MAIOR que a célula no cover) por posicionamento
  // ABSOLUTO — o flexbox faz clamp do overflow (justify-content:center não desloca
  // simetricamente itens que transbordam), o que quebrava o pan horizontal. O
  // pan/zoom continua no transform do wrapper; max-width:none anula resets.
  if (img.style.position !== 'absolute') img.style.position = 'absolute';
  if (img.style.left !== '50%') img.style.left = '50%';
  if (img.style.top !== '50%') img.style.top = '50%';
  if (img.style.transform !== 'translate(-50%, -50%)') img.style.transform = 'translate(-50%, -50%)';
  if (img.style.maxWidth !== 'none') img.style.maxWidth = 'none';
  // Curso máximo de pan (px) em cada eixo: metade do que sobra da imagem cover+zoom.
  // Abaixo do cover (sc < 1 em eixo) o curso é 0 → imagem centralizada com matte.
  const txMax = Math.max(0, (coverW * sc - g.Wc) / 2);
  const tyMax = Math.max(0, (coverH * sc - g.Hc) / 2);
  const posX = clamp(numAttr(img.dataset.posx, 50), 0, 100);
  const posY = clamp(numAttr(img.dataset.posy, 50), 0, 100);
  const tx = txMax * (1 - posX / 50);   // posX 0→+txMax (borda esq.); 100→−txMax (dir.)
  const ty = tyMax * (1 - posY / 50);
  g.wrap.style.transform = `translate(${tx}px,${ty}px) scale(${sc})`;
}

/** Reaplica o enquadramento a todas as imagens do escopo (no render e ao carregar). */
function applyAllImageTransforms(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-draggable]').forEach(img => {
    if (img.complete && img.naturalWidth) applyImageTransform(img);
    else img.addEventListener('load', () => applyImageTransform(img), { once: true });
  });
}

/**
 * Habilita drag-to-pan + zoom nas imagens com data-draggable dentro do stage.
 * - Arrastar: reposiciona enquadramento (pan via transform translate, em px)
 * - Scroll: zoom in/out (afasta até a foto INTEIRA caber na célula — contain)
 * - Duplo-clique: reseta pan (50%, 50%) e zoom (cover, scale 1)
 */
function setupImagePanning(stageEl) {
  if (!stageEl) return;
  // Idempotente: os listeners são DELEGADOS no #p-stage (que persiste entre
  // renders de innerHTML), então basta anexá-los UMA vez. Sem esse guard, cada
  // chamada (troca de slide/modelo/formato) adicionava novos listeners — o que
  // fazia o zoom por scroll multiplicar e o arraste disparar várias vezes.
  if (stageEl.__panningReady) return;
  stageEl.__panningReady = true;

  let dragging = null;
  // Pinça (2 dedos) = zoom no toque — o mobile não tinha zoom (só o scroll do
  // mouse no desktop). Rastreamos os ponteiros ativos sobre a MESMA imagem.
  let pinch = null;
  const activePointers = new Map();   // pointerId -> { x, y, field }
  const _pinchDist = () => {
    const p = [...activePointers.values()];
    return (p.length >= 2) ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
  };

  // --- "Revelar a sangria" durante a edição ---------------------------------
  // Ao arrastar / dar zoom, o preview RECUA (escala no #p-stage-wrap) e uma cópia
  // da imagem INTEIRA (ghost, em renderW×renderH) aparece atrás do quadro,
  // mostrando o que fica FORA do formato; uma máscara escurece a sangria e
  // destaca a moldura do recorte. (object-fit recorta a imagem na própria caixa,
  // então soltar overflow NÃO basta — o ghost é o que revela a área cortada.)
  // Tudo TRANSITÓRIO: restaurado ao soltar e antes de exportar.
  let reframe = null;

  // Retângulo da imagem cheia (px de célula) p/ o ghost — MESMA geometria do
  // preview/export (cover × zoom, centralizado, deslocado pelo pan).
  function reframeBox(img, g, sc) {
    const renderW = g.iw * g.scaleCover * sc;
    const renderH = g.ih * g.scaleCover * sc;
    const txMax = Math.max(0, (renderW - g.Wc) / 2);
    const tyMax = Math.max(0, (renderH - g.Hc) / 2);
    const posX = clamp(numAttr(img.dataset.posx, 50), 0, 100);
    const posY = clamp(numAttr(img.dataset.posy, 50), 0, 100);
    const tx = txMax * (1 - posX / 50);
    const ty = tyMax * (1 - posY / 50);
    return { renderW, renderH, dx: (g.Wc - renderW) / 2 + tx, dy: (g.Hc - renderH) / 2 + ty };
  }

  function enterReframe(img) {
    const g = imgPanZoomGeom(img);
    if (!g || !g.ok) return;
    if (reframe) {
      if (reframe.img === img) { if (reframe.timer) { clearTimeout(reframe.timer); reframe.timer = null; } return; }
      exitReframe(true);
    }
    const cell = g.cell;
    const poster = stageEl.querySelector('.poster-1440');
    const stageWrap = document.querySelector('#p-stage-wrap');
    const outer = document.querySelector('#p-stage-outer');
    if (!poster || !stageWrap || !outer) return;
    const sc = clamp(parseFloat(img.dataset.scale) || 1, g.minScale, 3);
    const b = reframeBox(img, g, sc);
    // 1) recua o preview o QUANTO for preciso p/ caber a imagem INTEIRA (ghost)
    //    com margem — assim a área que o formato corta fica visível ao redor.
    //    fitScale = escala atual da célula na tela (antes do recuo).
    const fitScale = (g.cell.getBoundingClientRect().width / g.Wc) || 0.3;
    let recede = Math.min((outer.clientWidth * 0.88) / (b.renderW * fitScale), (outer.clientHeight * 0.88) / (b.renderH * fitScale));
    recede = Math.max(0.3, Math.min(0.85, recede || 0.6));
    stageWrap.style.transformOrigin = 'center center';
    stageWrap.style.transition = 'transform .18s ease';
    stageWrap.style.transform = `scale(${recede})`;
    // 2) relaxa o overflow do caminho célula → poster (deixa o ghost transbordar)
    const restores = [];
    let n = cell;
    while (n) {
      if (getComputedStyle(n).overflow !== 'visible') { restores.push({ el: n, ov: n.style.overflow }); n.style.overflow = 'visible'; }
      if (n === poster) break;
      n = n.parentElement;
    }
    // 3) ghost = imagem inteira atrás, revelando a área cortada pelo formato
    const ghost = document.createElement('img');
    ghost.src = img.src;
    ghost.className = 'reframe-ghost';
    ghost.style.cssText = `position:absolute;left:${b.dx}px;top:${b.dy}px;width:${b.renderW}px;height:${b.renderH}px;pointer-events:none;z-index:0;`;
    cell.insertBefore(ghost, cell.firstChild);
    // 4) máscara: escurece tudo FORA do quadro (a sangria) + contorna a moldura
    const mask = document.createElement('div');
    mask.className = 'reframe-mask';
    mask.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:60;'
      + 'box-shadow:0 0 0 3000px rgba(8,7,5,0.6);'
      + 'outline:2px solid rgba(255,255,255,0.95);outline-offset:-1px;';
    cell.appendChild(mask);
    reframe = { img, cell, g, ghost, mask, restores, stageWrap, timer: null };
  }

  // Mantém o ghost em sincronia com o enquadramento durante o arraste/zoom.
  function syncReframe() {
    if (!reframe) return;
    const sc = clamp(parseFloat(reframe.img.dataset.scale) || 1, reframe.g.minScale, 3);
    const b = reframeBox(reframe.img, reframe.g, sc);
    const s = reframe.ghost.style;
    s.left = b.dx + 'px'; s.top = b.dy + 'px'; s.width = b.renderW + 'px'; s.height = b.renderH + 'px';
  }

  function exitReframe(instant) {
    if (!reframe) return;
    const r = reframe; reframe = null;
    if (r.timer) clearTimeout(r.timer);
    if (r.ghost && r.ghost.parentNode) r.ghost.remove();
    if (r.mask && r.mask.parentNode) r.mask.remove();
    r.restores.forEach(x => { x.el.style.overflow = x.ov || ''; });
    if (r.stageWrap) {
      if (instant) r.stageWrap.style.transition = 'none';
      r.stageWrap.style.transform = '';
      r.stageWrap.style.transformOrigin = '';
      if (instant) r.stageWrap.style.transition = '';
      else setTimeout(() => { if (r.stageWrap) r.stageWrap.style.transition = ''; }, 220);
    }
  }
  // exposto p/ a exportação garantir estado limpo (defensivo)
  stageEl.__exitReframe = () => exitReframe(true);

  function saveField(img, field) {
    const poster = State.posters.find(p => p.id === State.activePosterId);
    if (!poster) return;
    // Em carrossel, o pan/zoom pertence ao SLIDE ativo (não ao cartaz).
    const tgt = (typeof getSlide === 'function') ? getSlide(poster) : poster;
    const g = imgPanZoomGeom(img);
    tgt[field + 'PosX'] = clamp(numAttr(img.dataset.posx, 50), 0, 100);
    tgt[field + 'PosY'] = clamp(numAttr(img.dataset.posy, 50), 0, 100);
    tgt[field + 'Scale'] = clamp(parseFloat(img.dataset.scale) || 1, g ? g.minScale : 0.5, 3);
    poster.updatedAt = new Date().toISOString();
    savePosters();
  }

  function onPointerDown(e) {
    const img = e.target.closest('[data-draggable]');
    if (!img || !img.src || e.button !== 0) return;
    const g = imgPanZoomGeom(img);
    if (!g || !g.ok) return;
    const rect = g.cell.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    e.preventDefault();
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, field: img.dataset.draggable });

    // 2º dedo na MESMA imagem → vira PINÇA (zoom). Cancela o pan de 1 dedo.
    if (activePointers.size === 2) {
      const fs = [...activePointers.values()].map(pt => pt.field);
      if (fs[0] === fs[1]) {
        if (dragging) { dragging.img.style.cursor = 'grab'; dragging = null; }
        const minS = g ? g.minScale : 0.5;
        pinch = { img, field: img.dataset.draggable, startDist: _pinchDist() || 1,
                  startScale: clamp(parseFloat(img.dataset.scale) || 1, minS, 3), minS };
        enterReframe(img);
        return;
      }
    }
    if (activePointers.size >= 2) return;   // >2 dedos ou dedos em imagens diferentes: ignora

    // Curso de pan (px de célula) idêntico ao usado no preview/export.
    const sc = clamp(parseFloat(img.dataset.scale) || 1, g.minScale, 3);
    const txMax = Math.max(0, (g.iw * g.scaleCover * sc - g.Wc) / 2);
    const tyMax = Math.max(0, (g.ih * g.scaleCover * sc - g.Hc) / 2);
    const posX = clamp(numAttr(img.dataset.posx, 50), 0, 100);
    const posY = clamp(numAttr(img.dataset.posy, 50), 0, 100);
    img.style.cursor = 'grabbing';
    dragging = {
      img, wrap: g.wrap, field: img.dataset.draggable,
      startX: e.clientX, startY: e.clientY,
      txMax, tyMax, sc,
      stageScale: (rect.width / g.Wc) || 1,   // #p-stage é escalado p/ caber no painel
      startTx: txMax * (1 - posX / 50),
      startTy: tyMax * (1 - posY / 50),
    };
    enterReframe(img);   // revela a sangria enquanto arrasta
  }

  function onPointerMove(e) {
    // mantém a posição dos ponteiros ativos (pan e pinça leem daqui)
    const rec = activePointers.get(e.pointerId);
    if (rec) { rec.x = e.clientX; rec.y = e.clientY; }

    // PINÇA: escala pela razão entre a distância atual e a inicial dos 2 dedos.
    if (pinch && activePointers.size >= 2) {
      e.preventDefault();
      const factor = _pinchDist() / (pinch.startDist || 1);
      pinch.img.dataset.scale = clamp(pinch.startScale * factor, pinch.minS, 3);
      applyImageTransform(pinch.img);
      syncReframe();
      return;
    }

    if (!dragging) return;
    e.preventDefault();
    const d = dragging;
    // Drag em px de tela → px de célula (descontando a escala do stage).
    const dxCell = (e.clientX - d.startX) / d.stageScale;
    const dyCell = (e.clientY - d.startY) / d.stageScale;
    const tx = clamp(d.startTx + dxCell, -d.txMax, d.txMax);
    const ty = clamp(d.startTy + dyCell, -d.tyMax, d.tyMax);
    const posX = d.txMax > 0 ? 50 * (1 - tx / d.txMax) : 50;
    const posY = d.tyMax > 0 ? 50 * (1 - ty / d.tyMax) : 50;
    d.img.dataset.posx = posX;
    d.img.dataset.posy = posY;
    d.wrap.style.transform = `translate(${tx}px,${ty}px) scale(${d.sc})`;
    syncReframe();   // acompanha o enquadramento com o ghost da sangria
  }

  function onPointerUp(e) {
    activePointers.delete(e.pointerId);
    // Fim da pinça quando sobra menos de 2 dedos. Não reinicia pan com o dedo
    // restante (evita salto) — o usuário faz um novo toque pra arrastar.
    if (pinch) {
      if (activePointers.size < 2) {
        saveField(pinch.img, pinch.field);
        pinch = null;
        exitReframe();
      }
      return;
    }
    if (!dragging) return;
    dragging.img.style.cursor = 'grab';
    saveField(dragging.img, dragging.field);
    dragging = null;
    exitReframe();   // re-clipa o quadro ao soltar
  }

  // pointerdown no stage, mas move/up no document para capturar
  // movimentos verticais sem interferência de scroll do .main
  stageEl.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);

  // Scroll = zoom in/out. Recalcula o transform (o curso de pan muda com o zoom),
  // preservando o ponto de enquadramento (posX/posY).
  stageEl.addEventListener('wheel', (e) => {
    const img = e.target.closest('[data-draggable]');
    if (!img || !img.src) return;
    e.preventDefault();
    const field = img.dataset.draggable;
    const g = imgPanZoomGeom(img);
    const minS = g ? g.minScale : 0.5;
    const curScale = clamp(parseFloat(img.dataset.scale) || 1, minS, 3);
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    img.dataset.scale = clamp(curScale * factor, minS, 3);
    applyImageTransform(img);
    saveField(img, field);
    // revela a sangria durante o zoom e recolhe após uma pausa
    if (g && g.ok) {
      enterReframe(img); syncReframe();
      if (reframe) { if (reframe.timer) clearTimeout(reframe.timer); reframe.timer = setTimeout(() => exitReframe(), 650); }
    }
  }, { passive: false });

  // Duplo-clique: reseta pan + zoom
  stageEl.addEventListener('dblclick', (e) => {
    const img = e.target.closest('[data-draggable]');
    if (!img) return;
    const field = img.dataset.draggable;
    img.dataset.posx = '50';
    img.dataset.posy = '50';
    img.dataset.scale = '1';
    applyImageTransform(img);
    saveField(img, field);
  });
}
function initPortalForm() {
  if (!$('#s-portal-name')) return;
  let editIdx = State.activePortalIndex;

  function getPortal() { return State.portals[editIdx] || State.portals[0]; }

  function loadForm() {
    const p = getPortal();
    $('#s-portal-name').value = p.name || '';
    $('#s-portal-handle').value = p.handle || '';
    $('#s-portal-location').value = p.location || '';
    $('#s-portal-tagline').value = p.tagline || '';
    if ($('#s-portal-theme')) $('#s-portal-theme').value = p.theme || 'neutral';
    refreshLogoPreview();
    updateTabs();
    if (typeof _syncPickerRow === 'function') _syncPickerRow('s-portal-theme');   // linha do picker acompanha o slot
  }

  function savePortalToState() {
    const p = getPortal();
    p.name = $('#s-portal-name').value.trim() || 'Portal';
    p.acronym = p.acronym || (p.name ? p.name.split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase() : 'PT');
    p.handle = $('#s-portal-handle').value.trim() || '@portal';
    p.location = $('#s-portal-location').value.trim() || 'Salvador, BA';
    p.tagline = $('#s-portal-tagline').value.trim() || '';
    if ($('#s-portal-theme')) p.theme = $('#s-portal-theme').value || p.theme || 'neutral';
    // logo is handled separately
    saveJSON(STORAGE_KEYS.portals, State.portals);
    updatePortalSummary();
  }

  function updateTabs() {
    document.querySelectorAll('.portal-tab').forEach(tab => {
      const idx = parseInt(tab.dataset.idx);
      tab.classList.toggle('active', idx === editIdx);
      tab.classList.toggle('active-portal', idx === State.activePortalIndex);
    });
    const badge = $('#p-portal-active-badge');
    badge.textContent = editIdx === State.activePortalIndex ? '★ Ativo (usado nos cartazes)' : 'Clique "Definir como ativo" para usar';
    badge.style.color = editIdx === State.activePortalIndex ? 'var(--accent)' : 'var(--ink-mute)';
  }

  // Logo upload
  const logoPreview = $('#s-portal-logo-preview');
  const logoUpload = $('#s-portal-logo-upload');
  const logoFile = $('#s-portal-logo-file');
  const logoClear = $('#s-portal-logo-clear');

  function refreshLogoPreview() {
    const p = getPortal();
    // Só data-URLs de imagem (vêm do FileReader) — nunca injetar outra string como src.
    if (p.logo && /^data:image\//.test(String(p.logo))) {
      logoPreview.innerHTML = '';
      const img = document.createElement('img');
      img.src = p.logo;
      img.setAttribute('style', 'width: 100%; height: 100%; object-fit: cover; display: block;');
      img.alt = '';
      logoPreview.appendChild(img);
      logoClear.classList.remove('hidden');
    } else {
      logoPreview.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
      logoClear.classList.add('hidden');
    }
  }

  logoUpload.onclick = () => logoFile.click();

  // Troca de tema do portal — grava e re-renderiza o preview na hora (se for o ativo).
  const themeSel = $('#s-portal-theme');
  if (themeSel) themeSel.onchange = () => {
    const p = getPortal();
    p.theme = themeSel.value || 'neutral';
    saveJSON(STORAGE_KEYS.portals, State.portals);
    updatePortalSummary();
    if (editIdx === State.activePortalIndex && typeof renderPosterTemplate === 'function') {
      const ap = State.posters && State.posters.find(x => x.id === State.activePosterId);
      if (ap) renderPosterTemplate(ap);
    }
  };

  logoFile.onchange = async () => {
    const file = logoFile.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Apenas imagens são aceitas.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('A imagem é muito grande (máximo 5 MB).', 'error'); return; }
    try {
      const base64 = await fileToBase64Compressed(file, 400, 0.9);
      getPortal().logo = base64;
      saveJSON(STORAGE_KEYS.portals, State.portals);
      refreshLogoPreview();
      const active = State.posters.find(p => p.id === State.activePosterId);
      if (active) { renderPosterTemplate(active); requestAnimationFrame(() => fitPosterPreview()); }
      toast('Logo adicionada.', 'success');
    } catch (err) {
      toast('Não foi possível adicionar a logo: ' + err.message, 'error');
    }
    logoFile.value = '';
  };

  logoClear.onclick = () => {
    getPortal().logo = null;
    saveJSON(STORAGE_KEYS.portals, State.portals);
    refreshLogoPreview();
    const active = State.posters.find(p => p.id === State.activePosterId);
    if (active) { renderPosterTemplate(active); requestAnimationFrame(() => fitPosterPreview()); }
    toast('Logo removida.', 'success');
  };

  // Tabs: clicar muda o portal editado
  document.querySelectorAll('.portal-tab').forEach(tab => {
    tab.onclick = () => {
      editIdx = parseInt(tab.dataset.idx);
      loadForm();
    };
  });

  // Botão "Definir como ativo"
  $('#s-portal-set-active').onclick = () => {
    savePortalToState();
    State.activePortalIndex = editIdx;
    saveJSON(STORAGE_KEYS.portals, State.portals);
    updateTabs();
    updatePortalSummary();
    const active = State.posters.find(p => p.id === State.activePosterId);
    if (active) { renderPosterTemplate(active); requestAnimationFrame(() => fitPosterPreview()); }
    toast('Perfil ' + (editIdx + 1) + ' definido como ativo.', 'success');
  };

  $('#s-portal-save').onclick = () => {
    savePortalToState();
    const active = State.posters.find(p => p.id === State.activePosterId);
    if (active) { renderPosterTemplate(active); requestAnimationFrame(() => fitPosterPreview()); }
    toast('Perfil do usuário salvo.', 'success');
  };

  loadForm();
  updatePortalSummary();   // resumo no cabeçalho do painel Perfil desde o 1º render
  // r102: dentro do painel Perfil o bloco fica SEMPRE aberto (o colapsável era
  // chrome redundante — a aba já é a área dedicada do perfil). CSS aplana o visual.
  const det = $('#p-portal-block');
  if (det) det.open = true;
}

function updatePortalSummary() {
  const el = $('#p-portal-info');
  if (!el) return;
  const p = State.portals[State.activePortalIndex] || State.portals[0] || {};
  const label = 'Perfil ' + (State.activePortalIndex + 1) + ':';
  const parts = [p.name, p.handle].filter(Boolean);
  if (p.logo) parts.push('✓ logo');
  el.textContent = label + ' ' + (parts.length ? parts.join(' · ') : 'Configure o nome do perfil');
}

