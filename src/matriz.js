'use strict';
/* ============================================================================
 * MATRIZ — a tela
 *
 * Ferramenta pessoal: sem histórico, sem contas, sem enfeite. A tela existe
 * para quatro gestos — carregar a matriz, escolher a meta, otimizar, exportar —
 * e para mostrar os números que provam que a otimização valeu a pena.
 *
 * O número que a tela nunca esconde é a RÉGUA: a mesma quantidade de cartelas
 * escolhida ao acaso. Sem ela, "62% de cobertura com 20.000 cartelas" não
 * significa nada — é preciso saber quanto um sorteio burro entregaria. Se a
 * vantagem fosse pequena, o algoritmo não se justificaria, e a tela mostraria
 * isso em vez de esconder.
 *
 * A matriz NÃO é persistida: 50.000 cartelas ocupam ~26 MB de índice, muito
 * além do localStorage. O que se guarda é o resultado, pelo botão de exportar.
 * ========================================================================== */

let _mtzMatriz = null;        // matriz de trabalho (viva só nesta sessão)
let _mtzResultado = null;     // último resultado de otimização
let _mtzRodando = false;
let _mtzCancelar = false;

function mtzParams() {
  if (!State.matrizParams) {
    State.matrizParams = {
      quantidade: 50000,
      semente: 2026,
      metaModo: 'quantidade',
      metaQuantidade: 20000,
      metaPercentual: 50,
      metaCobertura: 95,
      reinicios: 1,
      tempoBuscaS: 3,
    };
  }
  return State.matrizParams;
}
function mtzSalvarParams() { saveJSON(STORAGE_KEYS.matrizParams, State.matrizParams || {}); }

const mtzInt = (n) => Math.round(Number(n) || 0).toLocaleString('pt-BR');
const mtzPct = (f, casas) => `${(Number(f) * 100).toFixed(casas === undefined ? 3 : casas)}%`;
const mtzPP = (f) => `${(Number(f) * 100).toFixed(3)} ponto(s) percentual(is)`;

function mtzStatus(txt) {
  const el = $('#mtz-status');
  if (el) el.textContent = txt || '';
}

/* -------------------------------------------------------------------------- */
/* §1 — Estado da matriz                                                       */
/* -------------------------------------------------------------------------- */

function mtzRenderMatriz() {
  const host = $('#mtz-estado');
  if (!host) return;
  if (!_mtzMatriz) {
    host.innerHTML = '<span class="text-sm text-soft">Nenhuma matriz carregada. Gere ou importe cartelas abaixo.</span>';
    return;
  }
  const M = _mtzMatriz;
  host.innerHTML = `
    <div class="mtz-grid">
      <div class="stat"><span class="text-xs text-mute">Cartelas ativas</span><span class="mtz-num">${mtzInt(M.ativas)}</span><span class="text-xs text-soft">de ${mtzInt(M.n)} carregadas</span></div>
      <div class="stat"><span class="text-xs text-mute">Combinações cobertas</span><span class="mtz-num">${mtzInt(M.cobertas)}</span><span class="text-xs text-soft">de ${mtzInt(MTZ_TOTAL_COMB)}</span></div>
      <div class="stat"><span class="text-xs text-mute">Não cobertas</span><span class="mtz-num">${mtzInt(MTZ_TOTAL_COMB - M.cobertas)}</span></div>
      <div class="stat"><span class="text-xs text-mute">Cobertura</span><span class="mtz-num">${mtzPct(M.cobertas / MTZ_TOTAL_COMB)}</span></div>
    </div>`;
}

async function mtzGerar() {
  if (_mtzRodando) return;
  const p = mtzParams();
  const n = Math.max(1, Math.min(120000, Number(p.quantidade) || 1));
  _mtzRodando = true;
  mtzStatus(`Gerando ${mtzInt(n)} cartelas…`);
  try {
    const masks = mtzGerarCartelas(n, Number(p.semente) || 1);
    mtzStatus('Montando índice de cobertura…');
    _mtzMatriz = await mtzMontarMatriz(masks, {
      onProgress: (ev) => { if (ev.fase === 'indice') mtzStatus(`Indexando ${mtzInt(ev.feito)} / ${mtzInt(ev.total)}…`); },
    });
    _mtzResultado = null;
    mtzRenderMatriz();
    mtzRenderResultado();
    mtzStatus('');
    toast(`Matriz pronta: ${mtzInt(_mtzMatriz.n)} cartelas, ${mtzPct(_mtzMatriz.cobertas / MTZ_TOTAL_COMB)} de cobertura.`, 'success');
  } catch (err) {
    mtzStatus('');
    toast('Não deu para gerar a matriz: ' + (err?.message || err), 'error');
  }
  _mtzRodando = false;
}

async function mtzImportar(texto) {
  if (_mtzRodando) return;
  const { masks, erros } = mtzImportarTexto(texto);
  if (!masks.length) {
    toast('Nenhuma cartela válida no texto.' + (erros.length ? ` Primeiro problema: ${erros[0]}` : ''), 'error');
    return;
  }
  _mtzRodando = true;
  mtzStatus('Montando índice de cobertura…');
  try {
    _mtzMatriz = await mtzMontarMatriz(masks, {
      onProgress: (ev) => { if (ev.fase === 'indice') mtzStatus(`Indexando ${mtzInt(ev.feito)} / ${mtzInt(ev.total)}…`); },
    });
    _mtzResultado = null;
    mtzRenderMatriz();
    mtzRenderResultado();
    mtzStatus('');
    const aviso = erros.length ? ` ${erros.length} linha(s) recusada(s).` : '';
    toast(`${mtzInt(masks.length)} cartelas importadas.${aviso}`, erros.length ? 'warn' : 'success');
    if (erros.length) {
      const cx = $('#mtz-import-erros');
      if (cx) {
        cx.classList.remove('hidden');
        cx.innerHTML = `<div class="text-xs text-mute">Linhas recusadas (primeiras 10):<br>${erros.slice(0, 10).map(escapeHtml).join('<br>')}</div>`;
      }
    }
  } catch (err) {
    mtzStatus('');
    toast('Não deu para importar: ' + (err?.message || err), 'error');
  }
  _mtzRodando = false;
}

/* -------------------------------------------------------------------------- */
/* §2 — Otimizar                                                               */
/* -------------------------------------------------------------------------- */

function mtzMetaAtual() {
  const p = mtzParams();
  if (p.metaModo === 'percentual') return { modo: 'percentual', valor: p.metaPercentual };
  if (p.metaModo === 'coberturaMinima') return { modo: 'coberturaMinima', valor: p.metaCobertura };
  if (p.metaModo === 'cobertura100') return { modo: 'cobertura100' };
  return { modo: 'quantidade', valor: p.metaQuantidade };
}

async function mtzOtimizarAgora() {
  if (_mtzRodando) return;
  if (!_mtzMatriz) { toast('Carregue uma matriz primeiro.', 'warn'); return; }
  const p = mtzParams();
  _mtzRodando = true;
  _mtzCancelar = false;
  $('#mtz-otimizar').disabled = true;
  $('#mtz-parar').classList.remove('hidden');

  try {
    _mtzResultado = await mtzOtimizar(_mtzMatriz, {
      meta: mtzMetaAtual(),
      reinicios: Math.max(1, Math.min(8, Number(p.reinicios) || 1)),
      tempoBuscaMs: Math.max(0, (Number(p.tempoBuscaS) || 0) * 1000),
      seed: Number(p.semente) || 1,
      shouldStop: () => _mtzCancelar,
      onProgress: (ev) => {
        if (ev.fase === 'descida') {
          mtzStatus(`Podando… eliminadas ${mtzInt(ev.removidas)} · restam ${mtzInt(ev.restantes)} · cobertura ${mtzPct(ev.cobertas / MTZ_TOTAL_COMB, 2)}`);
        } else if (ev.fase === 'busca-local') {
          mtzStatus(`Busca local… ${mtzInt(ev.trocas)} troca(s) · cobertura ${mtzPct(ev.cobertas / MTZ_TOTAL_COMB, 3)}`);
        } else if (ev.fase === 'reinicio') {
          mtzStatus(`Tentativa ${ev.tentativa}/${ev.de} · melhor: ${mtzInt(ev.cartelasNaMeta)} cartelas, ${mtzPct(ev.cobertasNaMeta / MTZ_TOTAL_COMB, 3)}`);
        }
      },
    });
    mtzRenderMatriz();
    mtzRenderResultado();
    mtzStatus(_mtzCancelar ? 'Interrompido — o estado mostrado é o do último ponto concluído.' : '');
  } catch (err) {
    toast('A otimização parou por um erro: ' + (err?.message || err), 'error');
    mtzStatus('');
  }

  $('#mtz-otimizar').disabled = false;
  $('#mtz-parar').classList.add('hidden');
  _mtzRodando = false;
}

/* -------------------------------------------------------------------------- */
/* §3 — Resultado                                                              */
/* -------------------------------------------------------------------------- */

function mtzRenderResultado() {
  const host = $('#mtz-resultado');
  if (!host) return;
  const r = _mtzResultado;
  if (!r) {
    host.innerHTML = '<span class="text-sm text-soft">Nenhuma otimização ainda.</span>';
    return;
  }
  const T = MTZ_TOTAL_COMB;
  const reducao = r.cartelasIniciais ? 1 - (r.cartelasFinais / r.cartelasIniciais) : 0;
  const perda = (r.coberturaInicial - r.coberturaFinal) / T;
  const vantagem = r.referenciaAleatoria ? (r.coberturaFinal - r.referenciaAleatoria) / r.referenciaAleatoria : 0;
  const ganhouDoAcaso = r.coberturaFinal > r.referenciaAleatoria;

  host.innerHTML = `
    ${r.metaViavel ? '' : `
    <div class="card callout-warn mb-2">
      <div class="font-semibold">A meta pedida não era alcançável</div>
      <div class="text-sm text-soft">${escapeHtml(r.metaObservacao)}</div>
    </div>`}
    <div class="mtz-grid">
      <div class="stat"><span class="text-xs text-mute">Cartelas</span><span class="mtz-num">${mtzInt(r.cartelasIniciais)} → ${mtzInt(r.cartelasFinais)}</span><span class="text-xs text-soft">redução de ${mtzPct(reducao, 1)}</span></div>
      <div class="stat"><span class="text-xs text-mute">Cobertura</span><span class="mtz-num">${mtzPct(r.coberturaInicial / T)} → ${mtzPct(r.coberturaFinal / T)}</span><span class="text-xs text-soft">perda de ${mtzPP(perda)}</span></div>
      <div class="stat"><span class="text-xs text-mute">Combinações cobertas</span><span class="mtz-num">${mtzInt(r.coberturaFinal)}</span><span class="text-xs text-soft">não cobertas: ${mtzInt(T - r.coberturaFinal)}</span></div>
      <div class="stat"><span class="text-xs text-mute">Ganho da busca local</span><span class="mtz-num">+${mtzInt(r.coberturaFinal - r.coberturaAntesBusca)}</span><span class="text-xs text-soft">${mtzInt(r.busca.trocas)} troca(s) aplicada(s)</span></div>
    </div>

    <div class="mtz-regua ${ganhouDoAcaso ? 'mtz-regua-ok' : 'mtz-regua-ruim'}">
      <div class="mtz-regua-titulo">A régua — contra o acaso, com o mesmo número de cartelas</div>
      <div class="mtz-regua-linhas">
        <div><span>Seleção otimizada</span><strong>${mtzPct(r.coberturaFinal / T)}</strong><span class="text-xs text-mute">${mtzInt(r.coberturaFinal)} combinações</span></div>
        <div><span>${mtzInt(r.cartelasFinais)} cartelas ao acaso</span><strong>${mtzPct(r.referenciaAleatoria / T)}</strong><span class="text-xs text-mute">${mtzInt(r.referenciaAleatoria)} combinações</span></div>
        <div><span>Vantagem</span><strong>${ganhouDoAcaso ? '+' : ''}${mtzInt(r.coberturaFinal - r.referenciaAleatoria)}</strong><span class="text-xs text-mute">${ganhouDoAcaso ? '+' : ''}${(vantagem * 100).toFixed(2)}% sobre o acaso</span></div>
      </div>
    </div>

    <div class="text-xs text-mute mt-2">
      Modo 100% disponível nesta matriz: dá para remover <strong>${mtzInt(r.remocoesSemPerda)}</strong> cartela(s) sem perder
      nenhuma combinação ${r.remocoesSemPerda === 0 ? '— ou seja, nenhuma cartela é dispensável aqui. Isso é normal em matriz esparsa: com poucas cartelas diante das 1.081.575 possíveis, quase nunca uma cartela tem todas as suas 136 combinações cobertas por outras.' : `(sobrariam ${mtzInt(r.cartelasIniciais - r.remocoesSemPerda)}).`}
    </div>

    <div class="flex gap-1 flex-wrap mt-2">
      <button class="btn btn-accent btn-sm" id="mtz-exportar" type="button">Exportar matriz</button>
      <button class="btn btn-ghost btn-sm" id="mtz-validar" type="button">Validar as 3.268.760 combinações</button>
      <button class="btn btn-ghost btn-sm" id="mtz-ranking" type="button">Ver ranking de cartelas</button>
    </div>
    <div id="mtz-validacao" class="mt-2"></div>
    <div id="mtz-ranking-box" class="mt-2"></div>

    <details class="afer-detalhes mt-2">
      <summary>Curva de equilíbrio — cobertura a cada patamar de redução</summary>
      <div class="afer-detalhes-body">
        <p class="text-xs text-mute">Toda a curva sai de uma única descida: as remoções são aninhadas, então o conjunto de 20.000 é o de 25.000 menos 5.000 remoções. Use isto para achar onde a perda ainda compensa.</p>
        <div class="mtz-curva">
          ${mtzAmostrarCurva(r.curva, r.cartelasIniciais, 12).map((p) => `
            <div class="mtz-curva-linha">
              <span>${mtzInt(p.cartelas)} cartelas</span>
              <span class="mtz-curva-barra"><i style="width:${(p.cobertura * 100).toFixed(2)}%"></i></span>
              <strong>${mtzPct(p.cobertura, 2)}</strong>
            </div>`).join('')}
        </div>
      </div>
    </details>`;

  $('#mtz-exportar').onclick = () => mtzExportar();
  $('#mtz-validar').onclick = () => mtzValidar();
  $('#mtz-ranking').onclick = () => mtzMostrarRanking();
}

async function mtzValidar() {
  if (!_mtzMatriz) return;
  const box = $('#mtz-validacao');
  box.innerHTML = '<span class="text-sm text-soft">Percorrendo as 3.268.760 combinações…</span>';
  const v = await mtzValidarExaustivo(_mtzMatriz, {});
  box.innerHTML = `
    <div class="card ${v.confere ? '' : 'callout-warn'}">
      <div class="text-sm">
        <strong>${mtzInt(v.total)}</strong> combinações verificadas ·
        <strong>${mtzInt(v.cobertas)}</strong> cobertas ·
        <strong>${mtzInt(v.descobertas)}</strong> descobertas ·
        <strong>${mtzPct(v.cobertura)}</strong> com ${mtzInt(v.cartelas)} cartelas.
      </div>
      <div class="text-xs text-mute mt-1">
        ${v.confere
          ? 'Recontagem independente (refeita a partir das cartelas, sem usar o índice em cache) bate com o contador incremental.'
          : `DIVERGÊNCIA: a recontagem deu ${mtzInt(v.cobertas)} e o contador incremental dizia ${mtzInt(v.incremental)}. Não confie neste resultado.`}
      </div>
    </div>`;
}

function mtzMostrarRanking() {
  if (!_mtzMatriz) return;
  const M = _mtzMatriz;
  const linhas = [];
  for (let c = 0; c < M.n; c++) {
    if (!M.ativo[c]) continue;
    linhas.push({ c, st: mtzEstatisticasCartela(M, c) });
  }
  linhas.sort((a, b) => b.st.exclusivas - a.st.exclusivas);
  const topo = linhas.slice(0, 10);
  const base = linhas.slice(-10).reverse();
  const linha = (x) => {
    const buf = new Int32Array(MTZ_CARTELA);
    mtzMascaraParaArray(M.masks[x.c], buf);
    const dezenas = Array.from(buf).map((d) => String(d + 1).padStart(2, '0')).join(' ');
    return `<div class="mtz-rank-linha">
      <span class="mono text-xs">${escapeHtml(dezenas)}</span>
      <span class="text-xs">perde <strong>${x.st.exclusivas}</strong> · raras ${x.st.raras} · redundantes ${x.st.redundantes}</span>
    </div>`;
  };
  $('#mtz-ranking-box').innerHTML = `
    <div class="card">
      <div class="text-sm font-semibold">Mais importantes (maior perda se saírem)</div>
      ${topo.map(linha).join('')}
      <div class="text-sm font-semibold mt-2">Mais dispensáveis (menor perda se saírem)</div>
      ${base.map(linha).join('')}
      <div class="text-xs text-mute mt-1">"Perde" = combinações que ficariam descobertas se aquela cartela fosse removida agora. É a mesma conta que guia a poda.</div>
    </div>`;
}

async function mtzExportar() {
  if (!_mtzMatriz) return;
  const linhas = mtzExportarAtivas(_mtzMatriz);
  const cab = [
    `# matriz otimizada — ${linhas.length} cartelas de ${MTZ_CARTELA} dezenas`,
    `# cobertura: ${_mtzMatriz.cobertas} de ${MTZ_TOTAL_COMB} combinações (${mtzPct(_mtzMatriz.cobertas / MTZ_TOTAL_COMB)})`,
    `# gerado em ${new Date().toISOString()}`,
  ].join('\n');
  const texto = cab + '\n' + linhas.map((l) => l.map((d) => String(d).padStart(2, '0')).join(' ')).join('\n') + '\n';
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
  const nome = `matriz-${linhas.length}-cartelas.txt`;
  try {
    await saveImagesToDevice([{ name: nome, blob }], 'Matriz otimizada');
    toast('Matriz exportada.', 'success');
  } catch (err) {
    toast('Não deu para exportar: ' + (err?.message || err), 'error');
  }
}

/* -------------------------------------------------------------------------- */
/* §4 — Formulário                                                             */
/* -------------------------------------------------------------------------- */

function mtzRenderForm() {
  const host = $('#mtz-form');
  if (!host) return;
  const p = mtzParams();
  host.innerHTML = `
    <div class="mtz-form-grid">
      <div class="field">
        <label class="label" for="mtz-qtd">Gerar quantas cartelas</label>
        <input class="input" type="number" id="mtz-qtd" min="1" max="120000" value="${p.quantidade}">
        <span class="input-helper">Até 120.000 (o índice usa ~0,54 KB por cartela). Existem ${mtzInt(MTZ_CARTELAS_POSSIVEIS)} cartelas de 17 dezenas no total.</span>
      </div>
      <div class="field">
        <label class="label" for="mtz-semente">Semente</label>
        <input class="input" type="number" id="mtz-semente" min="1" value="${p.semente}">
        <span class="input-helper">Mesma semente, mesma matriz — para repetir um resultado.</span>
      </div>
    </div>
    <div class="flex gap-1 flex-wrap">
      <button class="btn btn-accent btn-sm" id="mtz-gerar" type="button">Gerar matriz</button>
      <button class="btn btn-ghost btn-sm" id="mtz-abrir-import" type="button">Importar cartelas</button>
    </div>
    <div id="mtz-import-box" class="hidden mt-2">
      <div class="field">
        <label class="label" for="mtz-import-texto">Uma cartela por linha, 17 dezenas de 1 a 25</label>
        <textarea class="textarea" id="mtz-import-texto" rows="5" placeholder="01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17"></textarea>
      </div>
      <div class="flex gap-1">
        <input type="file" id="mtz-import-file" accept=".txt,.csv,text/plain" hidden>
        <button class="btn btn-ghost btn-sm" id="mtz-import-arquivo" type="button">Carregar de arquivo</button>
        <button class="btn btn-accent btn-sm" id="mtz-import-ok" type="button">Importar</button>
      </div>
      <div id="mtz-import-erros" class="hidden mt-1"></div>
    </div>

    <div class="mtz-form-grid mt-2">
      <div class="field">
        <label class="label" for="mtz-meta-modo">Objetivo</label>
        <select class="select" id="mtz-meta-modo">
          <option value="quantidade">Quantidade final de cartelas</option>
          <option value="percentual">Percentual de redução</option>
          <option value="coberturaMinima">Cobertura mínima a manter</option>
          <option value="cobertura100">100% — não perder nenhuma combinação</option>
        </select>
      </div>
      <div class="field" id="mtz-campo-quantidade">
        <label class="label" for="mtz-meta-quantidade">Ficar com quantas cartelas</label>
        <input class="input" type="number" id="mtz-meta-quantidade" min="0" value="${p.metaQuantidade}">
      </div>
      <div class="field hidden" id="mtz-campo-percentual">
        <label class="label" for="mtz-meta-percentual">Eliminar quantos %</label>
        <input class="input" type="number" id="mtz-meta-percentual" min="0" max="100" value="${p.metaPercentual}">
      </div>
      <div class="field hidden" id="mtz-campo-cobertura">
        <label class="label" for="mtz-meta-cobertura">Manter pelo menos quantos % de cobertura</label>
        <input class="input" type="number" id="mtz-meta-cobertura" min="0" max="100" step="0.1" value="${p.metaCobertura}">
      </div>
      <div class="field">
        <label class="label" for="mtz-reinicios">Tentativas</label>
        <input class="input" type="number" id="mtz-reinicios" min="1" max="8" value="${p.reinicios}">
        <span class="input-helper">Cada tentativa desempata diferente; fica a melhor.</span>
      </div>
      <div class="field">
        <label class="label" for="mtz-tempo">Segundos de busca local</label>
        <input class="input" type="number" id="mtz-tempo" min="0" max="60" value="${p.tempoBuscaS}">
        <span class="input-helper">Troca cartelas 1 por 1 para melhorar a cobertura sem mudar a quantidade. 0 desliga.</span>
      </div>
    </div>`;

  $('#mtz-meta-modo').value = p.metaModo;
  mtzAtualizarCamposMeta();

  $('#mtz-gerar').onclick = () => mtzGerar();
  $('#mtz-abrir-import').onclick = () => $('#mtz-import-box').classList.toggle('hidden');
  $('#mtz-import-ok').onclick = () => mtzImportar($('#mtz-import-texto').value);
  $('#mtz-import-arquivo').onclick = () => $('#mtz-import-file').click();
  $('#mtz-import-file').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    $('#mtz-import-texto').value = await f.text();
    e.target.value = '';
  };
  $('#mtz-meta-modo').onchange = () => { mtzOnForm(); mtzAtualizarCamposMeta(); };
  ['mtz-qtd', 'mtz-semente', 'mtz-meta-quantidade', 'mtz-meta-percentual', 'mtz-meta-cobertura', 'mtz-reinicios', 'mtz-tempo']
    .forEach((id) => { const el = $(`#${id}`); if (el) el.oninput = mtzOnForm; });
}

function mtzAtualizarCamposMeta() {
  const modo = $('#mtz-meta-modo').value;
  $('#mtz-campo-quantidade').classList.toggle('hidden', modo !== 'quantidade');
  $('#mtz-campo-percentual').classList.toggle('hidden', modo !== 'percentual');
  $('#mtz-campo-cobertura').classList.toggle('hidden', modo !== 'coberturaMinima');
}

function mtzOnForm() {
  const p = mtzParams();
  p.quantidade = Math.max(1, Math.min(120000, Number($('#mtz-qtd').value) || 1));
  p.semente = Math.max(1, Number($('#mtz-semente').value) || 1);
  p.metaModo = $('#mtz-meta-modo').value;
  p.metaQuantidade = Math.max(0, Number($('#mtz-meta-quantidade').value) || 0);
  p.metaPercentual = Math.max(0, Math.min(100, Number($('#mtz-meta-percentual').value) || 0));
  p.metaCobertura = Math.max(0, Math.min(100, Number($('#mtz-meta-cobertura').value) || 0));
  p.reinicios = Math.max(1, Math.min(8, Number($('#mtz-reinicios').value) || 1));
  p.tempoBuscaS = Math.max(0, Math.min(60, Number($('#mtz-tempo').value) || 0));
  mtzSalvarParams();
}

/* -------------------------------------------------------------------------- */
/* §5 — Entrada                                                                */
/* -------------------------------------------------------------------------- */

function renderMatriz() {
  mtzRenderForm();
  mtzRenderMatriz();
  mtzRenderResultado();
  $('#mtz-otimizar').onclick = () => mtzOtimizarAgora();
  $('#mtz-parar').onclick = () => { _mtzCancelar = true; mtzStatus('Interrompendo…'); };
}
