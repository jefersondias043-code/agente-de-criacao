'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

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
  let m = text.match(/([A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+)*)\s*\/\s*BA/i);
  if (m) return `${m[1].trim()}, BA`;
  m = text.match(/([A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+)*)\s*,\s*BA/i);
  if (m) return `${m[1].trim()}, BA`;
  m = text.match(/\bem\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇÑ][a-záàâãéêíóôõúç]+)*)/);
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

function createPosterFromGeneration(g) {
  const parsed = parseFromText(g.content);
  const struct = parseGenerationStructure(g.content);

  // Headline: prioriza título estruturado; cai para o parser antigo se vazio
  const headline = struct.title || parsed.headline;
  // Subtítulo: prioriza parser estruturado, depois parser simples
  const subtitle = struct.subtitle || parsed.subtitle || '';
  // Descrição (= lead da matéria, resumo abaixo do título no cartaz)
  const description = struct.description || '';

  const poster = {
    id: uuid(),
    generationId: g.id,
    template: 'manchete',
    format: '3:4',
    headline,
    category: parsed.category,
    location: parsed.location,
    subtitle,
    description,
    footer: parsed.footer,
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
  saveJSON(STORAGE_KEYS.posters, State.posters);
  State.activePosterId = poster.id;
  toast('Cartaz criado.', 'success');
  goTo('posters');
}

function renderPosters() {
  initPortalForm();
  if (!State.posters.length) {
    $('#p-empty').classList.remove('hidden');
    $('#p-content').classList.add('hidden');
    $('#p-new').onclick = () => createBlankPoster();
    return;
  }
  $('#p-empty').classList.add('hidden');
  $('#p-content').classList.remove('hidden');

  if (!State.activePosterId || !State.posters.find(p => p.id === State.activePosterId)) {
    State.activePosterId = State.posters[0].id;
  }
  renderPostersList();
  renderPosterEditor();

  $('#p-new').onclick = () => createBlankPoster();
  setupPostersChrome();
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
  saveJSON(STORAGE_KEYS.posters, State.posters);
  State.activePosterId = poster.id;
  renderPosters();
  toast('Cartaz criado.', 'success');
}

function renderPostersList() {
  $('#p-list').innerHTML = State.posters.map(p => {
    const isCar = (typeof posterIsCarousel === 'function' && posterIsCarousel(p));
    const title = (typeof posterDisplayTitle === 'function') ? posterDisplayTitle(p) : p.headline;
    const cat = (typeof posterDisplayCategory === 'function') ? posterDisplayCategory(p) : p.category;
    const carBadge = isCar
      ? `<span class="badge" style="font-size: 0.65rem; background:#16140f; color:#fff;">▤ Carrossel · ${p.slides.length}</span>`
      : '';
    return `
    <div class="list-item ${State.activePosterId === p.id ? 'active' : ''}" data-pid="${p.id}">
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
    el.onclick = () => {
      State.activePosterId = el.dataset.pid;
      renderPostersList();
      renderPosterEditor();
      if (typeof closeHistoryDrawer === 'function') closeHistoryDrawer();   // fecha o painel ao escolher
    };
  });
}

function renderPosterEditor() {
  const p = State.posters.find(x => x.id === State.activePosterId);
  if (!p) return;

  // Alvo de edição: o próprio cartaz, ou o SLIDE ativo se for carrossel.
  // (getSlide devolve o próprio p quando não há slides → cartaz único intacto.)
  const s = (typeof getSlide === 'function') ? getSlide(p) : p;

  // Barra de carrossel (slides) — additiva; fica vazia p/ cartaz único.
  if (typeof renderCarouselBar === 'function') renderCarouselBar(p);

  // Preencher campos com valores do alvo (cartaz ou slide)
  $('#p-headline').value = s.headline || '';
  $('#p-category').value = s.category || '';
  $('#p-location').value = s.location || '';
  $('#p-subtitle').value = s.subtitle || '';
  if ($('#p-description')) $('#p-description').value = s.description || '';
  if ($('#p-template')) $('#p-template').value = s.template || 'manchete';
  if ($('#p-format')) $('#p-format').value = s.format || '3:4';
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
  const updateMosaicControl = () => {
    const field = $('#p-mosaic-field'); const sel = $('#p-mosaic');
    if (!field || !sel) return;
    const tpl = $('#p-template') ? $('#p-template').value : (s.template || '');
    const nImg = (typeof posterImageKeys === 'function'
      ? posterImageKeys(s)
      : [s.image1, s.image2, s.image3, s.image4].filter(Boolean)).length;
    const isMultiImage = /^(manchete|destaque-foto|headline-premium|photo-story|carousel-cover)/.test(tpl);
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
    show('p-pf-name-field', person);
    show('p-pf-role-field', person);
    show('p-pf-figure-field', tpl === 'numbers-data');
    show('p-pf-labels-row', tpl === 'comparison');
    // Seção recolhível "Texto longo": abre automaticamente p/ os modelos que
    // dependem do corpo (Texto/Tópicos); recolhida nos demais p/ poupar rolagem.
    const txt = $('#p-text-section');
    if (txt) txt.open = (tpl === 'texto' || tpl === 'topicos');
  };
  const onMediaChange = () => { updateProgressiveVisibility(); updateMosaicControl(); };

  // Inicializa previews das 4 mídias + avatar
  setupMediaUpload(s, 'image1', 'p-image1', onMediaChange);
  setupMediaUpload(s, 'image2', 'p-image2', onMediaChange);
  setupMediaUpload(s, 'image3', 'p-image3', onMediaChange);
  setupMediaUpload(s, 'image4', 'p-image4', onMediaChange);
  setupMediaUpload(s, 'avatar', 'p-avatar');
  updateProgressiveVisibility();
  updateMosaicControl();
  updateExtraFields();

  // Live preview: cada campo atualiza o cartaz em tempo real
  const updatePreview = () => {
    const draft = {
      ...s,
      portalSnapshot: p.portalSnapshot,
      ...((typeof posterIsCarousel === 'function' && posterIsCarousel(p)) ? { _idx: (p.slideIndex || 0) + 1, _total: p.slides.length } : {}),
      template: $('#p-template') ? $('#p-template').value : (s.template || 'manchete'),
      format: $('#p-format') ? $('#p-format').value : (s.format || '3:4'),
      headline: $('#p-headline').value,
      category: ($('#p-category').value || '').toUpperCase(),
      location: $('#p-location').value,
      subtitle: $('#p-subtitle').value,
      description: $('#p-description') ? $('#p-description').value : s.description,
      mosaic: $('#p-mosaic') ? $('#p-mosaic').value : s.mosaic,
      theme: $('#p-theme') ? $('#p-theme').value : p.theme,   // tema é do CARTAZ (não do slide)
      personName: $('#p-person-name') ? $('#p-person-name').value : s.personName,
      personRole: $('#p-person-role') ? $('#p-person-role').value : s.personRole,
      figure: $('#p-figure') ? $('#p-figure').value : s.figure,
      labelA: $('#p-label-a') ? $('#p-label-a').value : s.labelA,
      labelB: $('#p-label-b') ? $('#p-label-b').value : s.labelB,
    };
    renderPosterTemplate(draft);
    updateCounters();
  };

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

  ['p-headline', 'p-category', 'p-location', 'p-subtitle', 'p-description',
   'p-person-name', 'p-person-role', 'p-figure', 'p-label-a', 'p-label-b'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.oninput = updatePreview;
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
      saveJSON(STORAGE_KEYS.posters, State.posters);
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
      saveJSON(STORAGE_KEYS.posters, State.posters);
      refreshElementEyes();
      updatePreview();
    };
  });
  refreshElementEyes();

  // Tema do CARTAZ: persiste em p.theme AO VIVO (não só no Salvar) → o export do
  // carrossel (que re-renderiza por p.theme) bate com o preview mesmo sem salvar.
  if ($('#p-theme')) {
    $('#p-theme').onchange = () => {
      p.theme = $('#p-theme').value;
      p.updatedAt = new Date().toISOString();
      saveJSON(STORAGE_KEYS.posters, State.posters);
      if (typeof renderCarouselBar === 'function' && typeof posterIsCarousel === 'function' && posterIsCarousel(p)) renderCarouselBar(p);
      updatePreview();
    };
  }

  // Troca de modelo/formato: persiste e re-renderiza (re-ativa pan pois alguns
  // modelos passam a usar imagem arrastável, e o formato muda as dimensões).
  ['p-template', 'p-format'].forEach(id => {
    const el = $(`#${id}`);
    if (!el) return;
    el.onchange = () => {
      s.template = $('#p-template') ? $('#p-template').value : s.template;
      const newFmt = $('#p-format') ? $('#p-format').value : s.format;
      s.format = newFmt;
      // FORMATO é propriedade do CONJUNTO no carrossel: sincroniza TODOS os
      // slides + o nível do carrossel (o usuário muda uma vez e vale p/ todos).
      if (typeof posterIsCarousel === 'function' && posterIsCarousel(p)) {
        p.format = newFmt;
        p.slides.forEach(sl => { sl.format = newFmt; });
        if (typeof renderCarouselBar === 'function') renderCarouselBar(p);
      }
      p.updatedAt = new Date().toISOString();
      saveJSON(STORAGE_KEYS.posters, State.posters);
      updateMosaicControl();
      updateExtraFields();
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
      saveJSON(STORAGE_KEYS.posters, State.posters);
      updatePreview();
      requestAnimationFrame(() => {
        fitPosterPreview();
        setupImagePanning($('#p-stage'));
        if (typeof posterIsCarousel === 'function' && posterIsCarousel(p) && typeof renderCarouselBar === 'function') renderCarouselBar(p);
      });
    };
  }

  // Tema visual do CARTAZ (override do tema do portal; '' = herda). É nível-cartaz.
  if ($('#p-theme')) {
    $('#p-theme').onchange = () => {
      p.theme = $('#p-theme').value;
      p.updatedAt = new Date().toISOString();
      saveJSON(STORAGE_KEYS.posters, State.posters);
      updatePreview();
      requestAnimationFrame(() => {
        fitPosterPreview();
        setupImagePanning($('#p-stage'));
        if (typeof posterIsCarousel === 'function' && posterIsCarousel(p) && typeof renderCarouselBar === 'function') renderCarouselBar(p);
      });
    };
  }

  updatePreview();
  requestAnimationFrame(() => {
    fitPosterPreview();
    setupImagePanning($('#p-stage'));
  });

  // Aplica os valores atuais do editor a um alvo (cartaz ou slide).
  const applyEditorTo = (t) => {
    t.headline = $('#p-headline').value;
    t.category = ($('#p-category').value || '').toUpperCase();
    t.location = $('#p-location').value;
    t.subtitle = $('#p-subtitle').value;
    if ($('#p-description')) t.description = $('#p-description').value;
    if ($('#p-template')) t.template = $('#p-template').value;
    if ($('#p-format')) t.format = $('#p-format').value;
    if ($('#p-person-name')) t.personName = $('#p-person-name').value;
    if ($('#p-person-role')) t.personRole = $('#p-person-role').value;
    if ($('#p-figure')) t.figure = $('#p-figure').value;
    if ($('#p-label-a')) t.labelA = $('#p-label-a').value;
    if ($('#p-label-b')) t.labelB = $('#p-label-b').value;
  };
  const isCarousel = () => (typeof posterIsCarousel === 'function' && posterIsCarousel(p));

  $('#p-save').onclick = () => {
    applyEditorTo(s);
    if ($('#p-theme')) p.theme = $('#p-theme').value;   // tema é do cartaz (nível p)
    p.updatedAt = new Date().toISOString();
    saveJSON(STORAGE_KEYS.posters, State.posters);
    renderPostersList();
    toast(isCarousel() ? 'Carrossel salvo.' : 'Cartaz salvo.', 'success');
  };

  $('#p-delete').onclick = () => {
    if (!confirm('Remover este cartaz?')) return;
    State.posters = State.posters.filter(x => x.id !== p.id);
    saveJSON(STORAGE_KEYS.posters, State.posters);
    State.activePosterId = State.posters[0]?.id || null;
    renderPosters();
    toast('Cartaz removido.', 'success');
  };

  // Exportação: cartaz único → "Exportar PNG"; carrossel → "Exportar imagens" OU ".zip"
  const car = isCarousel();
  const toggleBtn = (id, show) => { const el = $(`#${id}`); if (el) el.classList.toggle('hidden', !show); };
  toggleBtn('p-export', !car);
  toggleBtn('p-export-imgs', car);
  toggleBtn('p-export-zip', car);

  const doExport = (fn) => {
    applyEditorTo(s); // aplica valores atuais ao alvo (cartaz ou slide ativo)
    saveJSON(STORAGE_KEYS.posters, State.posters);
    fn();
  };
  $('#p-export').onclick = () => doExport(() => exportPoster(p));
  if ($('#p-export-imgs')) $('#p-export-imgs').onclick = () => doExport(() => exportCarousel(p, 'images'));
  if ($('#p-export-zip')) $('#p-export-zip').onclick = () => doExport(() => exportCarousel(p, 'zip'));
}

/**
 * Configura um uploader de mídia (clique para escolher arquivo,
 * lê como base64 e salva no objeto poster).
 */
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
      saveJSON(STORAGE_KEYS.posters, State.posters);
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
    saveJSON(STORAGE_KEYS.posters, State.posters);
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

  // Avatar centralizado entre as imagens (overlay) — moldura creme premium
  const avatarOverlayHtml = p.avatar
    ? `<img src="${p.avatar}" style="width: 130px; height: 130px; border-radius: 50%; object-fit: cover; display: block; border: 5px solid #F5F0E7; box-shadow: 0 8px 24px rgba(0,0,0,0.28);" alt="" crossorigin="anonymous" />`
    : `<div style="width: 130px; height: 130px; border-radius: 50%; background: #17130D; color: #F5F0E7; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 900; font-size: 48px; border: 5px solid #F5F0E7; box-shadow: 0 8px 24px rgba(0,0,0,0.28);">
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

/** Formato (dimensões) do cartaz/slide ativo (em carrossel, o do slide visível). */
function posterActiveFormat() {
  const p = State.posters.find(x => x.id === State.activePosterId);
  const src = (p && typeof getSlide === 'function') ? getSlide(p) : p;
  const f = (src && typeof POSTER_FORMATS !== 'undefined' && POSTER_FORMATS[src.format]);
  return f || { w: 1080, h: 1440 };
}

/** Renderiza o cartaz escolhendo template + formato (delega ao catálogo). */
function renderPosterTemplate(p) {
  const portal = { ...(p.portalSnapshot || {}), ...(State.portals[State.activePortalIndex] || State.portals[0] || {}) };
  const fmt = (typeof POSTER_FORMATS !== 'undefined' && POSTER_FORMATS[p.format]) || { w: 1080, h: 1440 };
  const reg = (typeof POSTER_TEMPLATES !== 'undefined') ? POSTER_TEMPLATES : null;
  const tpl = (reg && reg[p.template]) || (reg && reg.manchete);
  if (typeof applyTheme === 'function') applyTheme(p.theme || portal.theme);   // tema do cartaz (override) ou do portal
  if (typeof setPosterHidden === 'function') setPosterHidden(p);   // elementos ocultos (olho) ativos neste render
  $('#p-stage').innerHTML = tpl ? tpl.render(p, fmt, portal) : tplManchete(p, fmt, portal);
  fitPosterPreview();
  applyAllImageTransforms($('#p-stage'));
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
  const availableHeight = Math.max(240, window.innerHeight - 160 - padY);
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
async function captureStageCanvas(fmt) {
  const stage = $('#p-stage');
  const wrap = $('#p-stage-wrap');
  const target = stage && stage.querySelector('.poster-1440');
  if (!stage || !wrap || !target) return null;
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
    cvs.width = W;
    cvs.height = H;
    cvs.style.cssText = 'display: block; width: 100%; height: 100%;';
    const ctx = cvs.getContext('2d');

    // Enquadramento desenhado por RETÂNGULO DE DESTINO (preserva a proporção em
    // QUALQUER zoom). Mesma geometria do preview (applyImageTransform): a imagem
    // (cheia, original) é cover-fit centralizada, escalada por `scale` e deslocada
    // por (tx,ty). Ao AFASTAR além do cover, a imagem fica MENOR que a célula e as
    // margens transparentes do canvas revelam o matte (cor da junção) → a foto
    // INTEIRA aparece, sem distorção nem recorte permanente. posX/posY 0..100 = bordas.
    const scaleCover = Math.max(W / iw, H / ih);
    const sc = clamp(scale, 0.05, 3);
    const renderW = iw * scaleCover * sc;
    const renderH = ih * scaleCover * sc;
    const txMax = Math.max(0, (renderW - W) / 2);
    const tyMax = Math.max(0, (renderH - H) / 2);
    const tx = txMax * (1 - clamp(posX, 0, 100) / 50);
    const ty = tyMax * (1 - clamp(posY, 0, 100) / 50);
    const dx = (W - renderW) / 2 + tx;
    const dy = (H - renderH) / 2 + ty;
    // Recorte DIAGONAL (mosaicos com data-clip): clipa o canvas no MESMO polígono
    // que o clip-path usa no preview — assim a forma diagonal sobrevive ao PNG.
    const clipPts = container.dataset.clip;
    if (clipPts) {
      ctx.save();
      ctx.beginPath();
      clipPts.split(',').forEach((s, i) => {
        const xy = s.trim().split(/\s+/).map(Number);
        const X = (xy[0] / 100) * W, Y = (xy[1] / 100) * H;
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      });
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(img, dx, dy, renderW, renderH);
    if (clipPts) ctx.restore();

    snapshots.push({ container, wrapEl, cvs });
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
    lc.width = lw; lc.height = lh;
    lc.style.cssText = `display:block;width:${lw}px;height:${lh}px;flex-shrink:0;`;
    const lctx = lc.getContext('2d');
    if (radius > 0 && typeof _mbRoundRect === 'function') { _mbRoundRect(lctx, 0, 0, lw, lh, radius); lctx.clip(); }
    const sCover = Math.max(lw / iw, lh / ih);   // cover: preenche, recorta o excedente
    const rW = iw * sCover, rH = ih * sCover;
    lctx.drawImage(logo, (lw - rW) / 2, (lh - rH) / 2, rW, rH);
    logo.style.display = 'none';
    logo.parentNode.insertBefore(lc, logo);
    snapshots.push({ wrapEl: logo, cvs: lc });   // restaurado no finally (display + remove)
  }

  try {
    return await html2canvas(target, {
      width: fmt.w,
      height: fmt.h,
      scale: 1,
      backgroundColor: '#FFFFFF',
      useCORS: true,
      logging: false,
    });
  } finally {
    for (const s of snapshots) {
      if (s.cvs && s.cvs.parentNode) s.cvs.remove();
      if (s.wrapEl) s.wrapEl.style.display = '';
    }
    for (const r of ellipsisRestores) { r.el.textContent = r.text; }   // restaura o texto original
    target.classList.remove('exporting');
    stage.style.transform = originalTransform;
    wrap.style.width = originalWrapW;
    wrap.style.height = originalWrapH;
  }
}

async function exportPoster(p) {
  toast('Gerando o cartaz em alta resolução…', 'info');
  try {
    const canvas = await captureStageCanvas(posterActiveFormat());
    if (!canvas) { toast('Não foi possível exportar.', 'error'); return; }
    const link = document.createElement('a');
    link.download = `cartaz-${(p.headline || 'export').slice(0, 40).replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Cartaz exportado.', 'success');
  } catch (err) {
    toast('Não foi possível exportar: ' + err.message, 'error');
  } finally {
    fitPosterPreview();
  }
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
    saveJSON(STORAGE_KEYS.posters, State.posters);
  }

  function onPointerDown(e) {
    const img = e.target.closest('[data-draggable]');
    if (!img || !img.src || e.button !== 0) return;
    const g = imgPanZoomGeom(img);
    if (!g || !g.ok) return;
    const rect = g.cell.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    e.preventDefault();
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
    if ($('#s-portal-theme')) $('#s-portal-theme').value = p.theme || (editIdx === 0 ? 'municipios-bahia' : 'neutral');
    refreshLogoPreview();
    updateTabs();
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
    toast('Portal ' + (editIdx + 1) + ' definido como ativo.', 'success');
  };

  $('#s-portal-save').onclick = () => {
    savePortalToState();
    const active = State.posters.find(p => p.id === State.activePosterId);
    if (active) { renderPosterTemplate(active); requestAnimationFrame(() => fitPosterPreview()); }
    toast('Dados do portal salvos.', 'success');
  };

  loadForm();
}

function updatePortalSummary() {
  const el = $('#p-portal-info');
  if (!el) return;
  const p = State.portals[State.activePortalIndex] || State.portals[0] || {};
  const label = 'Portal ' + (State.activePortalIndex + 1) + ':';
  const parts = [p.name, p.handle].filter(Boolean);
  if (p.logo) parts.push('✓ logo');
  el.textContent = label + ' ' + (parts.length ? parts.join(' · ') : 'Configure o nome do portal');
}

