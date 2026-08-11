'use strict';
/* ============================================================
   APP — orquestração: assistente em 3 etapas (Enviar · Revisar ·
   Pacote), delegação de eventos, caixa única de entrada e boot.

   Fluxo: o usuário envia áudio/vídeo/imagem/PDF/texto → o app
   transcreve/extrai → mostra o texto EDITÁVEL para revisão + as
   opções de geração → o usuário confere/ajusta e gera o pacote.
   Cada item do pacote (título, legenda, hashtags, palavras-chave)
   pode ser regenerado sozinho, e o pacote pronto tem compartilhar
   nativo (Share Sheet) além de copiar.
   ============================================================ */

// Estado passado da etapa de revisão para a de geração.
let _revisao = null;

// Rótulos das opções de saída (viram texto de prompt para a IA).
const LABEL_PLATAFORMA = { tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts' };
const LABEL_TOM = {
  espontaneo: 'Espontâneo, como uma conversa real',
  profissional: 'Profissional e polido',
  divertido: 'Divertido e bem-humorado',
  emocionante: 'Emocionante e dramático',
  educativo: 'Educativo e didático',
  inspirador: 'Inspirador e motivacional'
};
const LABEL_OBJETIVO = {
  alcance: 'Maximizar alcance / viralização',
  engajamento: 'Gerar comentários e engajamento',
  vendas: 'Levar à conversão / venda',
  informar: 'Informar com clareza'
};

// =================== CATEGORIA DO VÍDEO ===================
// Seleção atual da tela de revisão. 'auto' = usuário não quis dizer, e aí a IA
// deduz do texto como sempre fez — a categoria acrescenta, nunca obriga.
let _categoriaSel = 'auto';

// Desenha a grade. Favoritas primeiro, com um tracejado separando do resto:
// é o que faz o recurso valer a pena para quem sempre publica no mesmo nicho.
function renderCategorias() {
  const grid = $('catGrid');
  if (!grid || typeof categoriasOrdenadas !== 'function') return;
  const lista = categoriasOrdenadas();
  const nFav = lista.filter((c) => c.fav).length;
  const chip = (c, i) => {
    const sep = (nFav && i === nFav) ? '<div class="cat-sep"></div>' : '';
    const sel = _categoriaSel === c.id;
    return `${sep}<div class="cat-chip" role="option" tabindex="0" aria-selected="${sel}" data-cat="${escapeHtml(c.id)}" title="${escapeHtml(c.ctx)}">
      <span class="cat-emoji" aria-hidden="true">${c.emoji}</span><span>${escapeHtml(c.label)}</span>
      <button type="button" class="cat-star" data-cat-fav="${escapeHtml(c.id)}" data-fav="${c.fav ? '1' : '0'}"
        aria-label="${c.fav ? 'Desfavoritar' : 'Favoritar'} ${escapeHtml(c.label)}" aria-pressed="${c.fav}">${c.fav ? '★' : '☆'}</button>
    </div>`;
  };
  const auto = `<div class="cat-chip" role="option" tabindex="0" aria-selected="${_categoriaSel === 'auto'}" data-cat="auto"
      title="A IA deduz o nicho a partir do próprio conteúdo."><span class="cat-emoji" aria-hidden="true">✨</span><span>Automático</span></div>`;
  grid.innerHTML = auto + lista.map(chip).join('');
}

function selecionarCategoria(id) {
  _categoriaSel = id || 'auto';
  if (typeof salvarCategoriaUltima === 'function') salvarCategoriaUltima(_categoriaSel);
  renderCategorias();
}

// Os chips são focáveis (tabindex), então precisam responder a Enter/Espaço —
// senão a grade fica visível para o teclado e inoperante nele.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  const fav = e.target.closest && e.target.closest('[data-cat-fav]');
  if (fav) {
    e.preventDefault();
    if (typeof alternarFavorita === 'function') alternarFavorita(fav.dataset.catFav);
    renderCategorias();
    return;
  }
  const chip = e.target.closest && e.target.closest('[data-cat]');
  if (chip) { e.preventDefault(); selecionarCategoria(chip.dataset.cat); }
});

// =================== DELEGAÇÃO DE EVENTOS ===================
document.addEventListener('click', (e) => {
  // Favoritar/desfavoritar — ANTES da seleção, porque a estrela vive DENTRO do
  // chip: sem isto, favoritar selecionaria a categoria de tabela.
  const favBtn = e.target.closest('[data-cat-fav]');
  if (favBtn) {
    e.stopPropagation();
    if (typeof alternarFavorita === 'function') alternarFavorita(favBtn.dataset.catFav);
    renderCategorias();
    return;
  }

  // Escolher a categoria do vídeo.
  const catChip = e.target.closest('[data-cat]');
  if (catChip) { selecionarCategoria(catChip.dataset.cat); return; }

  // Recomeçar o assistente (↺ Transcrever outro arquivo / ← Voltar)
  const resetBtn = e.target.closest('[data-wizard-reset]');
  if (resetBtn) {
    resetWizard();
    return;
  }

  // Voltar da tela de resultado para a revisão (ex.: após erro na geração).
  if (e.target.closest('[data-review-back]')) { setWizardStep(2); return; }

  // Navegação entre abas (Novo pacote / Meus pacotes)
  const viewBtn = e.target.closest('[data-view]');
  if (viewBtn) { setView(viewBtn.dataset.view); return; }

  // Excluir item — checado ANTES de abrir (o 🗑 fica dentro do card data-open-id)
  const delBtn = e.target.closest('[data-del-id]');
  if (delBtn) { excluirHistorico(delBtn.dataset.delId); return; }

  // Abrir um item do histórico
  const openBtn = e.target.closest('[data-open-id]');
  if (openBtn) { abrirHistorico(openBtn.dataset.openId); return; }

  // Voltar à lista do histórico
  if (e.target.closest('[data-hist-back]')) { voltarHistorico(); return; }

  // Compartilhar o pacote (Share Sheet nativo; sem suporte → copia).
  const shareBtn = e.target.closest('[data-share-id]');
  if (shareBtn) {
    const text = (window._roteiroRegistry || {})[shareBtn.dataset.shareId] || '';
    compartilharTexto(text);
    return;
  }

  // Regenerar UM item do pacote (título/legenda/hashtags/palavras-chave).
  const regenBtn = e.target.closest('[data-regen]');
  if (regenBtn) { regenerarCampoUI(regenBtn.dataset.regenId, regenBtn.dataset.regen, regenBtn); return; }

  // Editar o pacote (campos viram caixas)
  const editBtn = e.target.closest('[data-edit-id]');
  if (editBtn) {
    const card = editBtn.closest('.pkgcard');
    if (card) card.innerHTML = renderPacoteCardInner(histGet(editBtn.dataset.editId), true);
    return;
  }
  // Salvar a edição (persiste e substitui a versão anterior) — escopo no card clicado
  const saveBtn = e.target.closest('[data-save-id]');
  if (saveBtn) { salvarEdicao(saveBtn.dataset.saveId, saveBtn.closest('.pkgcard')); return; }
  // Cancelar a edição (volta ao modo exibição sem salvar)
  const cancelBtn = e.target.closest('[data-cancel-id]');
  if (cancelBtn) {
    const card = cancelBtn.closest('.pkgcard');
    if (card) card.innerHTML = renderPacoteCardInner(histGet(cancelBtn.dataset.cancelId), false);
    return;
  }

  // Avaliar potencial da transcrição (ou reanalisar). O botão fica no cabeçalho da
  // transcrição (fora do .analisecard) OU dentro do card — acha o card nos 2 casos.
  const analyzeBtn = e.target.closest('[data-analyze-id]');
  if (analyzeBtn) {
    let cardEl = analyzeBtn.closest('.analisecard');
    if (!cardEl) { const wrap = analyzeBtn.closest('.transc-wrap'); if (wrap) cardEl = wrap.querySelector('.analisecard'); }
    analisarConteudoUI(analyzeBtn.dataset.analyzeId, cardEl);
    return;
  }

  const copyBtn = e.target.closest('[data-copy-id]');
  if (copyBtn) {
    const id = copyBtn.dataset.copyId;
    const text = (window._roteiroRegistry || {})[id];
    if (!text) return;

    const showFeedback = (msg, color) => {
      const orig = copyBtn.textContent;
      copyBtn.textContent = msg;
      copyBtn.style.color = color;
      setTimeout(() => { copyBtn.textContent = orig; copyBtn.style.color = ''; }, 1800);
    };

    // Tenta clipboard API moderna primeiro
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => showFeedback('Copiado ✓', 'var(--pass)'))
        .catch(() => fallbackCopy(text, showFeedback));
    } else {
      fallbackCopy(text, showFeedback);
    }
    return;
  }

  const evalBtn = e.target.closest('[data-eval-id]');
  if (evalBtn) {
    const el = document.getElementById(evalBtn.dataset.evalId);
    if (el) {
      const colapsado = el.classList.toggle('eval-collapsed');
      evalBtn.textContent = colapsado ? 'Avaliação ▾' : 'Avaliação ▴';
    }
  }
});

// Alterna entre a tela do assistente e o histórico.
function setView(view) {
  document.querySelectorAll('#tabs .tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === view));
  const wiz = document.querySelector('.wizard');
  const hist = $('historyView');
  if (wiz) wiz.style.display = (view === 'history') ? 'none' : '';
  if (hist) hist.style.display = (view === 'history') ? '' : 'none';
  if (view === 'history') voltarHistorico();
}

// =================== ETAPA 1→2: OBTER O TEXTO (transcrever/extrair) ===================
// Devolve o TEXTO do arquivo pelo caminho certo: .txt → leitura direta;
// imagem/PDF/DOCX → extração/OCR; áudio/vídeo → transcrição (com preparo de
// arquivos grandes). onProgress(msg) atualiza o status na tela.
async function obterTextoDoArquivo(arquivo, onProgress) {
  if (ehArquivoDeTexto(arquivo)) {
    if (onProgress) onProgress(`${arquivo.name} · lendo o texto…`);
    return await lerTextoArquivo(arquivo);
  }
  if (arquivoEhExtraivel(arquivo)) {
    const info = tipoArquivoInfo(arquivo);
    if (onProgress) onProgress(`${arquivo.name} · lendo ${info.rotulo}…`);
    const t = await extrairTextoArquivo(arquivo, (msg) => { if (onProgress) onProgress(`${arquivo.name} · ${msg}`); });
    if (!(t || '').trim()) {
      throw new Error(ehArquivoImagem(arquivo)
        ? 'Não encontramos texto legível nesta imagem. Tente uma foto mais nítida, bem iluminada e com o texto maior.'
        : 'Não encontramos texto neste arquivo. Ele pode ser um PDF digitalizado (imagem) — nesse caso, envie a página como foto para o reconhecimento de texto.');
    }
    return t;
  }
  // Áudio/vídeo → prepara (compressão/divisão) e transcreve em sequência.
  const prep = await otimizarArquivo(arquivo, (msg) => { if (onProgress) onProgress(msg); });
  if (prep.otimizado) {
    const n = prep.arquivos.length;
    if (onProgress) onProgress(`${arquivo.name} · preparado${n > 1 ? ` em ${n} partes` : ''} · transcrevendo…`);
  }
  return await transcreverPartes(prep.arquivos, (msg) => { if (onProgress) onProgress(msg); });
}

// "Continuar": prepara o texto e leva à etapa de REVISÃO (texto editável + opções).
async function iniciarRevisao() {
  const arquivo = ($('transcricaoFile').files || [])[0];
  const textoColado = ((($('transcricaoTexto') || {}).value) || '').trim();
  if (!arquivo && !textoColado) {
    alert('Envie um arquivo (áudio, vídeo, imagem, PDF) ou cole um texto.');
    return;
  }

  const usarTexto = !arquivo && !!textoColado;
  const arquivoEhTexto = !!arquivo && ehArquivoDeTexto(arquivo);
  const arquivoExtraivel = !!arquivo && !arquivoEhTexto && arquivoEhExtraivel(arquivo);
  const fonteTexto = usarTexto || arquivoEhTexto || arquivoExtraivel;
  const nomeEntrada = arquivo ? arquivo.name : 'Texto colado';

  const btn = $('generate');
  btn.disabled = true;
  btn.textContent = '⚙ Processando…';

  // Mantém a tela acesa durante a preparação (celular: a tela apagando suspende a aba).
  let wakeLock = null;
  try { if (navigator.wakeLock && window.isSecureContext) wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}

  setWizardStep(2);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const loading = $('review-loading'), body = $('review-body');
  loading.style.display = ''; body.style.display = 'none';

  const step = { label: fonteTexto ? 'Lendo o conteúdo' : 'Transcrevendo', desc: nomeEntrada, state: 'active' };
  const mostra = () => { loading.innerHTML = renderPipeline([step]); };
  mostra();

  try {
    let texto;
    if (!arquivo) {
      texto = textoColado; // texto colado → vai direto pra revisão
    } else {
      texto = await obterTextoDoArquivo(arquivo, (msg) => { step.desc = msg; mostra(); });
    }
    texto = (texto || '').trim();
    if (texto.length < 10) {
      throw new Error('O conteúdo ficou muito curto. Envie um áudio/vídeo com fala, uma imagem/PDF com texto, ou digite um texto maior.');
    }

    _revisao = { fonteTexto, nomeEntrada };
    $('reviewText').value = texto;
    const lbl = $('reviewLabel');
    if (lbl) lbl.textContent = fonteTexto
      ? 'Revise o texto — ajuste o que quiser antes de gerar'
      : 'Revise a transcrição — corrija o que o áudio não pegou antes de gerar';
    // Categoria: reabre já na última usada — quem publica sempre no mesmo nicho
    // não precisa reescolher, e quem mudou de assunto troca num toque.
    if (typeof categoriaUltima === 'function') _categoriaSel = categoriaUltima();
    renderCategorias();
    loading.style.display = 'none'; body.style.display = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    loading.innerHTML =
      `<div class="error-box"><strong>Não foi possível concluir</strong>${escapeHtml(err && err.message)}</div>` +
      `<button type="button" class="btn-reset" data-wizard-reset>← Voltar e tentar de novo</button>`;
  } finally {
    try { if (wakeLock) wakeLock.release(); } catch (_) {}
    btn.disabled = false;
    btn.textContent = 'Continuar →';
  }
}

// Lê as opções de saída (plataforma, tom, objetivo) da tela de revisão.
function lerOpcoesSaida() {
  const val = (id, def) => { const el = $(id); return el ? el.value : def; };
  return {
    plataforma: val('optPlataforma', 'auto'), tom: val('optTom', 'auto'),
    objetivo: val('optObjetivo', 'auto'), categoria: _categoriaSel || 'auto',
  };
}

// Monta o briefing (para o gerador) a partir do texto + opções.
function montarBriefing(opcoes, fonteTexto) {
  const checklist = {};
  if (opcoes.plataforma !== 'auto' && LABEL_PLATAFORMA[opcoes.plataforma]) checklist['Plataforma'] = [LABEL_PLATAFORMA[opcoes.plataforma]];
  if (opcoes.objetivo !== 'auto' && LABEL_OBJETIVO[opcoes.objetivo]) checklist['Objetivo'] = [LABEL_OBJETIVO[opcoes.objetivo]];
  const catLabel = (typeof categoriaLabel === 'function') ? categoriaLabel(opcoes.categoria) : '';
  if (catLabel) checklist['Categoria do vídeo'] = [catLabel];
  return {
    theme: fonteTexto ? '(o texto abaixo é a única fonte)' : '(a transcrição do áudio/vídeo abaixo é a única fonte)',
    duration: null,
    tone: (opcoes.tom !== 'auto' && LABEL_TOM[opcoes.tom]) ? LABEL_TOM[opcoes.tom] : null,
    // O campo `niche` sempre existiu no prompt do gerador ("Nicho/palavras-chave
    // do canal") e chegava VAZIO — hashtag e palavra-chave saíam deduzidas só do
    // texto. A categoria entra com o CONTEXTO junto, não só o rótulo: é o que
    // diz à IA quem assiste e com que vocabulário esse público busca.
    niche: (typeof categoriaParaBriefing === 'function') ? categoriaParaBriefing(opcoes.categoria) : '',
    // O rótulo da categoria, sozinho. Serve para a conferência saber qual
    // palavra NÃO cabe na posição de assunto — é o nome do balcão, não do prato.
    categoriaTexto: catLabel,
    extra: '(nenhum)',
    checklist: Object.keys(checklist).length ? checklist : null
  };
}

// Contexto para o juiz: origem + preferências + o conteúdo como ÚNICA fonte.
function contextoJuizTexto(texto, opcoes, fonteTexto) {
  const prefs = [];
  if (opcoes.plataforma !== 'auto' && LABEL_PLATAFORMA[opcoes.plataforma]) prefs.push('Plataforma-alvo: ' + LABEL_PLATAFORMA[opcoes.plataforma]);
  if (opcoes.tom !== 'auto' && LABEL_TOM[opcoes.tom]) prefs.push('Tom: ' + LABEL_TOM[opcoes.tom]);
  if (opcoes.objetivo !== 'auto' && LABEL_OBJETIVO[opcoes.objetivo]) prefs.push('Objetivo: ' + LABEL_OBJETIVO[opcoes.objetivo]);
  const catJuiz = (typeof categoriaLabel === 'function') ? categoriaLabel(opcoes.categoria) : '';
  if (catJuiz) prefs.push('Categoria do vídeo: ' + catJuiz);
  const linha = prefs.length ? `\nPreferências do usuário (avalie a aderência): ${prefs.join(' · ')}` : '';
  return `Origem do conteúdo: ${fonteTexto ? 'texto/roteiro/transcrição enviado pelo usuário' : 'transcrição automática de áudio/vídeo'}.${linha}
O conteúdo abaixo é a ÚNICA fonte — o pacote não deve inventar fatos fora dele:
"""
${texto}
"""`;
}

// =================== ETAPA 2→3: GERAR O PACOTE (a partir do texto revisado) ===================
async function gerarPacoteFinal() {
  const texto = (($('reviewText') || {}).value || '').trim();
  if (texto.length < 20) {
    alert('O texto está muito curto para gerar um pacote. Escreva um pouco mais.');
    return;
  }
  const opcoes = lerOpcoesSaida();
  const fonteTexto = _revisao ? _revisao.fonteTexto : true;
  const nomeEntrada = _revisao ? _revisao.nomeEntrada : 'Texto';

  const btn = $('reviewGenerate');
  btn.disabled = true;
  btn.textContent = '⚙ Gerando…';
  let wakeLock = null;
  try { if (navigator.wakeLock && window.isSecureContext) wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}

  setWizardStep(3);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const out = $('output');

  const stepsT = [
    { label: 'Montando o pacote', desc: 'Título, legenda, hashtags e palavras-chave', state: 'active' },
    { label: 'Revisão de qualidade', desc: 'Conferindo cada parte do pacote', state: '' },
    { label: 'Ajuste final', desc: 'Refinamos quando dá para melhorar', state: '' }
  ];
  const aguarde = `<div class="package" style="opacity:0.6;">
      <div class="package-header"><div class="package-title">⚙️ Montando seu pacote…</div></div>
      <div class="pkg-section" style="text-align:center; color: var(--ink-faded); font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.1em;">
        Isso pode levar alguns segundos
      </div>
    </div>`;
  const mostra = (extra = aguarde) => { out.innerHTML = renderPipeline(stepsT) + extra; };
  mostra();

  const MAX_ITER = 2, NOTA_ALVO = 80;

  try {
    const briefing = montarBriefing(opcoes, fonteTexto);
    const ctxJuiz = contextoJuizTexto(texto, opcoes, fonteTexto);
    let feedback = null, melhor = null;

    for (let i = 1; i <= MAX_ITER; i++) {
      stepsT[0].state = 'active';
      stepsT[0].desc = i === 1 ? 'Título, legenda, hashtags e palavras-chave' : 'Refinando o pacote com base na revisão…';
      stepsT[1].state = '';
      mostra();

      const pacote = await gerarPacotePublicacao(texto, briefing, feedback);

      stepsT[0].state = 'done';
      stepsT[1].state = 'active';
      stepsT[1].desc = 'Conferindo título, legenda, hashtags e palavras-chave…';
      mostra();

      const avaliacao = await avaliarPacote(pacote, ctxJuiz);
      stepsT[1].state = 'done';

      // Conferência determinística: as hashtags saíram DESTE conteúdo ou são as
      // que caberiam em qualquer vídeo do nicho? O juiz é uma LLM e às vezes
      // aprova um conjunto genérico; esta conta não.
      const auditoria = auditarHashtags(pacote, texto, briefing.categoriaTexto);
      // E o pacote conta o fim do vídeo? Título e legenda existem para fazer
      // assistir; quando entregam o desfecho, tiram do espectador a razão de dar
      // play. O juiz é uma LLM e costuma premiar o que informa mais — esta conta
      // olha o lado oposto, e olha onde dá para medir: as palavras que só
      // existem no último terço do roteiro.
      const spoiler = auditarSpoiler(pacote, texto);
      const notaEfetiva = avaliacao.nota_total - penalidadeHashtags(auditoria) - penalidadeSpoiler(spoiler);

      if (!melhor || notaEfetiva > melhor.notaEfetiva) melhor = { pacote, avaliacao, notaEfetiva };

      // Nota alta com hashtag genérica ou com o fim entregue não é pacote
      // pronto: gasta-se a iteração que já estava no orçamento para corrigir.
      if (avaliacao.nota_total >= NOTA_ALVO && auditoria.ok && spoiler.ok) {
        stepsT[2].state = 'done';
        stepsT[2].desc = 'Pacote pronto e aprovado na revisão';
        break;
      }
      if (i < MAX_ITER) {
        stepsT[2].state = 'active';
        stepsT[2].desc = 'Dá para melhorar — refinando…';
        const falhas = (avaliacao.avaliacoes || [])
          .filter(a => a.score < 7)
          .map(a => ({ ...a, nome: (RUBRICA_PACOTE.find(r => r.id === a.id) || {}).nome || a.id }));
        feedback = {
          nota_total: avaliacao.nota_total, falhas, pacoteAnterior: pacote,
          problemasHashtags: auditoria.problemas,
          problemasSpoiler: spoiler.problemas,
        };
        mostra();
      } else {
        stepsT[2].state = 'done';
        stepsT[2].desc = 'Entregando a melhor versão do pacote';
      }
    }

    const aprovado = melhor.avaliacao.nota_total >= NOTA_ALVO;
    const agora = new Date().toISOString();
    const histItem = {
      id: 'h-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      criadoEm: agora, atualizadoEm: agora,
      fileName: nomeEntrada,
      fonte: fonteTexto ? 'texto' : 'midia',
      transcricao: texto,
      opcoes: opcoes,
      nota: melhor.avaliacao.nota_total,
      aprovado: aprovado,
      veredito: melhor.avaliacao.veredito,
      avaliacoes: melhor.avaliacao.avaliacoes,
      pacote: melhor.pacote,
      editado: false
    };
    const histId = histAdd(histItem);
    updateHistBadge();

    out.innerHTML = renderPipeline(stepsT) + renderItemDetail(histGet(histId), { context: 'result' });
  } catch (err) {
    out.innerHTML = renderPipeline(stepsT) +
      `<div class="error-box" style="margin-top:24px;">
        <strong>Não foi possível concluir</strong>
        ${escapeHtml(err && err.message)}
      </div>` +
      `<button type="button" class="btn-reset" data-review-back>← Voltar à revisão</button>`;
  } finally {
    try { if (wakeLock) wakeLock.release(); } catch (_) {}
    btn.disabled = false;
    btn.textContent = '⚡ Gerar pacote';
  }
}

// =================== REGENERAR UM ITEM DO PACOTE ===================
async function regenerarCampoUI(id, campo, btnEl) {
  const item = histGet(id);
  if (!item || !btnEl) return;
  if (btnEl.dataset.loading === '1') return; // evita reentrância
  btnEl.dataset.loading = '1';
  const orig = btnEl.textContent;
  btnEl.textContent = '⏳';
  btnEl.disabled = true;
  try {
    // A categoria vem do item salvo: regenerar um card sem ela devolveria uma
    // hashtag fora do nicho no meio de um pacote que estava coerente.
    const opcoes = item.opcoes || { plataforma: 'auto', tom: 'auto', objetivo: 'auto', categoria: 'auto' };
    const briefing = montarBriefing(opcoes, item.fonte === 'texto');
    const conteudo = item.transcricao || '';
    let novo = await gerarVariacaoCampo(campo, conteudo, item.pacote || {}, briefing);

    // "Gerar outra versão" das hashtags passa pela mesma conferência da geração:
    // é justamente aqui que clica quem não gostou das tags, e devolver outro
    // conjunto genérico seria repetir o problema com palavras diferentes.
    if (campo === 'hashtags') {
      const a = auditarHashtags({ hashtags: novo }, conteudo, briefing.categoriaTexto);
      if (!a.ok) {
        const outra = await gerarVariacaoCampo(campo, conteudo, item.pacote || {}, briefing, a.problemas);
        const b = auditarHashtags({ hashtags: outra }, conteudo, briefing.categoriaTexto);
        if (Array.isArray(outra) && outra.length && penalidadeHashtags(b) <= penalidadeHashtags(a)) novo = outra;
      }
    }

    // Valida o retorno antes de gravar (não substitui por vazio).
    const vazio = (campo === 'hashtags' || campo === 'palavras_chave')
      ? !(Array.isArray(novo) && novo.length)
      : !(typeof novo === 'string' && novo.trim());
    if (vazio) throw new Error('resposta vazia');

    const pacote = Object.assign({}, item.pacote);
    pacote[campo] = novo;
    histUpdate(id, { pacote, editado: true, atualizadoEm: new Date().toISOString() });

    const card = document.getElementById('pkgcard-' + id);
    if (card) card.innerHTML = renderPacoteCardInner(histGet(id), false); // botões recriados
    toast('Nova versão gerada.');
  } catch (err) {
    btnEl.textContent = orig;
    btnEl.disabled = false;
    btnEl.dataset.loading = '';
    toast('Não foi possível gerar outra versão. Tente de novo.', 'error');
  }
}

// =================== COMPARTILHAR (Share Sheet nativo) ===================
async function compartilharTexto(text) {
  if (!text) return;
  if (navigator.share) {
    try { await navigator.share({ text }); }
    catch (_) { /* usuário cancelou — silencioso */ }
    return;
  }
  // Sem Share nativo (desktop): copia como fallback.
  const ok = () => toast('Copiado — cole onde quiser.');
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); ok(); }
    catch (_) { fallbackCopy(text, ok); }
  } else {
    fallbackCopy(text, ok);
  }
}

// Controla o assistente em 3 etapas (1 Enviar · 2 Revisar · 3 Pacote).
function setWizardStep(n) {
  document.querySelectorAll('#stepper .step-node').forEach(node => {
    const s = parseInt(node.dataset.step, 10);
    node.classList.toggle('active', s === n);
    node.classList.toggle('done', s < n);
  });
  const up = $('screen-upload'), rev = $('screen-review'), res = $('screen-result');
  if (up) up.style.display = (n === 1) ? '' : 'none';
  if (rev) rev.style.display = (n === 2) ? '' : 'none';
  if (res) res.style.display = (n === 3) ? '' : 'none';
}

// Volta ao início: limpa entrada/revisão e mostra a etapa 1 (Enviar).
function resetWizard() {
  const fileInput = $('transcricaoFile');
  if (fileInput) fileInput.value = '';
  const textArea = $('transcricaoTexto');
  if (textArea) textArea.value = '';
  const rev = $('reviewText');
  if (rev) rev.value = '';
  const rl = $('review-loading');
  if (rl) rl.innerHTML = '';
  const out = $('output');
  if (out) out.innerHTML = '';
  const btn = $('generate');
  if (btn) { btn.disabled = true; btn.textContent = 'Continuar →'; }
  const gb = $('reviewGenerate');
  if (gb) { gb.disabled = false; gb.textContent = '⚡ Gerar pacote'; }
  _revisao = null;
  // Restaura os estados visuais da caixa única (digitação visível, chip oculto, ✕ escondido).
  if (window._refletirEntrada) window._refletirEntrada();
  setWizardStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Etapa 1: preview do arquivo, habilitar o botão e arraste-e-solte ----
(function () {
  const fileInput = $('transcricaoFile');
  const preview   = $('transcricaoPreview');
  const nameEl    = $('transcricaoFileName');
  const sizeEl    = $('transcricaoFileSize');
  const iconEl    = preview ? preview.querySelector('.sb-file-icon') : null;
  const clearBtn  = $('transcricaoClearBtn');
  const smartbox  = $('smartbox');
  const toolbar   = $('sbToolbar');
  const textClearBtn = $('textClearBtn');
  const textArea  = $('transcricaoTexto');
  const genBtn    = $('generate');
  if (!fileInput || !preview) return;

  const fmtBytes = (b) => {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
  };

  // Atualiza os estados da caixa única: arquivo anexado (chip) × área de digitação; e o botão.
  const refletir = () => {
    const f = (fileInput.files || [])[0];
    if (f) {
      // ARQUIVO anexado → mostra o chip dentro da caixa, esconde a digitação.
      nameEl.textContent = f.name;
      const info = tipoArquivoInfo(f);
      if (iconEl) iconEl.textContent = info.icone;
      // A nota "será preparado" vale só p/ áudio/vídeo grande (compressão);
      // imagem/PDF grandes seguem outro caminho (extração), sem esse aviso.
      const ehMidia = /^(audio|video)\//i.test(f.type || '') ||
        (!ehArquivoDeTexto(f) && !arquivoEhExtraivel(f));
      const grande = ehMidia && f.size > WHISPER_MAX_BYTES;
      sizeEl.innerHTML = escapeHtml(info.rotulo) + ' · ' + fmtBytes(f.size) +
        (grande ? ' · <span style="color:var(--accent);">será preparado automaticamente</span>' : '');
      preview.style.display = 'flex';
      if (textArea) textArea.style.display = 'none';
      if (toolbar) toolbar.style.display = 'none';
      if (textClearBtn) textClearBtn.style.display = 'none';
    } else {
      // SEM arquivo → área de digitação visível; ✕ aparece quando há texto.
      preview.style.display = 'none';
      if (textArea) textArea.style.display = '';
      if (toolbar) toolbar.style.display = '';
      const temTxt = !!(textArea && textArea.value.trim());
      if (textClearBtn) textClearBtn.style.display = temTxt ? 'flex' : 'none';
    }
    const temTexto = !!(textArea && textArea.value.trim());
    if (genBtn) genBtn.disabled = !(f || temTexto);
  };

  // Texto e arquivo são alternativas: escolher um limpa o outro.
  fileInput.addEventListener('change', () => {
    if ((fileInput.files || []).length && textArea) textArea.value = '';
    refletir();
  });
  if (textArea) textArea.addEventListener('input', () => {
    if (textArea.value.trim() && (fileInput.files || []).length) fileInput.value = '';
    refletir();
  });

  // ✕ limpar o texto (canto superior da caixa).
  if (textClearBtn) {
    textClearBtn.addEventListener('click', () => {
      if (textArea) { textArea.value = ''; textArea.focus(); }
      refletir();
    });
  }

  // ✕ remover o arquivo anexado (no chip).
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.value = '';
      refletir();
    });
  }

  // Arraste-e-solte sobre a caixa inteira.
  if (smartbox) {
    ['dragenter', 'dragover'].forEach(ev =>
      smartbox.addEventListener(ev, (e) => { e.preventDefault(); smartbox.classList.add('dragover'); }));
    ['dragleave', 'dragend', 'drop'].forEach(ev =>
      smartbox.addEventListener(ev, (e) => { e.preventDefault(); smartbox.classList.remove('dragover'); }));
    smartbox.addEventListener('drop', (e) => {
      const arquivos = e.dataTransfer && e.dataTransfer.files;
      if (arquivos && arquivos.length) {
        try {
          const dt = new DataTransfer();
          dt.items.add(arquivos[0]);
          fileInput.files = dt.files;
          if (textArea) textArea.value = '';
          // Dispara o change para os interceptadores (ex.: ingestão da plataforma).
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {
          // Navegadores sem DataTransfer construtível: o botão "Anexar arquivo" ainda funciona.
        }
        refletir();
      }
    });
  }

  // Expõe pro resetWizard reaproveitar a mesma lógica de estado.
  window._refletirEntrada = refletir;

  // Estado inicial.
  refletir();
})();

// =================== BOOT ===================
$('generate').addEventListener('click', iniciarRevisao);
const _reviewGenBtn = $('reviewGenerate');
if (_reviewGenBtn) _reviewGenBtn.addEventListener('click', gerarPacoteFinal);
initConfigUI();
setWizardStep(1);
updateHistBadge();
histHydrate();  // carrega o histórico do IndexedDB (capacidade = dispositivo)

// PWA: registra o service worker (só em http/https — file:// não suporta).
// Auto-atualização: quando uma versão nova assume o controle (skipWaiting no
// SW), recarrega UMA vez pra aplicar na hora — sem isso, o celular podia rodar
// código antigo do cache até dois fechamentos do app.
// Embutido na plataforma Agente (iframe)? Então NÃO registra service worker
// próprio — quem cuida do cache é o app pai (evita um 2º SW cache-first dentro
// do iframe, fonte de conteúdo obsoleto). Standalone segue registrando normal.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.IS_EMBEDDED) {
  const jaControlado = !!navigator.serviceWorker.controller;
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!jaControlado || recarregou) return; // 1ª instalação não recarrega
    recarregou = true;
    location.reload();
  });
  addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' }).catch(() => {});
  });
}
