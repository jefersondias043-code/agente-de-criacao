'use strict';
/* ============================================================================
 * AFERIDOR — a tela
 *
 * A ferramenta vende UMA coisa: a nota é uma conta que dá para conferir. Se a
 * tela mostrar só o número, ela desperdiça exatamente o que a distingue do
 * Julgador — ali a nota é juízo, aqui é aritmética, e aritmética se audita.
 *
 * Daí a ordem de leitura:
 *
 *   1. a nota, com a conta ao lado (peso ganho / peso que se aplicava);
 *   2. ONDE A NOTA FOI EMBORA — os quesitos que não passaram, do mais caro
 *      para o mais barato. É a resposta a "o que eu conserto primeiro", e sai
 *      da mesma conta que produziu a nota;
 *   3. onde as rodadas DISCORDARAM — porque uma resposta decidida por 3 a 2
 *      não é uma resposta decidida por 5 a 0, e esconder isso seria fingir
 *      uma firmeza que não houve;
 *   4. os blocos, para ver de que lado o conteúdo é forte;
 *   5. o questionário INTEIRO, recolhido — pergunta, resposta, votos e peso.
 *      É a auditoria: quem discorda da nota vai ali e acha a linha.
 * ========================================================================== */

let _aferResultadoVisivel = false;
let _aferItemAtual = null;

function aferidorDraft() {
  if (!State.aferidorDraft) {
    State.aferidorDraft = { conteudo: '', visual: '', titulo: '', legenda: '', rodadas: String(AFER_RODADAS_PADRAO) };
  }
  return State.aferidorDraft;
}
function saveAferidorDraft() {
  saveJSON(STORAGE_KEYS.aferidorDraft, State.aferidorDraft || {});
}
function saveAfericoes() {
  saveJSON(STORAGE_KEYS.afericoes, State.afericoes || []);
}

/* A chave é conferida na hora de trabalhar, não na de abrir — aviso permanente
 * na frente de quem só quer trabalhar é ruído. (Lição do r214.) */
function aferTemChave() {
  const provider = (State && State.provider) || 'groq';
  return !!(State && State.apiKeys && State.apiKeys[provider]);
}

function aferAvisarSemChave() {
  const aviso = $('#af-api-warning');
  if (!aviso) return;
  const provider = (State && State.provider) || 'groq';
  const nome = provider.charAt(0).toUpperCase() + provider.slice(1);
  aviso.innerHTML = `
    <div class="flex gap-2" style="align-items:flex-start;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="flex:none;margin-top:2px;color:var(--amber);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div style="flex:1;">
        <div class="font-semibold">Não deu para aferir</div>
        <div class="text-sm text-soft">Falta a chave da ${escapeHtml(nome)} nas Configurações.</div>
      </div>
      <button class="btn btn-ghost btn-sm" data-go="settings">Configurar</button>
    </div>`;
  aviso.classList.remove('hidden');
  try { aviso.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* */ }
}

/* ----- Peças do resultado ----- */

const AFER_CLASSE_FAIXA = { alto: 'afer-verde', bom: 'afer-verde', medio: 'afer-amarelo', baixo: 'afer-vermelho' };

/* A NOTA COM A CONTA AO LADO. Mostrar "78/100" e mais nada seria repetir o que
 * o Julgador faz. O que esta ferramenta tem de diferente é poder escrever
 * "105 de 135 pontos" embaixo — e essa é a frase inteira do produto. */
function aferBlocoNota(res) {
  const f = res.faixa || {};
  return `
    <div class="afer-cabeca ${AFER_CLASSE_FAIXA[f.id] || ''}">
      <div class="afer-cabeca-lado">
        <div class="afer-faixa-label">${escapeHtml(f.label || '')}</div>
        <div class="afer-faixa-resumo">${escapeHtml(f.resumo || '')}</div>
        <div class="afer-conta">${res.pesoGanho} de ${res.pesoTotal} pontos possíveis · ${res.avaliadas.length} quesitos verificados</div>
      </div>
      <div class="afer-nota" title="Peso dos quesitos que passaram, dividido pelo peso dos que se aplicavam. A conta é do código — a IA só respondeu sim ou não.">
        <span class="afer-nota-valor">${res.nota}</span>
        <span class="afer-nota-de">/100</span>
      </div>
    </div>`;
}

/* ONDE A NOTA FOI EMBORA. Do mais caro para o mais barato, porque é a ordem em
 * que compensa consertar — e o peso aparece em cada linha para a conta não
 * virar mistério. */
function aferBlocoPerdidos(res) {
  const perdidos = res.perdidos || [];
  if (!perdidos.length) {
    return `
      <div class="afer-secao">
        <div class="afer-secao-titulo">Onde a nota foi embora</div>
        <div class="text-sm text-soft">Nenhum quesito ficou pelo caminho — o conteúdo passou em tudo que foi verificado.</div>
      </div>`;
  }
  const linhas = perdidos.map((q) => `
    <div class="afer-perdido">
      <span class="afer-perdido-peso">−${q.peso}</span>
      <span class="afer-perdido-texto">${escapeHtml(q.pergunta)}</span>
      <span class="afer-perdido-resp">respondido: <strong>${q.resposta === 'sim' ? 'SIM' : 'NÃO'}</strong>${q.consenso < 1 ? ` · ${Math.max(q.sim, q.nao)} de ${q.votos}` : ''}</span>
    </div>`).join('');
  return `
    <div class="afer-secao">
      <div class="afer-secao-titulo">Onde a nota foi embora</div>
      <div class="text-xs text-mute mb-1">Do mais caro para o mais barato. O número é quanto cada quesito custou na nota.</div>
      ${linhas}
    </div>`;
}

/* ONDE AS RODADAS DISCORDARAM. Não muda a resposta — muda o quanto se pode
 * confiar nela, e isso o usuário precisa ver antes de refazer um vídeo. */
function aferBlocoDivergencias(res) {
  const div = res.divergentes || [];
  if (!div.length) return '';
  const linhas = div.map((q) => `
    <div class="afer-divergente">
      <span class="afer-divergente-votos">${q.sim}×SIM · ${q.nao}×NÃO</span>
      <span class="afer-divergente-texto">${escapeHtml(q.pergunta)}</span>
    </div>`).join('');
  return `
    <div class="afer-secao">
      <div class="afer-secao-titulo">Onde as leituras discordaram</div>
      <div class="text-xs text-mute mb-1">A resposta predominante valeu, mas nestes quesitos ela ficou no fio — vale conferir você mesmo.</div>
      ${linhas}
    </div>`;
}

function aferBlocoBlocos(res) {
  const blocos = (res.porBloco || []).filter((b) => b.nota != null);
  if (!blocos.length) return '';
  const barras = blocos.map((b) => {
    const faixa = b.nota >= 80 ? 'ok' : (b.nota >= 50 ? 'medio' : 'baixo');
    return `
      <div class="afer-bloco">
        <div class="afer-bloco-topo">
          <span class="afer-bloco-label">${escapeHtml(b.label)}</span>
          <span class="afer-bloco-nota">${b.nota}</span>
        </div>
        <div class="afer-bloco-barra"><span class="afer-bloco-preenche afer-faixa-${faixa}" style="width:${Math.max(2, b.nota)}%"></span></div>
        <div class="afer-bloco-desc">${escapeHtml(b.desc)} · ${b.peso} pontos em jogo</div>
      </div>`;
  }).join('');
  return `
    <div class="afer-secao">
      <div class="afer-secao-titulo">Por bloco</div>
      <div class="afer-blocos">${barras}</div>
    </div>`;
}

/* O QUESTIONÁRIO INTEIRO — a auditoria. Recolhido porque quem quer saber o que
 * fazer já leu as duas listas acima; aberto porque quem discorda da nota tem o
 * direito de achar a linha e conferir. */
function aferBlocoQuestionario(item) {
  const res = (item.resultado || {});
  const qs = res.questoes || [];
  if (!qs.length) return '';
  const linhas = qs.map((q) => {
    const naoVerificada = !q.votos;
    const classe = naoVerificada ? 'afer-q-vazia' : (q.acertou ? 'afer-q-ok' : 'afer-q-falha');
    const resp = naoVerificada ? '—' : (q.resposta === 'sim' ? 'SIM' : 'NÃO');
    return `
      <div class="afer-q ${classe}">
        <span class="afer-q-resp">${resp}</span>
        <span class="afer-q-texto">${escapeHtml(q.pergunta)}</span>
        <span class="afer-q-meta">${naoVerificada ? 'não verificado' : `${q.sim}/${q.votos} sim · peso ${q.peso} · ${q.acertou ? `+${q.peso}` : '0'}`}</span>
      </div>`;
  }).join('');
  return `
    <details class="causo-mesa">
      <summary>O questionário — pergunta por pergunta</summary>
      <div class="causo-mesa-body">
        <div class="text-xs text-mute mb-1">${item.rodadasValidas} leitura(s) independente(s) do mesmo questionário. A IA respondeu apenas SIM ou NÃO, sem ver peso nenhum; a nota é a soma que aparece na coluna da direita.</div>
        ${linhas}
      </div>
    </details>`;
}

function aferLimparResultado() {
  _aferResultadoVisivel = false;
  _aferItemAtual = null;
  const area = $('#af-result-area');
  if (!area) return;
  area.innerHTML = `
    <div class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      </div>
      <div class="empty-title">Aguardando</div>
      <div class="empty-desc">Cole o conteúdo acima. A IA responde a um questionário de SIM ou NÃO, várias vezes; a nota é calculada aqui, pelo código, e você pode conferir a conta.</div>
    </div>`;
}

function aferNovoConteudo(semPerguntar) {
  const conteudo = String(($('#af-conteudo') || {}).value || '').trim();
  const guardado = (State.afericoes || []).some((x) => String(x.conteudo || '').trim() === conteudo);
  if (!semPerguntar && conteudo && !guardado
      && !confirm('Este conteúdo ainda não foi aferido e será apagado. Continuar?')) return false;

  const d = aferidorDraft();
  // O número de rodadas sobrevive: é configuração da sessão, não do conteúdo.
  State.aferidorDraft = { conteudo: '', visual: '', titulo: '', legenda: '', rodadas: d.rodadas || String(AFER_RODADAS_PADRAO) };
  saveAferidorDraft();
  aferPreencher();
  // `aferPreencher` só atribui `.value`, e atribuição não dispara evento — quem
  // escuta `input` (o × de limpar campo) não ficaria sabendo.
  ['#af-conteudo', '#af-visual', '#af-titulo', '#af-legenda'].forEach((sel) => {
    const el = $(sel);
    if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  aferLimparResultado();
  const campo = $('#af-conteudo');
  if (campo) { try { campo.focus(); } catch (_) { /* */ } }
  return true;
}

function renderAferResultado(item) {
  const area = $('#af-result-area');
  if (!area) return;
  _aferResultadoVisivel = true;
  _aferItemAtual = item;
  const res = item.resultado || {};
  area.innerHTML = `
    ${aferBlocoNota(res)}
    ${aferBlocoPerdidos(res)}
    ${aferBlocoDivergencias(res)}
    ${aferBlocoBlocos(res)}
    ${aferBlocoQuestionario(item)}
    <div class="flex gap-1 flex-wrap mt-2">
      <button class="btn btn-accent btn-sm" id="af-result-novo" title="Limpa os campos para aferir outro conteúdo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Aferir outro conteúdo
      </button>
      <button class="btn btn-ghost btn-sm" id="af-result-copy">Copiar o resultado</button>
      <button class="btn btn-ghost btn-sm" id="af-result-del" title="Excluir" aria-label="Excluir">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
    <div class="text-xs text-mute mt-2">A IA respondeu ao questionário ${item.rodadasValidas} vez(es), sem ver os pesos. A nota saiu de uma conta do código, não de um juízo dela — e as leituras concordaram em ${res.consensoMedio}% dos quesitos.</div>`;

  const novo = $('#af-result-novo');
  if (novo) novo.onclick = () => {
    if (aferNovoConteudo(true)) {
      toast('Mesa limpa. Cole o próximo conteúdo.', 'success');
      try { $('#af-conteudo').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* */ }
    }
  };
  const copy = $('#af-result-copy');
  if (copy) copy.onclick = () => copyTextComAviso(aferResultadoEmTexto(item), 'Resultado copiado.');
  const del = $('#af-result-del');
  if (del) del.onclick = () => {
    if (!confirm('Excluir esta aferição?')) return;
    State.afericoes = (State.afericoes || []).filter((x) => x.id !== item.id);
    saveAfericoes();
    aferLimparResultado();
    renderAferHistorico();
    toast('Removido.', 'success');
  };
}

/** O resultado em texto puro — e ele carrega a conta, não só o número. */
function aferResultadoEmTexto(item) {
  const res = item.resultado || {};
  const linhas = [];
  linhas.push(`${res.nota}/100 — ${(res.faixa || {}).label || ''}`);
  linhas.push(`${res.pesoGanho} de ${res.pesoTotal} pontos · ${res.avaliadas.length} quesitos · ${item.rodadasValidas} leitura(s)`);

  if ((res.perdidos || []).length) {
    linhas.push('');
    linhas.push('ONDE A NOTA FOI EMBORA');
    res.perdidos.forEach((q) => linhas.push(`-${q.peso} · ${q.pergunta} → ${q.resposta === 'sim' ? 'SIM' : 'NÃO'}`));
  }
  if ((res.divergentes || []).length) {
    linhas.push('');
    linhas.push('ONDE AS LEITURAS DISCORDARAM');
    res.divergentes.forEach((q) => linhas.push(`${q.sim}×SIM ${q.nao}×NÃO · ${q.pergunta}`));
  }
  const blocos = (res.porBloco || []).filter((b) => b.nota != null);
  if (blocos.length) {
    linhas.push('');
    linhas.push('POR BLOCO');
    blocos.forEach((b) => linhas.push(`${b.label}: ${b.nota}/100`));
  }
  linhas.push('');
  linhas.push('A IA respondeu apenas SIM ou NÃO, sem ver os pesos. A nota é uma conta do código.');
  return linhas.join('\n');
}

/* ----- Histórico ----- */

function renderAferHistorico() {
  const lista = $('#af-history-list');
  if (!lista) return;
  const itens = State.afericoes || [];
  if (!itens.length) {
    lista.innerHTML = '<div class="text-sm text-mute" style="padding:0.5rem;">Nada aferido ainda.</div>';
    return;
  }
  lista.innerHTML = itens.map((it) => {
    const r = it.resultado || {};
    return `
      <div class="list-item" data-afer-id="${escapeHtml(it.id)}" role="button" tabindex="0">
        <div class="list-item-header">
          <div class="list-item-title">${escapeHtml(it.nome || 'Conteúdo')}</div>
          <button class="list-item-del" data-afer-del="${escapeHtml(it.id)}" title="Excluir" aria-label="Excluir">✕</button>
        </div>
        <div class="list-item-meta">${r.nota}/100 · ${escapeHtml((r.faixa || {}).label || '')} · ${escapeHtml(formatDate(it.createdAt))}</div>
      </div>`;
  }).join('');

  lista.querySelectorAll('[data-afer-id]').forEach((el) => {
    const abrir = () => {
      const it = (State.afericoes || []).find((x) => x.id === el.dataset.aferId);
      if (!it) return;
      const d = aferidorDraft();
      d.conteudo = it.conteudo || d.conteudo;
      d.visual = it.visual || '';
      d.titulo = (it.embalagem || {}).titulo || '';
      d.legenda = (it.embalagem || {}).legenda || '';
      saveAferidorDraft();
      aferPreencher();
      renderAferResultado(it);
      fecharAferHistorico();
    };
    el.onclick = (e) => { if (!e.target.closest('[data-afer-del]')) abrir(); };
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } };
  });
  lista.querySelectorAll('[data-afer-del]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      State.afericoes = (State.afericoes || []).filter((x) => x.id !== b.dataset.aferDel);
      saveAfericoes();
      renderAferHistorico();
    };
  });
}

function abrirAferHistorico() {
  renderAferHistorico();
  const d = $('#af-history-drawer'), b = $('#af-history-backdrop');
  if (d) d.classList.add('open');
  if (b) b.classList.remove('hidden');
}
function fecharAferHistorico() {
  const d = $('#af-history-drawer'), b = $('#af-history-backdrop');
  if (d) d.classList.remove('open');
  if (b) b.classList.add('hidden');
}

/* ----- Montagem da tela ----- */

function aferPreencher() {
  const d = aferidorDraft();
  const set = (sel, v) => { const el = $(sel); if (el) el.value = v || ''; };
  set('#af-conteudo', d.conteudo);
  set('#af-visual', d.visual);
  set('#af-titulo', d.titulo);
  set('#af-legenda', d.legenda);
  set('#af-rodadas', d.rodadas || String(AFER_RODADAS_PADRAO));
}

function aferEmbalagemAtual() {
  const d = aferidorDraft();
  return { titulo: d.titulo || '', legenda: d.legenda || '' };
}

function aferTelaDeEspera(passos) {
  return `
    <div class="empty">
      <div class="spinner spinner-lg" style="color: var(--accent); border-right-color: transparent; margin: 0 auto 1rem;"></div>
      <div class="empty-title afer-loading-title">Respondendo ao questionário…</div>
      <div class="empty-desc afer-loading-desc">Leituras independentes do mesmo conteúdo.</div>
      <div class="pipeline-steps">${passos}</div>
    </div>`;
}

function aferEtapaVisual(hostSel) {
  return (chave, titulo, desc) => {
    const t = $(`${hostSel} .afer-loading-title`), dsc = $(`${hostSel} .afer-loading-desc`);
    if (t) t.textContent = titulo;
    if (dsc) dsc.textContent = desc;
    $$(`${hostSel} .pipeline-step`).forEach((el) => {
      if (el.dataset.step === chave) el.classList.add('active');
      else if (el.classList.contains('active')) el.classList.replace('active', 'done');
    });
  };
}

function renderAferidor() {
  /* Texto vindo de outra ferramenta vira o CONTEÚDO a aferir. Entra antes de
   * `aferPreencher`, que é quem escreve na tela. */
  if (State.handoff && State.handoff.target === 'aferidor') {
    const texto = String(State.handoff.text || '');
    State.handoff = null;
    if (texto.trim()) {
      const d = aferidorDraft();
      d.conteudo = texto;
      d.visual = ''; d.titulo = ''; d.legenda = '';
      saveAferidorDraft();
      aferLimparResultado();
    }
  }

  // O seletor de rodadas sai do registro, não do HTML.
  const sel = $('#af-rodadas');
  if (sel) {
    sel.innerHTML = AFER_RODADAS.map((n) =>
      `<option value="${n}">${n} leituras${n === AFER_RODADAS_PADRAO ? ' (padrão)' : ''}</option>`).join('');
  }

  aferPreencher();
  { const a = $('#af-api-warning'); if (a) a.classList.add('hidden'); }
  { const p = $('#af-attach-pending'); if (p) p.innerHTML = ''; }

  // Rascunho — cada campo guarda sozinho. Religar substitui em vez de acumular.
  [['#af-conteudo', 'conteudo'], ['#af-visual', 'visual'], ['#af-titulo', 'titulo'],
    ['#af-legenda', 'legenda'], ['#af-rodadas', 'rodadas']].forEach(([s, chave]) => {
    const el = $(s);
    if (!el) return;
    const guardar = () => {
      aferidorDraft()[chave] = el.value;
      saveAferidorDraft();
      if (chave === 'conteudo' && _aferResultadoVisivel) aferLimparResultado();
    };
    el.oninput = guardar;
    // `change` também: no <select> quem escolhe o evento é o navegador, e a
    // plataforma inteira liga seletor por `change`.
    if (el.tagName === 'SELECT') el.onchange = guardar;
  });

  if ($('#af-novo')) $('#af-novo').onclick = () => {
    if (aferNovoConteudo()) toast('Mesa limpa. Cole o próximo conteúdo.', 'success');
  };
  if ($('#af-history-open')) $('#af-history-open').onclick = abrirAferHistorico;
  if ($('#af-history-close')) $('#af-history-close').onclick = fecharAferHistorico;
  if ($('#af-history-backdrop')) $('#af-history-backdrop').onclick = fecharAferHistorico;
  if ($('#af-history-clear')) $('#af-history-clear').onclick = () => {
    if (!(State.afericoes || []).length) return;
    if (!confirm('Apagar todas as aferições guardadas?')) return;
    State.afericoes = [];
    saveAfericoes();
    renderAferHistorico();
    toast('Histórico limpo.', 'success');
  };

  if ($('#af-submit')) $('#af-submit').onclick = async () => {
    const conteudo = String(($('#af-conteudo') || {}).value || '').trim();
    if (conteudo.length < 40) {
      toast('Cole o roteiro ou a transcrição — o questionário precisa do conteúdo inteiro.', 'info', 5000);
      return;
    }
    { const a = $('#af-api-warning'); if (a) a.classList.add('hidden'); }
    if (!aferTemChave()) { aferAvisarSemChave(); return; }

    const btn = $('#af-submit');
    const original = btn.innerHTML;
    const rodadas = aferRodadas(aferidorDraft().rodadas);
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${rodadas} leituras…`;
    // A tela de espera substitui o resultado, e o estado precisa dizer isso.
    _aferResultadoVisivel = false;
    _aferItemAtual = null;
    $('#af-result-area').innerHTML = aferTelaDeEspera(`
      <span class="pipeline-step" data-step="rodadas">Questionário</span>
      <span class="pipeline-step" data-step="calculo">Cálculo</span>`);

    try {
      const embalagem = aferEmbalagemAtual();
      const visual = String(($('#af-visual') || {}).value || '').trim();
      const res = await runAfericaoPipeline({
        conteudo, embalagem, visual, rodadas,
        call: callLLM, onEtapa: aferEtapaVisual('#af-result-area'),
      });
      const item = {
        id: uuid(),
        createdAt: new Date().toISOString(),
        nome: embalagem.titulo || conteudo.slice(0, 60).replace(/\s+/g, ' '),
        conteudo, embalagem, visual,
        rodadasPedidas: res.rodadasPedidas,
        rodadasValidas: res.rodadasValidas,
        resultado: res.resultado,
        model: res.model,
      };
      State.afericoes = State.afericoes || [];
      State.afericoes.unshift(item);
      saveAfericoes();
      renderAferResultado(item);
      renderAferHistorico();
      if (res.falhas) {
        toast(`${res.falhas} leitura(s) não responderam — a nota saiu das ${res.rodadasValidas} que responderam.`, 'info', 6000);
      } else {
        toast(`${res.resultado.nota}/100 · ${res.resultado.faixa.label}`, 'success');
      }
    } catch (err) {
      toast(err.message || 'Não foi possível aferir.', 'error', 6000);
      $('#af-result-area').innerHTML = `
        <div class="empty"><div class="empty-title">Erro</div>
        <div class="empty-desc">${escapeHtml(err.message || 'Tente novamente.')}</div></div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  };

  if (typeof ingestLigarAnexo === 'function') {
    ingestLigarAnexo({
      botao: '#af-attach-btn', input: '#af-attach-input',
      campo: '#af-conteudo', pendente: '#af-attach-pending', organizar: true,
    });
  }

  if (!_aferResultadoVisivel) aferLimparResultado();
  renderAferHistorico();
}
