'use strict';
/* ============================================================
   RENDER — toda a construção de HTML do resultado, histórico,
   pacote (exibição + edição), avaliação do juiz e análise de
   potencial. Textos copiáveis vão pro _roteiroRegistry (evita
   problemas de escape inline nos data-attributes).
   ============================================================ */

// Banner + avaliação detalhada (colapsável) do juiz do pacote.
function renderAvaliacaoPacote(avaliacao, aprovado) {
  const cls = scoreClass(avaliacao.nota_total);
  const evalId = 'evalpkg-' + Math.random().toString(36).slice(2);
  const critsHtml = (avaliacao.avaliacoes || []).map(a => {
    const rub = RUBRICA_PACOTE.find(r => r.id === a.id);
    return `<div class="criterion">
      <div class="crit-score ${critClass(a.score)}">${a.score}/10</div>
      <div class="crit-body">
        <div class="crit-name">${rub ? rub.nome : a.id}</div>
        <div class="crit-feedback">${escapeHtml(a.feedback || '')}</div>
      </div>
    </div>`;
  }).join('');

  return `<div class="final-banner ${aprovado ? '' : 'warn'}">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px;">
      <div>
        <div class="final-label">${aprovado ? '✓ Pacote aprovado na revisão' : '⚠ Melhor versão obtida'}</div>
        <div class="final-text">${escapeHtml(avaliacao.veredito || '')}</div>
      </div>
      <div style="display:flex; gap:12px; align-items:center; flex-shrink:0;">
        <span class="iter-score ${cls}">${avaliacao.nota_total}<span class="max">/100</span></span>
        <button class="toggle-eval" data-eval-id="${evalId}">Avaliação ▾</button>
      </div>
    </div>
    <div class="eval-box eval-collapsed" id="${evalId}" style="margin-top:16px;">
      ${critsHtml}
    </div>
  </div>`;
}

function renderPacote(pacote, opts) {
  opts = opts || {};
  // Sanitiza e valida
  const titulo = String(pacote.titulo || '').trim();
  const legenda = String(pacote.legenda || '').trim();
  // Tolera hashtags como [{tag,tipo}] (geração) OU [string] (após edição manual).
  const hashtags = (Array.isArray(pacote.hashtags) ? pacote.hashtags : []).map(h =>
    (typeof h === 'string') ? { tag: h, tipo: '' } : { tag: (h && h.tag) || '', tipo: (h && h.tipo) || '' });
  const palavrasChave = Array.isArray(pacote.palavras_chave)
    ? pacote.palavras_chave.map(k => String(k || '').trim()).filter(Boolean)
    : [];

  const tituloLen = titulo.length;
  const legendaLen = legenda.length;

  // Constrói a string de hashtags pronta pra colar
  const hashtagsString = hashtags
    .map(h => '#' + sanitizeHashtag(h.tag))
    .join(' ');

  // Distribuição real das hashtags por tipo (reflete o que a LLM devolveu)
  const distHashtags = hashtags.reduce((acc, h) => {
    if (acc[h.tipo] !== undefined) acc[h.tipo]++;
    return acc;
  }, { ampla: 0, assunto: 0, nicho: 0, intencao: 0 });
  const temTipos = hashtags.some(h => h.tipo);
  const distLabel = temTipos
    ? `${distHashtags.ampla} ampla · ${distHashtags.assunto} assunto · ${distHashtags.nicho} nicho · ${distHashtags.intencao} intenção`
    : `${hashtags.length} hashtag${hashtags.length === 1 ? '' : 's'}`;

  // String de palavras-chave pronta pra colar (separadas por vírgula)
  const keywordsString = palavrasChave.join(', ');

  // Constrói o "copiar tudo"
  const copyAllText = `${titulo}\n\n${legenda}\n\n${hashtagsString}` +
    (palavrasChave.length ? `\n\n${keywordsString}` : '');

  // Registra os textos no registry global pra evitar problemas de escape inline
  const pkgId = 'pkg-' + Math.random().toString(36).slice(2);
  window._roteiroRegistry = window._roteiroRegistry || {};
  window._roteiroRegistry[pkgId + '-titulo'] = titulo;
  window._roteiroRegistry[pkgId + '-legenda'] = legenda;
  window._roteiroRegistry[pkgId + '-hashtags'] = hashtagsString;
  window._roteiroRegistry[pkgId + '-keywords'] = keywordsString;
  window._roteiroRegistry[pkgId + '-all'] = copyAllText;

  const chipsHtml = hashtags.map(h => {
    const tagClean = sanitizeHashtag(h.tag);
    const tipoLabel = TIPO_LABEL[h.tipo] || h.tipo || '';
    return `<span class="hashtag-chip">
      ${tipoLabel ? `<span class="tag-type">${escapeHtml(tipoLabel)}</span>` : ''}
      #${escapeHtml(tagClean)}
    </span>`;
  }).join('');

  // Indicadores de tamanho (verde se dentro do range ideal)
  const tituloDentro = tituloLen >= 50 && tituloLen <= 80;
  const legendaDentro = legendaLen >= 150 && legendaLen <= 300;
  const tituloColor = tituloDentro ? 'var(--pass)' : 'var(--warn)';
  const legendaColor = legendaDentro ? 'var(--pass)' : 'var(--warn)';

  // Botão "gerar outra versão" por item (só nos cards do resultado/histórico,
  // que têm editId). 🔄 discreto ao lado do "Copiar" de cada seção.
  const regen = (campo) => opts.editId
    ? `<button class="regen-btn" data-regen="${campo}" data-regen-id="${opts.editId}" title="Gerar outra versão" aria-label="Gerar outra versão">🔄</button>`
    : '';

  // Seção de palavras-chave (só aparece quando existem)
  const keywordChipsHtml = palavrasChave
    .map(k => `<span class="keyword-chip">${escapeHtml(k)}</span>`)
    .join('');
  const keywordsSection = palavrasChave.length ? `
    <div class="pkg-section">
      <div class="pkg-label">
        <span class="pkg-label-text">Palavras-chave</span>
        <span style="display:flex; gap:8px; align-items:center;">
          ${regen('palavras_chave')}
          <button class="copy-btn" data-copy-id="${pkgId}-keywords">Copiar</button>
        </span>
      </div>
      <div class="keywords-grid">${keywordChipsHtml}</div>
      <div class="keywords-string">${escapeHtml(keywordsString)}</div>
    </div>` : '';

  // Barra "Enviar para" (apenas quando embutido na plataforma Agente)
  const sendBar = (window.IS_EMBEDDED && typeof renderSendBar === 'function')
    ? renderSendBar(pkgId + '-envio', [titulo, legenda].filter(Boolean).join('\n\n'))
    : '';

  // Compartilhar nativo (Share Sheet) — só onde o navegador suporta (celular).
  const shareBtn = (typeof navigator !== 'undefined' && navigator.share)
    ? `<button class="copy-btn" data-share-id="${pkgId}-all">↗ Compartilhar</button>`
    : '';

  return `<div class="package">
    <div class="package-header">
      <div class="package-title">⚡ Pacote de Publicação</div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        ${opts.editId ? `<button class="copy-btn" data-edit-id="${opts.editId}">✏️ Editar</button>` : ''}
        ${shareBtn}
        <button class="copy-all-btn" data-copy-id="${pkgId}-all">Copiar tudo</button>
      </div>
    </div>

    <div class="pkg-section">
      <div class="pkg-label">
        <span class="pkg-label-text">Título</span>
        <span style="display:flex; gap:8px; align-items:center;">
          <span class="pkg-meta" style="color:${tituloColor};">${tituloLen}/80 caracteres</span>
          ${regen('titulo')}
          <button class="copy-btn" data-copy-id="${pkgId}-titulo">Copiar</button>
        </span>
      </div>
      <div class="pkg-content titulo">${escapeHtml(titulo)}</div>
    </div>

    <div class="pkg-section">
      <div class="pkg-label">
        <span class="pkg-label-text">Legenda</span>
        <span style="display:flex; gap:8px; align-items:center;">
          <span class="pkg-meta" style="color:${legendaColor};">${legendaLen} caracteres (ideal 150–300)</span>
          ${regen('legenda')}
          <button class="copy-btn" data-copy-id="${pkgId}-legenda">Copiar</button>
        </span>
      </div>
      <div class="pkg-content legenda">${escapeHtml(legenda)}</div>
    </div>

    <div class="pkg-section">
      <div class="pkg-label">
        <span class="pkg-label-text">Hashtags</span>
        <span style="display:flex; gap:8px; align-items:center;">
          <span class="pkg-meta">${distLabel}</span>
          ${regen('hashtags')}
          <button class="copy-btn" data-copy-id="${pkgId}-hashtags">Copiar</button>
        </span>
      </div>
      <div class="hashtags-grid">${chipsHtml}</div>
      <div class="hashtags-string">${escapeHtml(hashtagsString)}</div>
    </div>
${keywordsSection}${sendBar}
  </div>`;
}

// =================== DETALHE (resultado === item do histórico) ===================
// Usado no fim da geração (context:'result') E ao abrir um item salvo (context:'history').
function renderItemDetail(item, opts) {
  opts = opts || {};
  const ctx = opts.context || 'history';

  const trId = 'tr-' + item.id;
  window._roteiroRegistry = window._roteiroRegistry || {};
  window._roteiroRegistry[trId] = item.transcricao || '';
  // Itens antigos não têm `fonte` → tratados como mídia (transcrição).
  const ehTexto = (item.fonte === 'texto');
  const tituloBox = ehTexto ? 'Texto enviado' : 'Transcrição';
  const seloBox = ehTexto ? '' : `<span style="color: var(--accent); font-size:10px; margin-left: 10px; font-family: 'JetBrains Mono', monospace; letter-spacing:0.15em;">PORTUGUÊS</span>`;
  // Barra "Enviar para" da transcrição (apenas embutido na plataforma).
  const trSendBar = (window.IS_EMBEDDED && typeof renderSendBar === 'function')
    ? renderSendBar(trId, item.transcricao || '')
    : '';
  const transcBox = `<div class="iteration current">
      <div class="iter-header">
        <div>
          <span class="iter-num">${tituloBox}</span>
          ${seloBox}
        </div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
          <button class="copy-btn" data-copy-id="${trId}">Copiar</button>
          <button class="copy-btn acc" data-analyze-id="${item.id}">🔍 Avaliar potencial</button>
        </div>
      </div>
      <div class="script-box">${formatRoteiro(item.transcricao || '')}</div>
      ${trSendBar}
    </div>`;

  const avalBox = (item.avaliacoes && item.avaliacoes.length)
    ? renderAvaliacaoPacote({ nota_total: item.nota, avaliacoes: item.avaliacoes, veredito: item.veredito }, item.aprovado)
    : '';

  const card = `<div class="pkgcard" id="pkgcard-${item.id}">${renderPacoteCardInner(item, false)}</div>`;

  let footer;
  if (ctx === 'result') {
    footer = `<button type="button" class="btn-reset" data-wizard-reset>↺ Transcrever outro arquivo</button>`;
  } else {
    footer = `<div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:24px;">
        <button type="button" class="btn-reset" data-hist-back>← Voltar ao histórico</button>
        <button type="button" class="btn-reset btn-danger" data-del-id="${item.id}">🗑 Excluir</button>
      </div>`;
  }

  // A análise de potencial fica AGRUPADA com a transcrição (o botão "Avaliar potencial"
  // está no cabeçalho da transcrição e os resultados aparecem logo abaixo dela).
  const blocoTransc = `<div class="transc-wrap">${transcBox}${renderAnaliseSecao(item)}</div>`;
  return blocoTransc + avalBox + card + footer;
}

// =================== ANÁLISE DE POTENCIAL (render) ===================
// Seção da análise no detalhe: vazia até o usuário avaliar; preenchida (e persistida) depois.
function renderAnaliseSecao(item) {
  const inner = item.analise ? renderAnaliseInner(item.analise, item.id) : '';
  return `<div class="analisecard">${inner}</div>`;
}

function renderAnaliseInner(an, id) {
  const cls = scoreClass(an.nota_geral);
  const clasLabel = an.classificacao === 'ALTO' ? 'Alto potencial'
    : an.classificacao === 'BAIXO' ? 'Baixo potencial' : 'Potencial médio';
  const dims = (an.dimensoes || []).map(d => `
    <div class="criterion">
      <div class="crit-score ${critClass(d.score)}">${d.score}/10</div>
      <div class="crit-body">
        <div class="crit-name">${escapeHtml(d.nome)}</div>
        <div class="crit-feedback">${escapeHtml(d.comentario || '')}</div>
      </div>
    </div>`).join('');
  const bloco = (titulo, itens, marc) => (itens && itens.length) ? `
    <div class="analise-bloco">
      <div class="analise-bloco-tit">${titulo}</div>
      <ul class="analise-lista">${itens.map(i => `<li><span class="am">${marc}</span><span>${escapeHtml(i)}</span></li>`).join('')}</ul>
    </div>` : '';
  return `<div class="final-banner ${cls === 'fail' ? 'warn' : ''}">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px;">
      <div>
        <div class="final-label">🔍 Análise de potencial · ${escapeHtml(clasLabel)}</div>
        <div class="final-text">${escapeHtml(an.veredito || '')}</div>
      </div>
      <span class="iter-score ${cls}" style="flex-shrink:0;">${an.nota_geral}<span class="max">/100</span></span>
    </div>
    <div style="margin-top:16px;">
      ${dims}
      ${bloco('Pontos fortes', an.pontos_fortes, '✓')}
      ${bloco('Pontos a melhorar', an.pontos_fracos, '⚠')}
      ${bloco('Sugestões', an.sugestoes, '→')}
      <div style="margin-top:16px;"><button type="button" class="btn-analise btn-analise-sm" data-analyze-id="${id}">↻ Analisar de novo</button></div>
    </div>
  </div>`;
}

// Dispara a análise (ou reanálise) e re-renderiza SÓ o card da análise.
async function analisarConteudoUI(id, cardEl) {
  const item = histGet(id);
  if (!item || !cardEl) return;
  if (cardEl.dataset.loading === '1') return; // evita reentrância (cliques repetidos)
  cardEl.dataset.loading = '1';
  cardEl.innerHTML = `<div class="analise-loading">Analisando o potencial do conteúdo…</div>`;
  try {
    const analise = await analisarConteudo(item.transcricao);
    histUpdate(id, { analise: analise });
    cardEl.innerHTML = renderAnaliseInner(analise, id);
  } catch (err) {
    cardEl.innerHTML = `<div class="error-box" style="margin:0;">
        <strong>Não foi possível analisar</strong>
        ${escapeHtml((err && err.message) || 'Tente novamente.')}
      </div>
      <div style="margin-top:12px;"><button type="button" class="btn-analise" data-analyze-id="${id}">↻ Tentar de novo</button></div>`;
  } finally {
    cardEl.dataset.loading = '';
  }
}

// Pacote: modo exibição (reusa renderPacote + botão Editar) OU modo edição (formulário).
function renderPacoteCardInner(item, editMode) {
  if (editMode) return renderPacoteEditForm(item);
  return renderPacote(item.pacote, { editId: item.id });
}

function renderPacoteEditForm(item) {
  const p = item.pacote || {};
  const id = item.id;
  const titulo = String(p.titulo || '');
  const legenda = String(p.legenda || '');
  const hashtags = Array.isArray(p.hashtags) ? p.hashtags : [];
  const hashtagsStr = hashtags.map(h => '#' + sanitizeHashtag((typeof h === 'string') ? h : (h && h.tag))).join(' ');
  const keywords = Array.isArray(p.palavras_chave) ? p.palavras_chave : [];
  const keywordsStr = keywords.join(', ');
  return `<div class="package">
    <div class="package-header">
      <div class="package-title">✏️ Editando o pacote</div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="copy-all-btn" data-save-id="${id}">💾 Salvar</button>
        <button class="copy-btn" data-cancel-id="${id}">Cancelar</button>
      </div>
    </div>
    <div class="pkg-section">
      <div class="pkg-label"><span class="pkg-label-text">Título</span></div>
      <input type="text" data-ed="titulo" value="${escapeHtml(titulo)}" />
    </div>
    <div class="pkg-section">
      <div class="pkg-label"><span class="pkg-label-text">Legenda</span></div>
      <textarea data-ed="legenda" style="min-height:120px;">${escapeHtml(legenda)}</textarea>
    </div>
    <div class="pkg-section">
      <div class="pkg-label"><span class="pkg-label-text">Hashtags · separadas por espaço</span></div>
      <textarea data-ed="hashtags" style="min-height:64px;">${escapeHtml(hashtagsStr)}</textarea>
    </div>
    <div class="pkg-section">
      <div class="pkg-label"><span class="pkg-label-text">Palavras-chave · separadas por vírgula</span></div>
      <textarea data-ed="keywords" style="min-height:64px;">${escapeHtml(keywordsStr)}</textarea>
    </div>
  </div>`;
}

// Lê as caixas de edição, normaliza e persiste (a versão editada SUBSTITUI a anterior).
function salvarEdicao(id, cardEl) {
  const item = histGet(id);
  if (!item) return;
  const scope = cardEl || document;
  const val = (sel) => { const el = scope.querySelector(sel); return el ? el.value : ''; };
  const titulo = val('[data-ed="titulo"]').trim();
  const legenda = val('[data-ed="legenda"]').trim();
  const prev = Array.isArray(item.pacote && item.pacote.hashtags) ? item.pacote.hashtags : [];
  const tags = val('[data-ed="hashtags"]').split(/[\s,]+/).map(t => sanitizeHashtag(t)).filter(Boolean);
  const hashtags = tags.map((tag, i) => ({ tag, tipo: (prev[i] && prev[i].tipo) || '' }));
  const palavras_chave = val('[data-ed="keywords"]').split(',').map(k => k.trim()).filter(Boolean);
  histUpdate(id, { pacote: { titulo, legenda, hashtags, palavras_chave }, editado: true, atualizadoEm: new Date().toISOString() });
  if (cardEl) cardEl.innerHTML = renderPacoteCardInner(histGet(id), false);
}

// =================== HISTÓRICO: LISTA E DETALHE ===================
function renderHistoryList() {
  const cont = $('historyList');
  if (!cont) return;
  const arr = histLoad().slice().reverse(); // mais recentes primeiro
  if (!arr.length) {
    cont.innerHTML = `<div class="panel"><div class="empty-state">
      <div class="icon">"</div>
      <div class="text">Seu histórico está vazio. Gere um pacote a partir de um áudio/vídeo e ele aparece aqui — sua biblioteca pessoal de conteúdos.</div>
    </div></div>`;
    return;
  }
  const cards = arr.map(it => {
    const titulo = (it.pacote && it.pacote.titulo) ? it.pacote.titulo : '(sem título)';
    const nota = (typeof it.nota === 'number') ? it.nota : null;
    const notaCls = nota === null ? '' : (nota >= 80 ? 'pass' : 'warn');
    return `<div class="hist-card" data-open-id="${it.id}">
      <div class="hist-main">
        <div class="hist-title">${escapeHtml(titulo)}</div>
        <div class="hist-meta">${escapeHtml(fmtData(it.criadoEm))} · ${escapeHtml(it.fileName || 'arquivo')}${it.editado ? ' · <span class="hist-edited">✏️ editado</span>' : ''}</div>
      </div>
      <div class="hist-right">
        ${nota !== null ? `<span class="hist-nota ${notaCls}">${nota}</span>` : ''}
        <button type="button" class="hist-del" data-del-id="${it.id}" title="Excluir" aria-label="Excluir">🗑</button>
      </div>
    </div>`;
  }).join('');
  cont.innerHTML = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:0.6rem;">
      <button type="button" id="histClearAll" class="btn-reset btn-danger" style="font-size:12px; padding:0.4rem 0.8rem; border-radius:6px;">Limpar tudo</button>
    </div>
    <div class="hist-list">${cards}</div>`;
  const cb = $('histClearAll');
  if (cb) cb.onclick = () => {
    if (!confirm('Apagar TODO o histórico do AutoPost? Isso não pode ser desfeito.')) return;
    histSaveAll([]);            // grava [] no IndexedDB (limpa só o AutoPost)
    updateHistBadge();
    voltarHistorico();
  };
}

// Mostra a lista e esconde o detalhe.
function voltarHistorico() {
  const list = $('historyList'), det = $('historyDetail');
  if (det) { det.style.display = 'none'; det.innerHTML = ''; }
  if (list) list.style.display = '';
  renderHistoryList();
}

// Abre um item: detalhe completo (transcrição + avaliação + pacote editável).
function abrirHistorico(id) {
  const item = histGet(id);
  if (!item) return;
  const list = $('historyList'), det = $('historyDetail');
  if (list) list.style.display = 'none';
  if (det) {
    det.style.display = '';
    det.innerHTML = `<div class="panel">${renderItemDetail(item, { context: 'history' })}</div>`;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function excluirHistorico(id) {
  if (!confirm('Excluir este item do histórico? Isso não pode ser desfeito.')) return;
  histDelete(id);
  updateHistBadge();
  voltarHistorico();
}
