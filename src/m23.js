'use strict';
/* ============================================================================
 * M23 — a tela do laboratório 25/23
 *
 * O motor (m23-motor.js) só sabe de números. Esta tela decide o que mostrar
 * primeiro, e a ordem carrega uma posição: antes de rodar qualquer busca, a
 * pessoa vê a PREMISSA (que reduzir para v dezenas é uma aposta sobre o
 * sorteio, com uma probabilidade que aparece sempre) e a PAREDE PROVADA
 * (quanto custa, em cartelas, cobrir cada combinação possível de 15 dezenas
 * com cartelas de 15 — a conta exata, não uma opinião). Só depois disso vem
 * o botão "Investigar": a busca de verdade, que varre universo × tamanho de
 * cartela × meta de acertos tentando construções melhores que "jogar tudo".
 *
 * Nenhum resultado aqui é anunciado como garantia sem ter `complete: true`
 * do motor — ver `m23BadgeGarantia`. E nenhum retorno financeiro aparece
 * sem que a pessoa tenha informado o valor do prêmio: o motor devolve zero
 * nesse caso (ver `m23ComputeExpectedReturn`), e a tela mostra "—" em vez de
 * fingir que zero é um resultado.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/* §1 — Estado do formulário e da campanha em andamento                        */
/* -------------------------------------------------------------------------- */

let _m23Rodando = false;
let _m23Cancelar = false;
let _m23UltimaCampanha = null; // { params, results, startedAt }

function m23Params() {
  if (!State.m23Params) {
    State.m23Params = {
      vMin: 23, vMax: 23,
      cMin: 15, cMax: 20,
      tMin: 11, tMax: 15,
      basePrice: 3,
      prizes: { 11: '', 12: '', 13: '', 14: '', 15: '' },
      maxConfigs: 10,
      tempoPorConfigS: 4,
      precisao: 'padrao', // rapida | padrao | detalhada
    };
  }
  return State.m23Params;
}
function m23SaveParams() {
  saveJSON(STORAGE_KEYS.m23Params, State.m23Params || {});
}
function m23SaveRuns() {
  saveJSON(STORAGE_KEYS.m23Runs, State.m23Runs || []);
}

const M23_PRECISAO_TRIALS = { rapida: 800, padrao: 3000, detalhada: 8000 };

function m23FormatBRL(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 1000 ? 0 : 2 });
}
function m23FormatInt(n) { return Math.round(Number(n) || 0).toLocaleString('pt-BR'); }
function m23FormatPct(f) { return `${(Number(f) * 100).toFixed(2)}%`; }

/* -------------------------------------------------------------------------- */
/* §2 — A premissa: o que "reduzir para v dezenas" custa em probabilidade      */
/* -------------------------------------------------------------------------- */

function m23RenderPremissa() {
  const host = $('#m23-premissa');
  if (!host) return;
  const p = m23Params();
  const v = Math.max(15, Math.min(25, Number(p.vMin) || 23));
  const prob = m23ProbDrawWithinUniverse(v);
  const excluidas = M23_POOL_SIZE - v;
  host.innerHTML = `
    <div class="m23-premissa-grid">
      <div class="stat">
        <span class="text-xs text-mute">Dezenas excluídas do universo</span>
        <span class="m23-stat-valor">${excluidas}</span>
        <span class="text-xs text-soft">de ${M23_POOL_SIZE} → universo reduzido de ${v}</span>
      </div>
      <div class="stat">
        <span class="text-xs text-mute">Chance de o sorteio caber inteiro nas ${v}</span>
        <span class="m23-stat-valor">${m23FormatPct(prob)}</span>
        <span class="text-xs text-soft">C(${v},15) / C(25,15) — é a premissa de tudo abaixo</span>
      </div>
      <div class="stat">
        <span class="text-xs text-mute">Garantia de UMA cartela de 20 dezenas</span>
        <span class="m23-stat-valor">${m23SingleTicketGuarantee(v, 20)} de 15</span>
        <span class="text-xs text-soft">casa dos pombos: c + 15 − v</span>
      </div>
    </div>
    <p class="text-sm text-soft mt-2">
      Tudo neste laboratório é <strong>condicional</strong> a essa premissa: se o sorteio sortear
      alguma das ${excluidas} dezenas de fora, nenhuma cartela construída aqui dentro alcança os 15 pontos —
      por isso a chance acima nunca fica escondida atrás da palavra "garantia".
    </p>`;
}

/* -------------------------------------------------------------------------- */
/* §3 — A parede provada (calculadora ao vivo + demonstrações pequenas)        */
/* -------------------------------------------------------------------------- */

function m23RenderParede() {
  const host = $('#m23-parede');
  if (!host) return;
  const p = m23Params();
  const v = Math.max(15, Math.min(25, Number(p.vMin) || 23));
  const numTickets = m23NCr(v, 15);
  const custo = m23ComputeCost(numTickets, 15, Number(p.basePrice) || M23_BASE_PRICE);
  host.innerHTML = `
    <p class="text-sm text-soft">
      Cobrir <strong>toda</strong> combinação possível de 15 dezenas dentro de um universo de ${v}, jogando
      cartelas do próprio tamanho (15 dezenas), significa jogar exatamente
      <strong>C(${v},15)</strong> — porque uma cartela de 15 só bate 15 pontos contra o sorteio que for
      IDÊNTICO a ela; não existe cartela que cubra duas combinações de 15 ao mesmo tempo.
    </p>
    <div class="m23-parede-conta">
      <div><span class="text-xs text-mute">Cartelas necessárias</span><br><strong>${m23FormatInt(numTickets)}</strong></div>
      <div><span class="text-xs text-mute">Custo total</span><br><strong>${m23FormatBRL(custo)}</strong></div>
      <div><span class="text-xs text-mute">Cota de Schönheim (confere)</span><br><strong>${m23FormatInt(m23SchonheimBound(v, 15, 15))}</strong></div>
    </div>
    <p class="text-sm text-soft mt-2">
      Essa não é uma limitação do algoritmo de busca — é uma contagem exata (cada cartela de 15 cobre
      C(15,15)=1 combinação de 15). Nenhum mecanismo de busca reduz esse número com cartela de 15 dezenas.
      O que <strong>muda</strong> a conta é o tamanho da cartela — ver a seção de busca abaixo, onde cartelas
      de até 20 dezenas cobrem muitas combinações de uma vez.
    </p>
    <details class="afer-detalhes mt-2">
      <summary>Rodar uma demonstração pequena (ao vivo, no navegador)</summary>
      <div class="afer-detalhes-body">
        <p class="text-sm text-soft">
          Duas provas em miniatura, construídas pelo próprio motor de busca — não são números digitados,
          são o resultado de rodar o algoritmo agora:
        </p>
        <div class="flex gap-1 flex-wrap mt-1">
          <button class="btn btn-ghost btn-sm" id="m23-demo-parede" type="button">Demonstrar a parede (universo de 6, meta = tamanho da cartela)</button>
          <button class="btn btn-ghost btn-sm" id="m23-demo-fano" type="button">Demonstrar um caso que a busca resolve quase no piso teórico</button>
        </div>
        <div id="m23-demo-resultado" class="mt-2"></div>
      </div>
    </details>`;

  $('#m23-demo-parede').onclick = () => m23RodarDemoParede();
  $('#m23-demo-fano').onclick = () => m23RodarDemoFano();
}

async function m23RodarDemoParede() {
  const out = $('#m23-demo-resultado');
  out.innerHTML = '<span class="text-sm text-soft">Rodando…</span>';
  const res = await m23BuildCoveringGreedy({ v: 6, c: 3, t: 3, timeBudgetMs: 4000, maxBlocks: 30 });
  const piso = m23CoveringLowerBound(6, 3, 3);
  out.innerHTML = `
    <div class="callout-warn card">
      <strong>Universo de 6, cartela de 3, meta = 3 (o mesmo formato do problema real, em miniatura).</strong>
      A busca encontrou ${res.blocks.length} cartelas para cobrir 100% das combinações — e o piso teórico
      (contagem dupla) também é ${m23FormatInt(piso)}. Bateram exatamente, porque quando a meta é igual ao
      tamanho da cartela cada uma só cobre a si mesma: não existe atalho, em miniatura ou em escala real.
    </div>`;
}

async function m23RodarDemoFano() {
  const out = $('#m23-demo-resultado');
  out.innerHTML = '<span class="text-sm text-soft">Rodando…</span>';
  const res = await m23BuildCoveringGreedy({ v: 7, c: 3, t: 2, timeBudgetMs: 4000, maxBlocks: 35, sampleSize: 30, seed: Date.now() & 0xffff });
  const piso = m23CoveringLowerBound(7, 3, 2);
  const bateu = res.blocks.length <= piso + 2;
  out.innerHTML = `
    <div class="card ${bateu ? '' : 'callout-warn'}">
      <strong>Universo de 7, cartela de 3, meta = 2 (aqui a meta é MENOR que a cartela).</strong>
      A busca encontrou cobertura completa com ${res.blocks.length} cartelas, contra um piso teórico de
      ${piso}. ${bateu ? 'Ficou colada no piso — quando a estrutura permite, o motor acha construções quase ótimas.' : 'Ficou acima do piso — o guloso estocástico não garante o ótimo, só uma cobertura válida.'}
      É a prova de que a "parede" não é do algoritmo: quando meta &lt; cartela, a busca de verdade encontra
      soluções muito menores do que jogar tudo.
    </div>`;
}

/* -------------------------------------------------------------------------- */
/* §4 — Formulário de parâmetros                                               */
/* -------------------------------------------------------------------------- */

function m23RenderForm() {
  const host = $('#m23-form');
  if (!host) return;
  const p = m23Params();
  host.innerHTML = `
    <div class="m23-form-grid">
      <div class="field">
        <label class="label">Universo reduzido (v) — de / até</label>
        <div class="flex gap-1"><input class="input" type="number" min="15" max="25" id="m23-vmin" value="${p.vMin}"><input class="input" type="number" min="15" max="25" id="m23-vmax" value="${p.vMax}"></div>
        <span class="input-helper">15 a 25 dezenas. O cenário pedido é 23 — abra o intervalo para a busca explorar universos vizinhos também.</span>
      </div>
      <div class="field">
        <label class="label">Tamanho da cartela (c) — de / até</label>
        <div class="flex gap-1"><input class="input" type="number" min="15" max="20" id="m23-cmin" value="${p.cMin}"><input class="input" type="number" min="15" max="20" id="m23-cmax" value="${p.cMax}"></div>
        <span class="input-helper">15 a 20 dezenas (limite do jogo oficial). Cartelas maiores custam mais por unidade e cobrem mais combinações de uma vez.</span>
      </div>
      <div class="field">
        <label class="label">Meta de acertos (t) — de / até</label>
        <div class="flex gap-1"><input class="input" type="number" min="10" max="15" id="m23-tmin" value="${p.tMin}"><input class="input" type="number" min="10" max="15" id="m23-tmax" value="${p.tMax}"></div>
        <span class="input-helper">15 = o objetivo pedido. A busca testa metas menores junto, para comparar o custo de garantir cada faixa.</span>
      </div>
      <div class="field">
        <label class="label">Preço da aposta simples de 15 dezenas (R$)</label>
        <input class="input" type="number" min="0.01" step="0.01" id="m23-baseprice" value="${p.basePrice}">
        <span class="input-helper">Referência estável — confira o valor vigente antes de decidir com dinheiro real.</span>
      </div>
      <div class="field">
        <label class="label">Profundidade da campanha</label>
        <input class="input" type="number" min="1" max="40" id="m23-maxconfigs" value="${p.maxConfigs}">
        <span class="input-helper">Quantas combinações de (universo, cartela, meta) testar nesta rodada.</span>
      </div>
      <div class="field">
        <label class="label">Orçamento de busca por configuração</label>
        <select class="select" id="m23-tempo">
          <option value="2">Rápido (~2 s por configuração)</option>
          <option value="4">Padrão (~4 s por configuração)</option>
          <option value="8">Profundo (~8 s por configuração)</option>
          <option value="15">Muito profundo (~15 s por configuração)</option>
        </select>
      </div>
      <div class="field">
        <label class="label">Precisão da simulação (Monte Carlo)</label>
        <select class="select" id="m23-precisao">
          <option value="rapida">Rápida (800 sorteios simulados)</option>
          <option value="padrao">Padrão (3.000 sorteios simulados)</option>
          <option value="detalhada">Detalhada (8.000 sorteios simulados)</option>
        </select>
      </div>
    </div>
    <details class="afer-detalhes mt-2">
      <summary>Tabela de prêmios (opcional — sem ela o retorno esperado fica em branco, nunca inventado)</summary>
      <div class="afer-detalhes-body">
        <div class="m23-prize-grid">
          ${[11, 12, 13, 14, 15].map((t) => `
            <div class="field">
              <label class="label" for="m23-prize-${t}">Prêmio médio para ${t} pontos (R$)</label>
              <input class="input" type="number" min="0" step="0.01" id="m23-prize-${t}" value="${escapeHtml(String(p.prizes?.[t] ?? ''))}" placeholder="informe o valor vigente">
            </div>`).join('')}
        </div>
      </div>
    </details>`;

  $('#m23-tempo').value = String(p.tempoPorConfigS);
  $('#m23-precisao').value = p.precisao;

  const ids = ['m23-vmin', 'm23-vmax', 'm23-cmin', 'm23-cmax', 'm23-tmin', 'm23-tmax', 'm23-baseprice', 'm23-maxconfigs'];
  ids.forEach((id) => { $(`#${id}`).oninput = m23OnFormChange; });
  $('#m23-tempo').onchange = m23OnFormChange;
  $('#m23-precisao').onchange = m23OnFormChange;
  [11, 12, 13, 14, 15].forEach((t) => { $(`#m23-prize-${t}`).oninput = m23OnFormChange; });
}

function m23OnFormChange() {
  const p = m23Params();
  p.vMin = Math.max(15, Math.min(25, Number($('#m23-vmin').value) || 23));
  p.vMax = Math.max(p.vMin, Math.min(25, Number($('#m23-vmax').value) || p.vMin));
  p.cMin = Math.max(15, Math.min(20, Number($('#m23-cmin').value) || 15));
  p.cMax = Math.max(p.cMin, Math.min(20, Number($('#m23-cmax').value) || p.cMin));
  p.tMin = Math.max(10, Math.min(15, Number($('#m23-tmin').value) || 11));
  p.tMax = Math.max(p.tMin, Math.min(15, Number($('#m23-tmax').value) || p.tMin));
  p.basePrice = Math.max(0.01, Number($('#m23-baseprice').value) || M23_BASE_PRICE);
  p.maxConfigs = Math.max(1, Math.min(40, Number($('#m23-maxconfigs').value) || 10));
  p.tempoPorConfigS = Number($('#m23-tempo').value) || 4;
  p.precisao = $('#m23-precisao').value || 'padrao';
  p.prizes = p.prizes || {};
  [11, 12, 13, 14, 15].forEach((t) => { p.prizes[t] = $(`#m23-prize-${t}`).value; });
  m23SaveParams();
  m23RenderPremissa();
  m23RenderParede();
}

/* -------------------------------------------------------------------------- */
/* §5 — Rodar a campanha e mostrar progresso                                   */
/* -------------------------------------------------------------------------- */

function m23Range(min, max) {
  const out = [];
  for (let x = min; x <= max; x++) out.push(x);
  return out;
}

function m23PrizeTableNumerica(prizes) {
  const out = {};
  for (const t of [11, 12, 13, 14, 15]) {
    const v = Number(prizes?.[t]);
    if (v > 0) out[t] = v;
  }
  return out;
}

async function m23IniciarCampanha() {
  if (_m23Rodando) return;
  _m23Rodando = true;
  _m23Cancelar = false;
  const p = m23Params();
  const startBtn = $('#m23-start-btn'), stopBtn = $('#m23-stop-btn'), status = $('#m23-status');
  startBtn.disabled = true;
  stopBtn.classList.remove('hidden');
  status.textContent = 'Investigando…';

  const progressoHost = $('#m23-progress');
  const resultsHost = $('#m23-results');
  progressoHost.innerHTML = '';
  resultsHost.innerHTML = '<span class="text-sm text-soft">Nenhum resultado ainda — a primeira configuração está rodando.</span>';

  const trials = M23_PRECISAO_TRIALS[p.precisao] || M23_PRECISAO_TRIALS.padrao;
  const tempoMs = Math.max(1000, (Number(p.tempoPorConfigS) || 4) * 1000);
  const seed = (Date.now() % 1000000) || 1;
  const prizeTable = m23PrizeTableNumerica(p.prizes);

  const startedAt = new Date().toISOString();
  let configAtual = null;

  const results = await m23RunCampaign({
    vRange: m23Range(p.vMin, p.vMax),
    cRange: m23Range(p.cMin, p.cMax),
    tRange: m23Range(p.tMin, p.tMax),
    maxConfigs: p.maxConfigs,
    basePrice: p.basePrice,
    prizeTable,
    greedyTimeMs: Math.round(tempoMs * 0.7),
    annealTimeMs: Math.round(tempoMs * 0.3),
    monteCarloTrials: trials,
    seed,
    shouldStop: () => _m23Cancelar,
    onConfigStart: (cfg) => {
      configAtual = cfg;
      progressoHost.innerHTML = m23RenderProgressoConfig(cfg, null);
    },
    onResult: (_res, ranked) => {
      resultsHost.innerHTML = m23RenderResultados(ranked);
      m23WireResultados(ranked);
    },
  }).catch((err) => {
    toast('A campanha foi interrompida por um erro: ' + (err?.message || err), 'error');
    return [];
  });

  progressoHost.innerHTML = _m23Cancelar
    ? '<span class="text-sm text-soft">Busca interrompida pelo usuário — os resultados já encontrados continuam abaixo.</span>'
    : `<span class="text-sm text-soft">Campanha concluída: ${results.length} configuração(ões) investigada(s).</span>`;

  _m23UltimaCampanha = { params: JSON.parse(JSON.stringify(p)), results, startedAt, finishedAt: new Date().toISOString() };
  resultsHost.innerHTML = m23RenderResultados(results);
  m23WireResultados(results);

  startBtn.disabled = false;
  stopBtn.classList.add('hidden');
  status.textContent = '';
  _m23Rodando = false;

  if (results.length) m23SalvarNoHistorico(_m23UltimaCampanha);
}

function m23RenderProgressoConfig(cfg, prog) {
  const pct = prog ? Math.min(100, Math.round(prog.coverage * 100)) : 0;
  return `
    <div class="text-sm text-soft mb-1">Investigando: universo ${cfg.v} · cartela ${cfg.c} · meta ${cfg.t} pontos</div>
    <div class="progress"><div class="progress-bar" style="width:${pct}%;"></div></div>`;
}

function m23PararCampanha() {
  _m23Cancelar = true;
  $('#m23-status').textContent = 'Interrompendo…';
}

/* -------------------------------------------------------------------------- */
/* §6 — Resultados ranqueados                                                  */
/* -------------------------------------------------------------------------- */

function m23BadgeGarantia(r) {
  if (r.complete) return '<span class="badge success">Garantia matemática</span>';
  return '<span class="badge warn">Resultado experimental — sem garantia</span>';
}

function m23RenderResultados(results) {
  if (!results || !results.length) {
    return '<span class="text-sm text-soft">Nenhum resultado ainda.</span>';
  }
  return results.map((r, i) => {
    const roi = r.cost > 0 ? (r.expectedReturn || 0) / r.cost : 0;
    const temPremio = r.expectedReturn > 0;
    return `
    <div class="list-item m23-result" data-m23-idx="${i}" role="button" tabindex="0">
      <div class="list-item-header">
        <div class="list-item-title">#${i + 1} · Universo ${r.v} · cartela ${r.c} · meta ${r.t} pontos</div>
        ${m23BadgeGarantia(r)}
      </div>
      <div class="list-item-meta">
        ${m23FormatInt(r.numTickets)} cartela(s) · cobertura ${m23FormatPct(r.coverageFraction)} ·
        custo ${m23FormatBRL(r.cost)} ·
        retorno esperado ${temPremio ? m23FormatBRL(r.expectedReturn) : '—'}
        ${temPremio ? ` · ROI ${(roi * 100).toFixed(1)}%` : ''}
      </div>
      <div class="m23-result-detail hidden" id="m23-detail-${i}"></div>
    </div>`;
  }).join('');
}

function m23RenderDetalhe(r) {
  const amostra = (r.blocks || []).slice(0, 6).map((b) => `[${b.map((x) => x + 1).join(', ')}]`).join('  ');
  const faixas = r.monteCarlo
    ? Object.keys(r.monteCarlo.tierProbability).map((t) => `
        <div class="m23-faixa-row">
          <span>${t} pontos</span>
          <span>chance de alguma cartela bater: ${m23FormatPct(r.monteCarlo.tierProbability[t])}</span>
          <span>média de cartelas premiadas por sorteio: ${r.monteCarlo.tierAvgTicketsPerDraw[t].toFixed(3)}</span>
        </div>`).join('')
    : '';
  return `
    <div class="card mt-1">
      <div class="text-sm">${escapeHtml(r.note || '')}</div>
      <div class="text-xs text-mute mt-1">Método: ${escapeHtml(r.method)} · piso teórico (contagem dupla): ${m23FormatInt(r.lowerBound)} · cota de Schönheim: ${m23FormatInt(r.schonheim)} · garantia de 1 cartela isolada: ${r.singleGuarantee} pontos</div>
      ${amostra ? `<div class="text-xs text-mute mt-1">Amostra de cartelas construídas: <span class="mono">${escapeHtml(amostra)}</span>${r.blocks.length > 6 ? ` … e mais ${r.blocks.length - 6}` : ''}</div>` : ''}
      ${faixas ? `<div class="mt-2">${faixas}</div>` : ''}
      ${r.expectedReturnDetail ? `<div class="text-xs text-mute mt-1">Retorno esperado é uma SIMULAÇÃO estatística (Monte Carlo) com a tabela de prêmios informada — não é uma promessa.</div>` : ''}
    </div>`;
}

function m23WireResultados(results) {
  $$('.m23-result').forEach((el) => {
    const idx = Number(el.dataset.m23Idx);
    const abrir = () => {
      const detailEl = $(`#m23-detail-${idx}`);
      if (!detailEl) return;
      const abrindo = detailEl.classList.contains('hidden');
      if (abrindo && !detailEl.dataset.filled) {
        detailEl.innerHTML = m23RenderDetalhe(results[idx]);
        detailEl.dataset.filled = '1';
      }
      detailEl.classList.toggle('hidden', !abrindo);
    };
    el.onclick = abrir;
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } };
  });
}

/* -------------------------------------------------------------------------- */
/* §7 — Histórico de campanhas                                                 */
/* -------------------------------------------------------------------------- */

function m23SalvarNoHistorico(campanha) {
  const resumo = {
    id: uuid(),
    createdAt: campanha.startedAt,
    params: campanha.params,
    melhor: campanha.results[0] || null,
    totalConfigs: campanha.results.length,
  };
  State.m23Runs = [resumo, ...(State.m23Runs || [])].slice(0, 50);
  m23SaveRuns();
}

function m23RenderHistorico() {
  const lista = $('#m23-history-list');
  if (!lista) return;
  const runs = State.m23Runs || [];
  if (!runs.length) {
    lista.innerHTML = '<div class="text-sm text-soft">Nenhuma campanha guardada ainda.</div>';
    return;
  }
  lista.innerHTML = runs.map((run) => {
    const m = run.melhor;
    const resumoTxt = m
      ? `${m23BadgeGarantia(m)} · universo ${m.v}/cartela ${m.c}/meta ${m.t} · ${m23FormatInt(m.numTickets)} cartelas`
      : 'sem resultados';
    return `
      <div class="list-item" data-m23-run="${escapeHtml(run.id)}" role="button" tabindex="0">
        <div class="list-item-header">
          <div class="list-item-title">${run.totalConfigs} configuração(ões)</div>
          <button class="list-item-del" data-m23-run-del="${escapeHtml(run.id)}" title="Excluir" aria-label="Excluir">✕</button>
        </div>
        <div class="list-item-meta">${resumoTxt} · ${escapeHtml(formatDate(run.createdAt))}</div>
      </div>`;
  }).join('');

  lista.querySelectorAll('[data-m23-run-del]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      State.m23Runs = (State.m23Runs || []).filter((r) => r.id !== btn.dataset.m23RunDel);
      m23SaveRuns();
      m23RenderHistorico();
    };
  });
  lista.querySelectorAll('[data-m23-run]').forEach((el) => {
    el.onclick = () => {
      const run = (State.m23Runs || []).find((r) => r.id === el.dataset.m23Run);
      if (!run) return;
      State.m23Params = JSON.parse(JSON.stringify(run.params));
      m23SaveParams();
      m23RenderForm();
      m23RenderPremissa();
      m23RenderParede();
      $('#m23-history-drawer').classList.remove('open');
      $('#m23-history-backdrop').classList.add('hidden');
      toast('Parâmetros daquela campanha recarregados no formulário.', 'info');
    };
  });
}

/* -------------------------------------------------------------------------- */
/* §8 — Entrada                                                                */
/* -------------------------------------------------------------------------- */

function renderM23() {
  m23RenderPremissa();
  m23RenderParede();
  m23RenderForm();
  m23RenderHistorico();

  $('#m23-start-btn').onclick = () => m23IniciarCampanha();
  $('#m23-stop-btn').onclick = () => m23PararCampanha();
  $('#m23-history-open').onclick = () => {
    m23RenderHistorico();
    $('#m23-history-drawer').classList.add('open');
    $('#m23-history-backdrop').classList.remove('hidden');
  };
  $('#m23-history-close').onclick = () => {
    $('#m23-history-drawer').classList.remove('open');
    $('#m23-history-backdrop').classList.add('hidden');
  };
  $('#m23-history-backdrop').onclick = () => {
    $('#m23-history-drawer').classList.remove('open');
    $('#m23-history-backdrop').classList.add('hidden');
  };
  $('#m23-history-clear').onclick = () => {
    if (!(State.m23Runs || []).length) return;
    State.m23Runs = [];
    m23SaveRuns();
    m23RenderHistorico();
  };

  if (_m23UltimaCampanha) {
    $('#m23-results').innerHTML = m23RenderResultados(_m23UltimaCampanha.results);
    m23WireResultados(_m23UltimaCampanha.results);
  }
}
