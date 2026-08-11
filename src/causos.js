'use strict';
/* ============================================================================
 * CAUSOS — a ferramenta (estado, tela e histórico)
 *
 * A mesa de contadores mora em src/causos-motor.js. Aqui fica o de sempre: um
 * campo, um botão, o resultado e a memória do que já foi contado.
 *
 * A tela é um campo só, como nas outras ferramentas. O gênero NÃO é perguntado:
 * quem decide se aquilo é história de pescador, assombração ou caso engraçado é
 * a etapa de concepção, lendo a ideia. Perguntar seria devolver ao usuário uma
 * decisão que a mesa toma melhor — e cada campo a mais é uma razão a menos para
 * usar a ferramenta.
 * ========================================================================== */

let _causoResultadoVisivel = false;

function causosDraft() {
  if (!State.causoDraft) State.causoDraft = { ideia: '' };
  return State.causoDraft;
}
function saveCausoDraft() {
  saveJSON(STORAGE_KEYS.causoDraft, State.causoDraft || { ideia: '' });
}
function saveCausos() {
  saveJSON(STORAGE_KEYS.causos, State.causos || []);
}

/** A memória da mesa: o que já foi contado, em forma. */
function causoMemoriaAtual() {
  return causoMemoriaDe(State.causos || []);
}

/* A CHAVE DE API — conferida na hora de trabalhar, não na hora de abrir.
 *
 * A chave mora em `State.apiKeys[provider]`, que é de onde `callLLM` a lê. A
 * primeira versão desta ferramenta procurava em `State.settings.groqKey` — um
 * lugar que não existe —, então o aviso dava a chave por ausente SEMPRE, mesmo
 * com ela configurada, e ficava permanente na tela. */
function causoTemChave() {
  const provider = (State && State.provider) || 'groq';
  return !!(State && State.apiKeys && State.apiKeys[provider]);
}

/** Mostra o aviso — e só é chamado quando a tentativa de contar não pôde sair
 *  do lugar por falta de chave. */
function causoAvisarSemChave() {
  const aviso = $('#c-api-warning');
  if (!aviso) return;
  const provider = (State && State.provider) || 'groq';
  const nome = provider.charAt(0).toUpperCase() + provider.slice(1);
  aviso.innerHTML = `
    <div class="flex gap-2" style="align-items:flex-start;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="flex:none;margin-top:2px;color:var(--amber);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div style="flex:1;">
        <div class="font-semibold">A mesa não pôde trabalhar</div>
        <div class="text-sm text-soft">Falta a chave da ${escapeHtml(nome)} nas Configurações.</div>
      </div>
      <button class="btn btn-ghost btn-sm" data-go="settings">Configurar</button>
    </div>`;
  aviso.classList.remove('hidden');
  try { aviso.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* */ }
}

/* ----- Resultado ----- */

function causoLimparResultado() {
  _causoResultadoVisivel = false;
  const badge = $('#c-result-badge');
  if (badge) badge.innerHTML = '';
  const area = $('#c-result-area');
  if (!area) return;
  area.innerHTML = `
    <div class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div class="empty-title">Aguardando</div>
      <div class="empty-desc">Diga a ideia acima — "uma história de pescador sobre um peixe impossível" já basta — e a mesa cuida do resto.</div>
    </div>`;
}

/** Como a mesa avaliou. Fica recolhido: quem quer a história não quer a ata,
 *  mas quem recebeu um causo fraco precisa poder ver onde ele falhou. */
function causoPainelDaMesa(item) {
  const j = item.juizo || {};
  const avaliadas = j.avaliadas || [];
  if (!avaliadas.length) return '';
  const linhas = avaliadas.slice().sort((a, b) => a.nota - b.nota).map((a) => {
    const dim = causoDimensao(a.dimensao);
    const reprovada = a.nota < a.minimo;
    return `
      <div class="causo-nota ${reprovada ? 'causo-nota-baixa' : ''}">
        <span class="causo-nota-dim">${escapeHtml(dim ? dim.pergunta : a.dimensao)}</span>
        <span class="causo-nota-valor">${a.nota}/10</span>
        ${reprovada && a.problema ? `<span class="causo-nota-porque">${escapeHtml(a.problema)}</span>` : ''}
      </div>`;
  }).join('');
  const especialistas = (item.criticas || []).map((c) => (CAUSO_CRITICOS[c.critico] || {}).label || c.critico);
  return `
    <details class="causo-mesa">
      <summary>Como a mesa avaliou${j.aprovado ? '' : ' · entregue com ressalva'}</summary>
      <div class="causo-mesa-body">
        <div class="text-xs text-mute mb-1">Leram: ${escapeHtml(especialistas.join(' · '))}. A nota que vale é a mais baixa — média não esconde defeito.</div>
        ${linhas}
      </div>
    </details>`;
}

/* CONTAR OUTRO CAUSO — limpa a mesa de trabalho.
 *
 * O cuidado que este botão exige aqui é o oposto do óbvio: ele NÃO pode encostar
 * em `State.causos`. Aquele histórico não é só arquivo — é a MEMÓRIA DA MESA.
 * `causoMemoriaDe` lê dele as aberturas, os fechos, os nomes e os desenhos já
 * usados, e é isso que impede a mesa de contar a mesma história com outras
 * palavras. Um "limpar" que levasse o histórico junto faria a ferramenta
 * esquecer o que já contou e começar a se repetir — um estrago silencioso, que
 * só apareceria algumas histórias depois.
 *
 * Só pergunta quando há ideia escrita que ainda NÃO virou causo. Quem acabou de
 * receber uma história e quer a próxima não precisa ser interrogado: aquela
 * ideia está guardada no histórico e volta com um toque. */
function causoNovo(semPerguntar) {
  const ideia = String(($('#c-ideia') || {}).value || '').trim();
  const guardado = (State.causos || []).some((x) => String(x.ideia || '').trim() === ideia);
  if (!semPerguntar && ideia && !guardado
      && !confirm('Esta ideia ainda não virou causo e será apagada. Continuar?')) return false;

  State.causoDraft = { ideia: '' };
  saveCausoDraft();
  const campo = $('#c-ideia');
  if (campo) {
    campo.value = '';
    // O × dos campos e o autosave escutam `input`: sem o evento, o campo fica
    // vazio na tela e cheio na memória.
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    try { campo.focus(); } catch (_) { /* */ }
  }
  causoLimparResultado();
  { const p = $('#c-attach-pending'); if (p) p.innerHTML = ''; }
  return true;
}

function renderCausoResultado(item) {
  const area = $('#c-result-area');
  if (!area) return;
  _causoResultadoVisivel = true;
  const badge = $('#c-result-badge');
  const j = item.juizo || {};
  if (badge) {
    badge.innerHTML = j.aprovado
      ? '<span class="badge success">A mesa aprovou</span>'
      : `<span class="badge">Melhor versão · ${j.pior || 0}/100</span>`;
  }
  area.innerHTML = `
    <div class="article-preview" id="c-result-content">${escapeHtml(item.conteudo)}</div>
    <div class="flex gap-1 flex-wrap mt-2">
      <button class="btn btn-accent btn-sm" id="c-result-novo" title="Limpa a ideia para contar outro causo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Contar outro causo
      </button>
      <button class="btn btn-ghost btn-sm" id="c-result-copy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copiar
      </button>
      <button class="btn btn-ghost btn-sm" id="c-result-del" title="Excluir" aria-label="Excluir">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
    ${causoPainelDaMesa(item)}
    <div class="text-xs text-mute mt-2">${escapeHtml((causoGenero(item.dossie && item.dossie.genero).label) + (item.dossie && item.dossie.estrutura ? ' · ' + item.dossie.estrutura : ''))}</div>`;

  const novoBtn = $('#c-result-novo');
  if (novoBtn) novoBtn.onclick = () => {
    // Esta história já está no histórico — não há o que confirmar.
    if (causoNovo(true)) {
      toast('Mesa limpa. Diga a próxima ideia.', 'success');
      try { $('#c-ideia').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* */ }
    }
  };
  const copy = $('#c-result-copy');
  if (copy) copy.onclick = () => copyTextComAviso(item.conteudo, 'Causo copiado.');
  const del = $('#c-result-del');
  if (del) del.onclick = () => {
    if (!confirm('Excluir este causo?')) return;
    State.causos = (State.causos || []).filter((x) => x.id !== item.id);
    saveCausos();
    causoLimparResultado();
    renderCausoHistorico();
    toast('Removido.', 'success');
  };
}

/* ----- Histórico ----- */

function renderCausoHistorico() {
  const lista = $('#c-history-list');
  if (!lista) return;
  const itens = State.causos || [];
  if (!itens.length) {
    lista.innerHTML = '<div class="text-sm text-mute" style="padding:0.5rem;">Nada contado ainda.</div>';
    return;
  }
  lista.innerHTML = itens.map((it) => `
    <div class="list-item" data-causo-id="${escapeHtml(it.id)}" role="button" tabindex="0">
      <div class="list-item-header">
        <div class="list-item-title">${escapeHtml((it.dossie && it.dossie.titulo) || 'Causo')}</div>
        <button class="list-item-del" data-causo-del="${escapeHtml(it.id)}" title="Excluir" aria-label="Excluir">✕</button>
      </div>
      <div class="list-item-meta">${escapeHtml(causoGenero(it.dossie && it.dossie.genero).label)} · ${escapeHtml(formatDate(it.createdAt))}</div>
    </div>`).join('');

  lista.querySelectorAll('[data-causo-id]').forEach((el) => {
    const abrir = () => {
      const it = (State.causos || []).find((x) => x.id === el.dataset.causoId);
      if (!it) return;
      renderCausoResultado(it);
      const d = causosDraft();
      d.ideia = it.ideia || d.ideia;
      saveCausoDraft();
      const campo = $('#c-ideia');
      if (campo) campo.value = d.ideia;
      fecharCausoHistorico();
    };
    el.onclick = (e) => { if (!e.target.closest('[data-causo-del]')) abrir(); };
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } };
  });
  lista.querySelectorAll('[data-causo-del]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      State.causos = (State.causos || []).filter((x) => x.id !== b.dataset.causoDel);
      saveCausos();
      renderCausoHistorico();
    };
  });
}

function abrirCausoHistorico() {
  renderCausoHistorico();
  const d = $('#c-history-drawer'), b = $('#c-history-backdrop');
  if (d) d.classList.add('open');
  if (b) b.classList.remove('hidden');
}
function fecharCausoHistorico() {
  const d = $('#c-history-drawer'), b = $('#c-history-backdrop');
  if (d) d.classList.remove('open');
  if (b) b.classList.add('hidden');
}

/* ----- Montagem da tela ----- */

function renderCausos() {
  { const p = $('#c-attach-pending'); if (p) p.innerHTML = ''; }

  const campo = $('#c-ideia');
  if (campo) campo.value = causosDraft().ideia || '';

  // O aviso de chave começa e permanece escondido. Ele só aparece quando o
  // usuário TENTA contar um causo e não dá, por falta de chave — ver
  // `causoAvisarSemChave`. A plataforma já tem tela de configuração; um aviso
  // permanente na frente de quem só quer trabalhar é ruído.
  { const a = $('#c-api-warning'); if (a) a.classList.add('hidden'); }

  /* A TELA INTEIRA É RELIGADA A CADA RENDER, sem guard de "uma vez só".
   *
   * O guard existia para não empilhar `addEventListener`. Trocando o ouvinte do
   * rascunho por `oninput =`, toda a ligação desta tela passa a ser por
   * ATRIBUIÇÃO — religar substitui em vez de acumular, e nada empilha.
   *
   * O que se ganha: os handlers deixam de ficar presos aos elementos do primeiro
   * render. Com o guard, um botão acrescentado depois (foi o caso do "Contar
   * outro causo") só seria ligado por acaso. */
  if (campo) {
    campo.oninput = () => {
      causosDraft().ideia = campo.value;
      saveCausoDraft();
      // A história na tela pertence à ideia que a gerou — trocar a ideia
      // retira o causo anterior, que continua guardado no histórico.
      if (_causoResultadoVisivel) causoLimparResultado();
    };
  }

  if ($('#c-novo')) $('#c-novo').onclick = () => {
    if (causoNovo()) toast('Mesa limpa. Diga a próxima ideia.', 'success');
  };

  if ($('#c-history-open')) $('#c-history-open').onclick = abrirCausoHistorico;
  if ($('#c-history-close')) $('#c-history-close').onclick = fecharCausoHistorico;
  if ($('#c-history-backdrop')) $('#c-history-backdrop').onclick = fecharCausoHistorico;
  if ($('#c-history-clear')) $('#c-history-clear').onclick = () => {
    if (!(State.causos || []).length) return;
    if (!confirm('Apagar todos os causos guardados? A mesa perde também a memória do que já contou.')) return;
    State.causos = [];
    saveCausos();
    renderCausoHistorico();
    toast('Histórico limpo.', 'success');
  };

  if ($('#c-submit')) $('#c-submit').onclick = async () => {
    const ideia = String((campo && campo.value) || '').trim();
    if (ideia.length < 8) {
      toast('Diga a ideia — uma linha já basta.', 'info', 5000);
      return;
    }
    // É aqui — e só aqui — que a falta de chave vira mensagem na tela.
    { const a = $('#c-api-warning'); if (a) a.classList.add('hidden'); }
    if (!causoTemChave()) { causoAvisarSemChave(); return; }

    const btn = $('#c-submit');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> A mesa trabalha…';
    $('#c-result-area').innerHTML = `
      <div class="empty">
        <div class="spinner spinner-lg" style="color: var(--accent); border-right-color: transparent; margin: 0 auto 1rem;"></div>
        <div class="empty-title" id="c-loading-title">Procurando a história…</div>
        <div class="empty-desc" id="c-loading-desc">Quatro caminhos possíveis para essa ideia.</div>
        <div class="pipeline-steps" id="c-pipeline">
          <span class="pipeline-step" data-step="conceitos">Conceitos</span>
          <span class="pipeline-step" data-step="dossie">Mesa</span>
          <span class="pipeline-step" data-step="contar">Contar</span>
          <span class="pipeline-step" data-step="criticos">Críticos</span>
          <span class="pipeline-step" data-step="reescrita">Revisão</span>
        </div>
      </div>`;
    const onEtapa = (chave, titulo, desc) => {
      const t = $('#c-loading-title'), dsc = $('#c-loading-desc');
      if (t) t.textContent = titulo;
      if (dsc) dsc.textContent = desc;
      $$('#c-pipeline .pipeline-step').forEach((el) => {
        if (el.dataset.step === chave) el.classList.add('active');
        else if (el.classList.contains('active')) el.classList.replace('active', 'done');
      });
    };

    try {
      const res = await runCausoPipeline({
        ideia, memoria: causoMemoriaAtual(), onEtapa, call: callLLM,
      });
      const item = {
        id: uuid(),
        createdAt: new Date().toISOString(),
        ideia,
        conteudo: res.conteudo,
        dossie: res.dossie,
        juizo: res.juizo,
        criticas: res.criticas,
        conceitos: res.conceitos,
        assinatura: res.assinatura,
        etapas: res.etapas,
        model: res.model,
      };
      State.causos = State.causos || [];
      State.causos.unshift(item);
      saveCausos();
      renderCausoResultado(item);
      renderCausoHistorico();
      toast(res.juizo && res.juizo.aprovado ? 'Causo pronto — a mesa aprovou.' : 'Causo pronto.', 'success');
    } catch (err) {
      toast(err.message || 'Não foi possível contar o causo.', 'error', 6000);
      $('#c-result-area').innerHTML = `
        <div class="empty">
          <div class="empty-title">Erro</div>
          <div class="empty-desc">${escapeHtml(err.message || 'Tente novamente.')}</div>
        </div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  };

  /* Anexar arquivo — refiado a cada render, pelo mesmo motivo do Julgador: a
   * ligação por atribuição é idempotente e sobrevive a uma tela remontada.
   *
   * Esta fiação convertia direto no `change` do seletor, sem o cartão de gesto.
   * Mídia grande passa pelo compressor de Web Audio, que no celular exige um
   * gesto do usuário: sem ele a decodificação nunca resolve e o usuário recebe
   * um erro de formato incompatível depois de 45 segundos. O `#c-attach-pending`
   * já existia na tela, sem uso. */
  if (typeof ingestLigarAnexo === 'function') {
    ingestLigarAnexo({
      botao: '#c-attach-btn', input: '#c-attach-input',
      campo: '#c-ideia', pendente: '#c-attach-pending', organizar: true,
    });
  }

  if (!_causoResultadoVisivel) causoLimparResultado();
  renderCausoHistorico();
}
