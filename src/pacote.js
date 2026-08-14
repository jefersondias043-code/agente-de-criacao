'use strict';
/* ============================================================================
 * PACOTE — a ferramenta (estado, tela e histórico)
 *
 * O motor mora em src/pacote-motor.js. Aqui fica o de sempre: um campo, um
 * botão, o resultado e o histórico — no mesmo padrão de Causos e Julgador.
 *
 * Diferente de Causos, não há "memória da mesa" a preservar entre pacotes: o
 * empacotamento de um conteúdo não influencia o próximo, então "Empacotar
 * outro" é uma limpeza simples, sem a ressalva sobre apagar memória.
 * ========================================================================== */

function pacoteDraft() {
  if (!State.pacoteDraft) State.pacoteDraft = { conteudo: '' };
  return State.pacoteDraft;
}
function savePacoteDraft() {
  saveJSON(STORAGE_KEYS.pacoteDraft, State.pacoteDraft || { conteudo: '' });
}
function savePacotes() {
  saveJSON(STORAGE_KEYS.pacotes, State.pacotes || []);
}

/* A CHAVE DE API — conferida na hora de trabalhar, não na hora de abrir.
 * Mesmo raciocínio de `causoTemChave`/`causoAvisarSemChave` (ver o comentário
 * lá): um aviso permanente na tela é ruído para quem só quer trabalhar. */
function pacoteTemChave() {
  const provider = (State && State.provider) || 'groq';
  return !!(State && State.apiKeys && State.apiKeys[provider]);
}

function pacoteAvisarSemChave() {
  const aviso = $('#pk-api-warning');
  if (!aviso) return;
  const provider = (State && State.provider) || 'groq';
  const nome = provider.charAt(0).toUpperCase() + provider.slice(1);
  aviso.innerHTML = `
    <div class="flex gap-2" style="align-items:flex-start;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="flex:none;margin-top:2px;color:var(--amber);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div style="flex:1;">
        <div class="font-semibold">Não foi possível empacotar</div>
        <div class="text-sm text-soft">Falta a chave da ${escapeHtml(nome)} nas Configurações.</div>
      </div>
      <button class="btn btn-ghost btn-sm" data-go="settings">Configurar</button>
    </div>`;
  aviso.classList.remove('hidden');
  try { aviso.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* */ }
}

/* ----- Resultado ----- */

let _pacoteResultadoVisivel = false;

function pacoteLimparResultado() {
  _pacoteResultadoVisivel = false;
  const badge = $('#pk-result-badge');
  if (badge) badge.innerHTML = '';
  const area = $('#pk-result-area');
  if (!area) return;
  area.innerHTML = `
    <div class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
      </div>
      <div class="empty-title">Aguardando</div>
      <div class="empty-desc">Cole a transcrição ou anexe áudio, vídeo, PDF ou texto acima — o pacote sai com título, legenda, hashtags e palavras-chave.</div>
    </div>`;
}

/** Título, legenda, hashtags e palavras-chave num bloco só — o mesmo padrão
 *  de "Copiar tudo" do AutoPost original (e de `generationFullText`, em
 *  generate.js: as hashtags ficam fora do corpo até a hora de copiar). */
function pacoteFullText(item) {
  const partes = [item.titulo, item.legenda];
  const tags = (item.hashtags || []).map((h) => '#' + h.tag);
  if (tags.length) partes.push(tags.join(' '));
  if ((item.palavrasChave || []).length) partes.push(item.palavrasChave.join(', '));
  return partes.filter(Boolean).join('\n\n');
}

/** Mesmo HTML de hashtag/palavra-chave de `pipelineExtrasHtml` (generate.js):
 *  `.hashtag-chip` com o rótulo do estrato, `.keywords-line` com os termos. */
function pacoteHashtagsHtml(item) {
  const tags = item.hashtags || [];
  if (!tags.length) return '';
  const rotulo = (typeof OPT_TIPO_LABEL !== 'undefined') ? OPT_TIPO_LABEL : {};
  const chips = tags.map((h) => `<span class="hashtag-chip">${
    rotulo[h.tipo] ? `<span class="tag-type">${escapeHtml(rotulo[h.tipo])}</span>` : ''
  }#${escapeHtml(h.tag)}</span>`).join('');
  return `
    <div class="hashtags-block mt-2">
      <div class="hashtags-list">${chips}</div>
      ${(item.palavrasChave || []).length ? `<div class="keywords-line">
        <span class="keywords-label">Palavras-chave</span>
        <span class="keywords-text">${escapeHtml(item.palavrasChave.join(', '))}</span>
      </div>` : ''}
    </div>`;
}

function renderPacoteResultado(item) {
  const area = $('#pk-result-area');
  if (!area) return;
  _pacoteResultadoVisivel = true;
  const badge = $('#pk-result-badge');
  const a = item.auditoria || {};
  if (badge) {
    badge.innerHTML = a.ok
      ? '<span class="badge success">A conferência passou</span>'
      : '<span class="badge">Entregue com ressalva</span>';
  }
  area.innerHTML = `
    <div class="field">
      <span class="label">Título</span>
      <div class="article-preview sem-capitular" id="pk-result-titulo">${escapeHtml(item.titulo)}</div>
    </div>
    <div class="field">
      <span class="label">Legenda</span>
      <div class="article-preview sem-capitular" id="pk-result-legenda">${escapeHtml(item.legenda)}</div>
    </div>
    ${pacoteHashtagsHtml(item)}
    <div class="flex gap-1 flex-wrap mt-2">
      <button class="btn btn-accent btn-sm" id="pk-result-novo" title="Limpa o campo para empacotar outro conteúdo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Empacotar outro
      </button>
      <button class="btn btn-ghost btn-sm" id="pk-result-copy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copiar tudo
      </button>
      <button class="btn btn-ghost btn-sm" id="pk-result-del" title="Excluir" aria-label="Excluir">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
    ${typeof sendToBarHtml === 'function' ? sendToBarHtml(['pacote']) : ''}`;

  const novoBtn = $('#pk-result-novo');
  if (novoBtn) novoBtn.onclick = () => {
    // Este pacote já está no histórico — não há o que confirmar.
    if (pacoteNovo(true)) {
      toast('Campo limpo. Cole ou anexe o próximo conteúdo.', 'success');
      try { $('#pk-conteudo').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* */ }
    }
  };
  const copy = $('#pk-result-copy');
  if (copy) copy.onclick = () => copyTextComAviso(pacoteFullText(item), 'Pacote copiado.');
  const del = $('#pk-result-del');
  if (del) del.onclick = () => {
    if (!confirm('Excluir este pacote?')) return;
    State.pacotes = (State.pacotes || []).filter((x) => x.id !== item.id);
    savePacotes();
    pacoteLimparResultado();
    renderPacoteHistorico();
    toast('Removido.', 'success');
  };
  if (typeof wireSendTo === 'function') wireSendTo(area, () => item.legenda || '');
}

/* PACOTE NOVO — limpa o campo de trabalho. Só pergunta quando há conteúdo
 * digitado que ainda não virou pacote. */
function pacoteNovo(semPerguntar) {
  const conteudo = String(($('#pk-conteudo') || {}).value || '').trim();
  const guardado = (State.pacotes || []).some((x) => String(x.conteudo || '').trim() === conteudo);
  if (!semPerguntar && conteudo && !guardado
      && !confirm('Este conteúdo ainda não virou pacote e será apagado. Continuar?')) return false;

  State.pacoteDraft = { conteudo: '' };
  savePacoteDraft();
  const campo = $('#pk-conteudo');
  if (campo) {
    campo.value = '';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    try { campo.focus(); } catch (_) { /* */ }
  }
  pacoteLimparResultado();
  { const p = $('#pk-attach-pending'); if (p) p.innerHTML = ''; }
  return true;
}

/* ----- Histórico ----- */

function renderPacoteHistorico() {
  const lista = $('#pk-history-list');
  if (!lista) return;
  const itens = State.pacotes || [];
  if (!itens.length) {
    lista.innerHTML = '<div class="text-sm text-mute" style="padding:0.5rem;">Nada empacotado ainda.</div>';
    return;
  }
  lista.innerHTML = itens.map((it) => `
    <div class="list-item" data-pacote-id="${escapeHtml(it.id)}" role="button" tabindex="0">
      <div class="list-item-header">
        <div class="list-item-title">${escapeHtml(it.titulo || 'Pacote')}</div>
        <button class="list-item-del" data-pacote-del="${escapeHtml(it.id)}" title="Excluir" aria-label="Excluir">✕</button>
      </div>
      <div class="list-item-meta">${escapeHtml(formatDate(it.createdAt))}</div>
    </div>`).join('');

  lista.querySelectorAll('[data-pacote-id]').forEach((el) => {
    const abrir = () => {
      const it = (State.pacotes || []).find((x) => x.id === el.dataset.pacoteId);
      if (!it) return;
      renderPacoteResultado(it);
      const d = pacoteDraft();
      d.conteudo = it.conteudo || d.conteudo;
      savePacoteDraft();
      const campo = $('#pk-conteudo');
      if (campo) campo.value = d.conteudo;
      fecharPacoteHistorico();
    };
    el.onclick = (e) => { if (!e.target.closest('[data-pacote-del]')) abrir(); };
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } };
  });
  lista.querySelectorAll('[data-pacote-del]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      State.pacotes = (State.pacotes || []).filter((x) => x.id !== b.dataset.pacoteDel);
      savePacotes();
      renderPacoteHistorico();
    };
  });
}

function abrirPacoteHistorico() {
  renderPacoteHistorico();
  const d = $('#pk-history-drawer'), b = $('#pk-history-backdrop');
  if (d) d.classList.add('open');
  if (b) b.classList.remove('hidden');
}
function fecharPacoteHistorico() {
  const d = $('#pk-history-drawer'), b = $('#pk-history-backdrop');
  if (d) d.classList.remove('open');
  if (b) b.classList.add('hidden');
}

/* ----- Montagem da tela ----- */

function renderPacote() {
  { const p = $('#pk-attach-pending'); if (p) p.innerHTML = ''; }

  /* TEXTO RECEBIDO DE OUTRA FERRAMENTA (Extrair, Causos, Julgador…) vira o
   * conteúdo a empacotar — mesmo padrão de Causos/Julgador (r234): consome e
   * esvazia a fila na hora, para não se colar de novo por cima do que o
   * usuário escreveu depois. */
  if (State.handoff && State.handoff.target === 'pacote') {
    const texto = String(State.handoff.text || '');
    State.handoff = null;
    if (texto.trim()) {
      pacoteDraft().conteudo = texto;
      savePacoteDraft();
      pacoteLimparResultado();
    }
  }

  const campo = $('#pk-conteudo');
  if (campo) campo.value = pacoteDraft().conteudo || '';

  // O aviso de chave começa e permanece escondido — só aparece quando o
  // usuário TENTA empacotar e não dá, por falta de chave.
  { const a = $('#pk-api-warning'); if (a) a.classList.add('hidden'); }

  // Religa a tela inteira a cada render, por atribuição — sem guard de "uma
  // vez só" (mesmo raciocínio de `renderCausos`: religar substitui, não
  // empilha, e sobrevive a um botão acrescentado depois do primeiro render).
  if (campo) {
    campo.oninput = () => {
      pacoteDraft().conteudo = campo.value;
      savePacoteDraft();
      if (_pacoteResultadoVisivel) pacoteLimparResultado();
    };
  }

  if ($('#pk-novo')) $('#pk-novo').onclick = () => {
    if (pacoteNovo()) toast('Campo limpo. Cole ou anexe o próximo conteúdo.', 'success');
  };

  if ($('#pk-history-open')) $('#pk-history-open').onclick = abrirPacoteHistorico;
  if ($('#pk-history-close')) $('#pk-history-close').onclick = fecharPacoteHistorico;
  if ($('#pk-history-backdrop')) $('#pk-history-backdrop').onclick = fecharPacoteHistorico;
  if ($('#pk-history-clear')) $('#pk-history-clear').onclick = () => {
    if (!(State.pacotes || []).length) return;
    if (!confirm('Apagar todos os pacotes guardados?')) return;
    State.pacotes = [];
    savePacotes();
    renderPacoteHistorico();
    toast('Histórico limpo.', 'success');
  };

  if ($('#pk-submit')) $('#pk-submit').onclick = async () => {
    const conteudo = String((campo && campo.value) || '').trim();
    if (conteudo.length < 30) {
      toast('Cole ou anexe o conteúdo — precisa de um pouco mais de texto para empacotar.', 'info', 5000);
      return;
    }
    // É aqui — e só aqui — que a falta de chave vira mensagem na tela.
    { const a = $('#pk-api-warning'); if (a) a.classList.add('hidden'); }
    if (!pacoteTemChave()) { pacoteAvisarSemChave(); return; }

    const btn = $('#pk-submit');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Empacotando…';
    $('#pk-result-area').innerHTML = `
      <div class="empty">
        <div class="spinner spinner-lg" style="color: var(--accent); border-right-color: transparent; margin: 0 auto 1rem;"></div>
        <div class="empty-title" id="pk-loading-title">Lendo e empacotando…</div>
        <div class="empty-desc" id="pk-loading-desc">Título, legenda, hashtags e palavras-chave a partir do conteúdo.</div>
        <div class="pipeline-steps" id="pk-pipeline">
          <span class="pipeline-step" data-step="lendo">Lendo</span>
          <span class="pipeline-step" data-step="corrigindo">Corrigindo</span>
        </div>
      </div>`;
    const onEtapa = (chave, titulo, desc) => {
      const t = $('#pk-loading-title'), dsc = $('#pk-loading-desc');
      if (t) t.textContent = titulo;
      if (dsc) dsc.textContent = desc;
      $$('#pk-pipeline .pipeline-step').forEach((el) => {
        if (el.dataset.step === chave) el.classList.add('active');
        else if (el.classList.contains('active')) el.classList.replace('active', 'done');
      });
    };

    try {
      const res = await runPacotePipeline({ conteudo, onEtapa, call: callLLM });
      const item = {
        id: uuid(),
        createdAt: new Date().toISOString(),
        conteudo,
        titulo: res.titulo,
        legenda: res.legenda,
        pergunta: res.pergunta,
        fisgada: res.fisgada,
        hashtags: res.hashtags,
        palavrasChave: res.palavrasChave,
        auditoria: res.auditoria,
        tentativas: res.tentativas,
        model: res.model,
      };
      State.pacotes = State.pacotes || [];
      State.pacotes.unshift(item);
      savePacotes();
      renderPacoteResultado(item);
      renderPacoteHistorico();
      toast(res.auditoria && res.auditoria.ok ? 'Pacote pronto — a conferência passou.' : 'Pacote pronto.', 'success');
    } catch (err) {
      toast(err.message || 'Não foi possível empacotar.', 'error', 6000);
      $('#pk-result-area').innerHTML = `
        <div class="empty">
          <div class="empty-title">Erro</div>
          <div class="empty-desc">${escapeHtml(err.message || 'Tente novamente.')}</div>
        </div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  };

  // Anexar arquivo — religado a cada render, mesmo motivo de Causos/Julgador:
  // ligação por atribuição, idempotente, sobrevive a uma tela remontada.
  if (typeof ingestLigarAnexo === 'function') {
    ingestLigarAnexo({
      botao: '#pk-attach-btn', input: '#pk-attach-input',
      campo: '#pk-conteudo', pendente: '#pk-attach-pending', organizar: true,
    });
  }

  if (!_pacoteResultadoVisivel) pacoteLimparResultado();
  renderPacoteHistorico();
}
