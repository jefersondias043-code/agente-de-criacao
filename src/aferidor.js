'use strict';
/* ============================================================================
 * AFERIDOR — a tela
 *
 * A CONTA CONTINUA INTEIRA. O QUE MUDOU É QUEM PRECISA OLHAR PARA ELA.
 *
 * A versão anterior abria com "+106 ganhos − 29 perdidos = +77 de 135 em jogo ·
 * 27 quesitos verificados" e listava, um a um, os quesitos perdidos pelo texto
 * da PERGUNTA do questionário, com peso, placar de votos e polaridade ao lado.
 * Tudo verdadeiro, tudo auditável — e ilegível para quem acabou de gravar um
 * vídeo e só quer saber se dá para publicar. A tela falava a língua de quem
 * escreveu o motor, não a de quem usa a ferramenta.
 *
 * A tese da ferramenta não mudou: a nota é uma conta que dá para conferir, e
 * quem discordar tem de conseguir achar a linha. Mas AUDITÁVEL não quer dizer
 * AUDITADO O TEMPO TODO. A conta agora espera atrás de um clique, inteira, do
 * mesmo jeito que estava; o que abre a tela é a resposta à pergunta que o autor
 * de fato tem:
 *
 *   1. DÁ PARA PUBLICAR? — um veredito em português, e a nota ao lado, pequena;
 *   2. O QUE EU FAÇO? — as correções em ordem de impacto, escritas como ação
 *      ("corte a saudação do começo"), não como pergunta respondida. A ordem
 *      sai do peso, então a prioridade continua vindo da mesma conta — o que
 *      sumiu foi o número, não o critério;
 *   3. O QUE JÁ ESTÁ BOM — porque uma ferramenta que só devolve defeito ensina
 *      o autor a não abri-la;
 *   4. COMO A NOTA FOI CALCULADA — recolhido: a conta, os blocos, onde as
 *      leituras discordaram e o questionário inteiro, pergunta por pergunta.
 *
 * As frases de 2 e 3 moram em `aferidor-textos.js`. Nenhum número passa por lá.
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

/** Número com sinal explícito — "+64", "−18", e "0" sem sinal nenhum. */
function aferSinal(n) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;   // menos tipográfico, não hífen
  return '0';
}

/* O VEREDITO — e a nota ao lado, do tamanho que ela merece.
 *
 * O número continua ali, e continua sendo o mesmo número: some-lo seria trocar
 * um excesso por uma falta, e o histórico compara aferições por ele. O que
 * mudou é a hierarquia — quem lê primeiro lê uma frase, não uma equação. A
 * conta que sustenta o número está a um clique, em "como a nota foi calculada",
 * e o `title` do número aponta para lá. */
function aferBlocoVeredito(res) {
  const f = res.faixa || {};
  const v = aferVeredito(res);
  return `
    <div class="afer-cabeca ${AFER_CLASSE_FAIXA[f.id] || ''}">
      <div class="afer-cabeca-lado">
        <div class="afer-veredito">${escapeHtml(v.titulo)}</div>
        <div class="afer-veredito-frase">${escapeHtml(v.frase)}</div>
      </div>
      <div class="afer-nota" title="A nota vai de −100 a +100 e sai de uma conta do código, não de um juízo da IA. Abra “como a nota foi calculada” para conferir.">
        <span class="afer-nota-rotulo">nota</span>
        <span class="afer-nota-valor">${aferSinal(res.nota)}</span>
        <span class="afer-nota-de">/100</span>
      </div>
    </div>`;
}

/* O QUE MELHORAR — a mesma lista de antes, dita em português.
 *
 * A ORDEM É A DO PESO, como sempre foi: o que mais mexe na nota aparece
 * primeiro, e é por isso que a lista responde a "o que eu conserto primeiro"
 * sem inventar prioridade nenhuma. O que saiu da linha foi o `−10`, não o
 * critério — o número dizia ao leitor quanto aquilo valia num total que ele não
 * tinha visto, e a posição na lista já diz a mesma coisa sem exigir a conta.
 *
 * A DIVERGÊNCIA VIROU UMA FRASE NO ITEM. Ela era uma seção à parte, com o
 * placar "3×SIM · 2×NÃO", o que obrigava o leitor a cruzar duas listas para
 * descobrir que uma das correções pedidas era das duvidosas. Colada no item, a
 * informação chega quando é útil: na hora de decidir se mexe naquilo. O placar
 * continua exato lá dentro, na auditoria. */
function aferBlocoMelhorar(res) {
  const perdidos = res.perdidos || [];
  if (!perdidos.length) {
    return `
      <div class="afer-secao">
        <div class="afer-secao-titulo">O que melhorar</div>
        <div class="afer-nada">Nada ficou pelo caminho — o conteúdo passou em tudo que foi verificado.</div>
      </div>`;
  }
  const linhas = perdidos.map((q, i) => `
    <div class="afer-acao${i === 0 ? ' afer-acao-primeira' : ''}">
      <span class="afer-acao-num">${i + 1}</span>
      <div class="afer-acao-corpo">
        <div class="afer-acao-texto">${escapeHtml(aferConserto(q))}</div>
        ${q.consenso < 1 ? '<div class="afer-acao-duvida">As leituras ficaram divididas neste ponto — vale conferir com os seus olhos.</div>' : ''}
      </div>
    </div>`).join('');
  return `
    <div class="afer-secao">
      <div class="afer-secao-titulo">O que melhorar</div>
      <div class="afer-secao-desc">Na ordem que mais muda o resultado.</div>
      ${linhas}
    </div>`;
}

/* O QUE JÁ ESTÁ BOM.
 *
 * Isto não existia, e a falta tinha um custo: a tela inteira era uma lista de
 * defeitos, e uma ferramenta que só aponta defeito ensina o autor a não abri-la
 * — ainda mais quando ele acertou dezoito dos vinte e um pontos e a tela só
 * falou dos três.
 *
 * Mostra os mais pesados, não todos: a lista completa está na auditoria, e
 * repetir dezoito elogios empurraria "o que melhorar" para fora da tela, que é
 * exatamente o problema que este trabalho veio resolver. */
const AFER_FORTES_NA_TELA = 4;

function aferBlocoForte(res) {
  const ganhos = (res.avaliadas || []).filter((q) => q.acertou)
    .slice().sort((a, b) => b.peso - a.peso || a.id.localeCompare(b.id));
  if (!ganhos.length) return '';
  const mostrados = ganhos.slice(0, AFER_FORTES_NA_TELA);
  const resto = ganhos.length - mostrados.length;
  const linhas = mostrados.map((q) => `
    <div class="afer-forte">
      <svg class="afer-forte-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      <span>${escapeHtml(aferForte(q))}</span>
    </div>`).join('');
  return `
    <div class="afer-secao">
      <div class="afer-secao-titulo">O que já está bom</div>
      ${linhas}
      ${resto > 0 ? `<div class="afer-secao-desc">E mais ${resto} ${resto > 1 ? 'pontos que passaram' : 'ponto que passou'} — a lista inteira está logo abaixo.</div>` : ''}
    </div>`;
}

/* A CONTA — agora aqui dentro, e inteira. É a linha que torna o número do topo
 * conferível: as duas parcelas, o saldo entre elas e o total em jogo. */
function aferBlocoConta(res) {
  return `
    <div class="afer-secao">
      <div class="afer-secao-titulo">A conta</div>
      <div class="afer-conta">+${res.pesoGanho} ganhos − ${res.pesoPerdido} perdidos = ${aferSinal(res.saldo)} de ${res.pesoTotal} em jogo · ${res.avaliadas.length} quesitos verificados</div>
      <div class="afer-secao-desc">Cada quesito soma o próprio peso quando passa e subtrai o mesmo peso quando não passa. A nota é esse saldo, de −100 a +100.</div>
    </div>`;
}

/* ONDE AS RODADAS DISCORDARAM. Não muda a resposta — muda o quanto se pode
 * confiar nela. Na tela principal isso virou uma frase colada na correção
 * correspondente; aqui fica o placar exato, para quem quiser o número. */
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
      <div class="afer-secao-desc">A resposta predominante valeu, mas nestes quesitos ela ficou no fio.</div>
      ${linhas}
    </div>`;
}

function aferBlocoBlocos(res) {
  const blocos = (res.porBloco || []).filter((b) => b.nota != null);
  if (!blocos.length) return '';
  const barras = blocos.map((b) => {
    const faixa = b.nota >= 60 ? 'ok' : (b.nota >= 0 ? 'medio' : 'baixo');
    /* A barra mede a DISTÂNCIA do pior caso possível: −100 vira 0% e +100 vira
     * 100%. Sem isso um bloco negativo pediria largura negativa e sumiria da
     * tela — que é o mesmo desenho de um bloco perfeito. */
    const largura = Math.max(2, Math.round((b.nota + 100) / 2));
    return `
      <div class="afer-bloco">
        <div class="afer-bloco-topo">
          <span class="afer-bloco-label">${escapeHtml(b.label)}</span>
          <span class="afer-bloco-nota">${aferSinal(b.nota)}</span>
        </div>
        <div class="afer-bloco-barra"><span class="afer-bloco-preenche afer-faixa-${faixa}" style="width:${largura}%"></span></div>
        <div class="afer-bloco-desc">${escapeHtml(b.desc)} · +${b.ganho} − ${b.perdido} de ${b.peso} em jogo</div>
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
 * direito de achar a linha e conferir.
 *
 * CADA LINHA DIZ QUAL RESPOSTA PONTUA, e isso não é redundância. Metade das
 * perguntas descreve defeito: nelas o NÃO é a resposta boa. Sem o "pontua com
 * NÃO" escrito, a linha `NÃO · [pergunta] · +7` obriga o leitor a deduzir a
 * polaridade a partir do sinal do ponto — que é exatamente a conta que a
 * ferramenta existe para não fazer ninguém refazer de cabeça. */
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
        <span class="afer-q-meta">${naoVerificada ? 'não verificado' : `pontua com ${q.bom === 'sim' ? 'SIM' : 'NÃO'} · ${q.sim}/${q.votos} sim · peso ${q.peso} · ${q.acertou ? `+${q.peso}` : `−${q.peso}`}`}</span>
      </div>`;
  }).join('');
  return `
    <div class="afer-secao">
      <div class="afer-secao-titulo">O questionário — pergunta por pergunta</div>
      <div class="afer-secao-desc">${item.rodadasValidas} leitura(s) independente(s) do mesmo questionário. A IA respondeu apenas SIM ou NÃO, sem ver peso nenhum; a nota é a soma que aparece na coluna da direita.</div>
      ${linhas}
    </div>`;
}

/* COMO A NOTA FOI CALCULADA — a auditoria inteira, recolhida.
 *
 * Nada foi removido daqui: a conta, os blocos, o placar das divergências e o
 * questionário pergunta por pergunta são os mesmos de antes, no mesmo nível de
 * detalhe. Mudou o lugar. Quem quer saber o que fazer não abre; quem discorda
 * da nota abre e acha a linha, que é a promessa que a ferramenta faz desde o
 * primeiro dia.
 *
 * FECHADO POR PADRÃO, e isso é a mudança inteira em uma linha. */
function aferDetalhes(item) {
  const res = item.resultado || {};
  return `
    <details class="afer-detalhes">
      <summary>Como a nota foi calculada</summary>
      <div class="afer-detalhes-body">
        ${aferBlocoConta(res)}
        ${aferBlocoBlocos(res)}
        ${aferBlocoDivergencias(res)}
        ${aferBlocoQuestionario(item)}
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
      <div class="empty-desc">Cole o roteiro ou a transcrição acima. Você recebe de volta se dá para publicar e o que melhorar primeiro.</div>
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
    ${aferBlocoVeredito(res)}
    ${aferBlocoMelhorar(res)}
    ${aferBlocoForte(res)}
    ${aferDetalhes(item)}
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
    <div class="afer-rodape">O conteúdo foi lido ${item.rodadasValidas} vez${item.rodadasValidas > 1 ? 'es' : ''}, e a IA só respondeu sim ou não, sem ver os pesos. A nota é uma conta do código, não um juízo dela.</div>`;

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

/* O resultado em texto puro — na MESMA ordem da tela.
 *
 * Quem copia isto manda para o editor, cola no grupo da equipe ou guarda para
 * comparar depois. Abrir com "+125 ganhos − 10 perdidos" fazia a mensagem
 * chegar como planilha do outro lado; abrir com o veredito e as ações faz
 * chegar como recado. A conta continua no fim, para quem for conferir. */
function aferResultadoEmTexto(item) {
  const res = item.resultado || {};
  const v = aferVeredito(res);
  const linhas = [];
  linhas.push(`${v.titulo.toUpperCase()} · nota ${aferSinal(res.nota)}/100`);
  linhas.push(v.frase);

  if ((res.perdidos || []).length) {
    linhas.push('');
    linhas.push('O QUE MELHORAR (na ordem que mais muda o resultado)');
    res.perdidos.forEach((q, i) => {
      linhas.push(`${i + 1}. ${aferConserto(q)}${q.consenso < 1 ? '  [as leituras ficaram divididas neste ponto]' : ''}`);
    });
  }

  const ganhos = (res.avaliadas || []).filter((q) => q.acertou)
    .slice().sort((a, b) => b.peso - a.peso || a.id.localeCompare(b.id));
  if (ganhos.length) {
    linhas.push('');
    linhas.push('O QUE JÁ ESTÁ BOM');
    ganhos.slice(0, AFER_FORTES_NA_TELA).forEach((q) => linhas.push(`• ${aferForte(q)}`));
  }

  linhas.push('');
  linhas.push('COMO A NOTA FOI CALCULADA');
  linhas.push(`+${res.pesoGanho} ganhos − ${res.pesoPerdido} perdidos = ${aferSinal(res.saldo)} de ${res.pesoTotal} em jogo`);
  linhas.push(`${res.avaliadas.length} quesitos · ${item.rodadasValidas} leitura(s)`);
  const blocos = (res.porBloco || []).filter((b) => b.nota != null);
  if (blocos.length) {
    blocos.forEach((b) => linhas.push(`${b.label}: ${aferSinal(b.nota)}/100  (+${b.ganho} −${b.perdido})`));
  }
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
        <div class="list-item-meta">${aferSinal(r.nota)}/100 · ${escapeHtml((r.faixa || {}).label || '')} · ${escapeHtml(formatDate(it.createdAt))}</div>
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
      <div class="empty-title afer-loading-title">Lendo o conteúdo…</div>
      <div class="empty-desc afer-loading-desc">Algumas leituras independentes, para uma opinião torta não decidir sozinha.</div>
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
      <span class="pipeline-step" data-step="rodadas">Leitura</span>
      <span class="pipeline-step" data-step="calculo">Resultado</span>`);

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
        toast(`${res.falhas} leitura(s) não responderam — o resultado saiu das ${res.rodadasValidas} que responderam.`, 'info', 6000);
      } else {
        toast(aferVeredito(res.resultado).titulo, 'success');
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
