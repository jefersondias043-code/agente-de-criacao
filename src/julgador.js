'use strict';
/* ============================================================================
 * JULGADOR — a ferramenta (estado, tela e histórico)
 *
 * A banca mora em src/julgador-motor.js. Aqui fica a tela: o conteúdo entra, o
 * veredito sai, e o que o autor precisa saber aparece na ordem em que ele
 * precisa saber.
 *
 * A ORDEM DA TELA É A TESE DA FERRAMENTA. Uma nota de 72/100 sozinha não serve
 * para nada — o que serve é saber por que 72 e o que transforma isso em 90. Por
 * isso a leitura de cima para baixo é:
 *
 *   1. o veredito       — publicaria, publicaria após ajustes, ou não ainda;
 *   2. O PRINCIPAL      — se você só puder mudar uma coisa, mude esta;
 *   3. a lista          — o resto, do mais caro para o mais barato;
 *   4. os quatro eixos  — qualidade e potencial separados, porque são coisas
 *                          diferentes e uma não compensa a outra;
 *   5. a ata            — recolhida, para quem quiser conferir dimensão a
 *                          dimensão de onde veio cada nota.
 *
 * A nota geral fica ao lado do veredito, não no lugar dele. Ela é a PIOR
 * dimensão, não a média — a média de 84 esconderia um 4 em naturalidade.
 * ========================================================================== */

let _julgResultadoVisivel = false;
// A última sugestão de embalagem, para os botões "Usar" saberem o que aplicar.
let _julgSugestao = null;
/* O julgamento que está NA TELA. Existe para o seletor de formato poder
 * recalcular a nota ponderada sem submeter tudo de novo — ver
 * `julgRecalcularPonderado`. É o mesmo objeto que está em `State.julgamentos`,
 * não uma cópia: mexer aqui atualiza o histórico junto, que é o certo, porque
 * o formato passa a ser o daquele julgamento. */
let _julgItemAtual = null;

function julgadorDraft() {
  if (!State.julgadorDraft) {
    State.julgadorDraft = { conteudo: '', visual: '', titulo: '', capa: '', legenda: '', lote: '', formato: 'geral' };
  }
  return State.julgadorDraft;
}
function saveJulgadorDraft() {
  saveJSON(STORAGE_KEYS.julgadorDraft, State.julgadorDraft || {});
}
function saveJulgamentos() {
  saveJSON(STORAGE_KEYS.julgamentos, State.julgamentos || []);
}

/* A chave de API — conferida na hora de trabalhar, não na hora de abrir. A
 * plataforma já tem tela de configuração; aviso permanente na frente de quem só
 * quer trabalhar é ruído. (Lição do r214, no Causos.) */
function julgTemChave() {
  const provider = (State && State.provider) || 'groq';
  return !!(State && State.apiKeys && State.apiKeys[provider]);
}

function julgAvisarSemChave() {
  const aviso = $('#j-api-warning');
  if (!aviso) return;
  const provider = (State && State.provider) || 'groq';
  const nome = provider.charAt(0).toUpperCase() + provider.slice(1);
  aviso.innerHTML = `
    <div class="flex gap-2" style="align-items:flex-start;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="flex:none;margin-top:2px;color:var(--amber);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div style="flex:1;">
        <div class="font-semibold">A banca não pôde trabalhar</div>
        <div class="text-sm text-soft">Falta a chave da ${escapeHtml(nome)} nas Configurações.</div>
      </div>
      <button class="btn btn-ghost btn-sm" data-go="settings">Configurar</button>
    </div>`;
  aviso.classList.remove('hidden');
  try { aviso.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* */ }
}

/* ----- Peças do resultado ----- */

const JULG_CLASSE_VEREDITO = { sim: 'julg-verde', ajustes: 'julg-amarelo', nao: 'julg-vermelho' };
const JULG_ROTULO_GRAVIDADE = {
  critico: 'Crítico', alto: 'Alto impacto', medio: 'Médio impacto', baixo: 'Baixo impacto',
};

function julgBlocoVeredito(juizo) {
  const v = juizo.vereditoInfo || {};
  return `
    <div class="julg-veredito ${JULG_CLASSE_VEREDITO[juizo.veredito] || ''}">
      <div class="julg-veredito-lado">
        <div class="julg-veredito-label">${escapeHtml(v.label || '')}</div>
        <div class="julg-veredito-resumo">${escapeHtml(v.resumo || '')}</div>
      </div>
      <div class="julg-nota" title="A nota é a pior dimensão, não a média — média esconde defeito.">
        <span class="julg-nota-valor">${juizo.nota}</span>
        <span class="julg-nota-de">/100</span>
        <span class="julg-nota-legenda">pior dimensão</span>
      </div>
    </div>`;
}

/* A NOTA PONDERADA — estatística SEGUNDA, sempre menor visualmente que a
 * "pior dimensão" acima, que continua sendo o número que decide o veredito.
 * Isto não é o algoritmo de nenhuma plataforma: é peso EDITORIAL desta
 * ferramenta, e o texto avisa isso toda vez que a nota aparece.
 *
 * A ORDEM É POR PESO, e a primeira versão errava justamente nisso. Ela
 * ordenava por CONTRIBUIÇÃO (peso × quanto falta para 10), e o efeito era o
 * oposto do que o título promete: num vídeo bom, as dimensões nota 10
 * contribuem zero e sumiam da lista — "o que mais pesa na nota" mostrava
 * Compartilhamento (12%), Reação (6%), Curiosidade (5%) e História (3%),
 * enquanto Retenção (30%) e Primeiro impacto (20%) nem apareciam.
 *
 * Ordenar pelo peso faz o bloco dizer o que ele diz que diz, e a lista fica
 * ESTÁVEL entre um julgamento e outro — é a tabela do formato escolhido, não
 * um ranking que se reembaralha. Onde está o problema, quem responde é a cor
 * da gravidade e a nota ao lado; "o que consertar primeiro" já é o trabalho
 * de `julgBlocoAcoes`, que ordena por gravidade × momento. */
const JULG_PESO_VISIVEL = 5;

/* O ESTADO DA DIMENSÃO NESTE BLOCO — vocabulário próprio, e é necessário.
 * `JULG_ROTULO_GRAVIDADE` descreve o TAMANHO DE UM PROBLEMA ("Baixo impacto"),
 * que é o certo em "o que eu mudaria". Aqui as linhas não são problemas: são a
 * tabela de pesos. Reusar aquele rótulo produzia a contradição literal
 * "Baixo impacto · Compartilhamento · peso 12% · 9/10". */
const JULG_ROTULO_ESTADO = {
  critico: 'Crítico', alto: 'Reprovado', medio: 'No limite', baixo: 'OK',
};

function julgBlocoPeso(juizo) {
  const p = juizo.ponderado;
  if (!p || !(p.porDimensao || []).length) return '';
  const formato = (typeof JULG_FORMATOS !== 'undefined') ? julgFormato(p.formato) : null;
  const porPeso = p.porDimensao.slice().sort((a, b) => b.peso - a.peso || b.nota - a.nota);
  const mostradas = porPeso.slice(0, JULG_PESO_VISIVEL);
  const cobertura = Math.round(mostradas.reduce((acc, d) => acc + d.peso, 0));
  const linhas = mostradas.map((d) => `
    <div class="julg-peso julg-grav-${escapeHtml(d.gravidade)}">
      <span class="julg-acao-grav">${escapeHtml(JULG_ROTULO_ESTADO[d.gravidade] || d.gravidade)}</span>
      <span class="julg-peso-dim">${escapeHtml(d.label)}</span>
      <span class="julg-peso-valores">peso ${d.peso}% · ${d.nota}/10</span>
    </div>`).join('');
  return `
    <div class="julg-secao">
      <div class="julg-secao-titulo">O que mais pesa na nota
        <span class="julg-nota-ponderada" title="Peso editorial desta ferramenta — não é o algoritmo real de nenhuma plataforma, que ninguém publica.">${p.nota}/100${formato ? ` · ${escapeHtml(formato.label)}` : ''}</span>
      </div>
      <div class="text-xs text-mute mb-1">As ${mostradas.length} dimensões de maior peso no formato escolhido — ${cobertura}% da nota ponderada. Peso é opinião editorial desta ferramenta, não o algoritmo de nenhuma plataforma.</div>
      ${linhas}
    </div>`;
}

/* O PRINCIPAL. Um conteúdo com catorze problemas não tem catorze problemas:
 * tem um que importa e treze que vêm depois dele. */
function julgBlocoPrincipal(juizo) {
  const p = juizo.principal;
  if (!p) return '';
  const reprovado = p.nota < p.minimo;
  return `
    <div class="julg-principal">
      <div class="julg-principal-titulo">Se você só puder mudar uma coisa</div>
      <div class="julg-principal-dim">${escapeHtml(p.label)} · ${p.nota}/10${reprovado ? '' : ' (já passa — é só o ponto mais baixo)'}</div>
      ${p.problema ? `<div class="julg-principal-problema">${escapeHtml(p.problema)}</div>` : ''}
      ${p.correcao && p.correcao !== p.problema ? `<div class="julg-principal-acao">→ ${escapeHtml(p.correcao)}</div>` : ''}
    </div>`;
}

/* O FATOR POSITIVO — o par simétrico do PRINCIPAL. Um conteúdo com catorze
 * problemas também tem alguma coisa que já funciona; dizer só o que falta
 * conserta o vídeo mas não ensina o que repetir no próximo.
 *
 * MAS "A MAIOR NOTA" NÃO É "ESTÁ FORTE", e a primeira versão confundia as
 * duas. Num conteúdo reprovado de ponta a ponta, a maior nota também está
 * abaixo do mínimo — e a tela dizia "Naturalidade está forte — 3/10" ao lado
 * de um veredito NÃO PUBLICARIA e de um 10/100. Elogiar o que não é bom é
 * exatamente o que a doutrina dos avaliadores proíbe ("nota inflada faz a
 * pessoa publicar um vídeo que ia falhar"), e a tela não pode fazer o que
 * proíbe a banca de fazer.
 *
 * Quando nem a melhor dimensão passa, o bloco continua aparecendo — mas
 * dizendo a verdade: é o que está MENOS fraco, e é por onde começar a
 * reconstrução. Mesma honestidade que `julgBlocoPrincipal` já tem quando não
 * há reprovação nenhuma ("já passa — é só o ponto mais baixo"). */
function julgBlocoFatorPositivo(juizo) {
  const f = juizo.pontoForte;
  if (!f) return '';
  const dim = julgDimensao(f.dimensao);
  const passa = f.nota >= f.minimo;
  return `
    <div class="julg-fator-positivo ${passa ? '' : 'julg-fator-fraco'}">
      <div class="julg-principal-titulo">${passa ? 'Principal fator positivo' : 'O menos fraco'}</div>
      <div class="julg-principal-dim">${escapeHtml(f.label)} ${passa
        ? `está forte — ${f.nota}/10`
        : `— ${f.nota}/10, e ainda assim é a maior nota da mesa`}</div>
      ${dim && dim.pergunta ? `<div class="julg-principal-problema">${escapeHtml(dim.pergunta)}</div>` : ''}
      ${passa ? '' : '<div class="julg-principal-acao">→ Nenhuma dimensão passou do mínimo. Comece por aqui: é a base que já existe.</div>'}
    </div>`;
}

function julgBlocoAcoes(juizo) {
  const acoes = juizo.acoes || [];
  if (!acoes.length) return '';
  const linhas = acoes.map((a) => `
    <div class="julg-acao julg-grav-${escapeHtml(a.gravidade)}">
      <span class="julg-acao-grav">${escapeHtml(JULG_ROTULO_GRAVIDADE[a.gravidade] || a.gravidade)}</span>
      <span class="julg-acao-dim">${escapeHtml(a.label)}</span>
      <span class="julg-acao-nota">${a.nota}/10</span>
      <span class="julg-acao-texto">${escapeHtml(a.acao)}</span>
    </div>`).join('');
  return `
    <div class="julg-secao">
      <div class="julg-secao-titulo">O que eu mudaria, em ordem</div>
      <div class="text-xs text-mute mb-1">Do mais caro para o mais barato. A ordem leva em conta a gravidade E onde o defeito age — quem foi embora nos primeiros segundos nunca chegou no fim.</div>
      ${linhas}
    </div>`;
}

/* O QUE A MEDIÇÃO ENCONTROU — lista própria, e por um motivo.
 *
 * O juiz fica com a pior nota de cada dimensão. Quando o avaliador é MAIS duro
 * que a conferência automática, é a nota dele que vale — e, junto com a nota, ia
 * o texto dele. Resultado: "o vídeo leva 15 segundos até chegar no assunto"
 * desaparecia do relatório, substituído por um comentário genérico de LLM.
 *
 * Era perder justamente o que a ferramenta tem de mais acionável: o apontamento
 * com minuto e segundo. Medição é fato, não opinião, e fato não é escondido por
 * uma nota — ele aparece sempre, ao lado. */
function julgBlocoMedicao(item) {
  const achados = ((item.local || {}).achados) || [];
  if (!achados.length) return '';
  const linhas = achados.map((a) => {
    const dim = julgDimensao(a.dimensao);
    return `<div class="julg-medida">
      <span class="julg-medida-dim">${escapeHtml(dim ? dim.label : a.dimensao)}</span>
      <span class="julg-medida-texto">${escapeHtml(a.texto)}</span>
    </div>`;
  }).join('');
  return `
    <div class="julg-secao">
      <div class="julg-secao-titulo">O que a medição encontrou</div>
      <div class="text-xs text-mute mb-1">Isto não é opinião de ninguém: foi medido no texto. ${(item.local || {}).duracao ? `Duração estimada: ${julgMomento(item.local.duracao)}.` : ''}</div>
      ${linhas}
    </div>`;
}

const JULG_ROTULO_RISCO = { baixo: 'risco baixo', medio: 'risco médio', alto: 'risco alto' };

/* A JORNADA DO ESPECTADOR — opinião do crítico de retenção, trecho por
 * trecho, não uma medição de código (por isso bloco próprio, não reusa
 * .julg-medida). Só aparece quando esse avaliador rodou e devolveu a
 * travessia; nunca influencia nota nenhuma — é leitura, não conta. */
function julgBlocoJornada(item) {
  const retencao = (item.avaliacoes || []).find((a) => a.avaliador === 'retencao');
  const jornada = (retencao || {}).jornada || [];
  if (!jornada.length) return '';
  const linhas = jornada.map((j) => `
    <div class="julg-trecho julg-risco-${escapeHtml(j.riscoAbandono)}">
      <span class="julg-trecho-nome">${escapeHtml(j.trecho)}</span>
      <span class="julg-trecho-risco">${escapeHtml(JULG_ROTULO_RISCO[j.riscoAbandono] || j.riscoAbandono)}</span>
      ${j.observacao ? `<span class="julg-trecho-obs">${escapeHtml(j.observacao)}</span>` : ''}
    </div>`).join('');
  return `
    <details class="causo-mesa">
      <summary>A jornada do espectador, trecho por trecho</summary>
      <div class="causo-mesa-body">
        <div class="text-xs text-mute mb-1">Como o crítico de retenção viu o vídeo passar, segundo a segundo — onde o risco de abandono sobe e onde desce.</div>
        ${linhas}
        ${retencao.recompensaFinalTexto ? `<div class="text-xs text-mute mt-1">Recompensa no final: ${retencao.recompensaFinal ? 'sim' : 'não'} — ${escapeHtml(retencao.recompensaFinalTexto)}</div>` : ''}
      </div>
    </details>`;
}

/* Os quatro eixos. Cada um fica com a PIOR dimensão do grupo, pelo mesmo motivo
 * do veredito: é a pior que decide se a pessoa fica. */
function julgBlocoEixos(juizo) {
  const eixos = (juizo.eixos || []).filter((e) => e.nota != null);
  if (!eixos.length) return '';
  const barras = eixos.map((e) => {
    const faixa = e.nota >= 70 ? 'ok' : (e.nota >= 50 ? 'medio' : 'baixo');
    const pior = julgDimensao(e.pior);
    return `
      <div class="julg-eixo">
        <div class="julg-eixo-topo">
          <span class="julg-eixo-label">${escapeHtml(e.label)}</span>
          <span class="julg-eixo-nota">${e.nota}</span>
        </div>
        <div class="julg-eixo-barra"><span class="julg-eixo-preenche julg-faixa-${faixa}" style="width:${Math.max(2, e.nota)}%"></span></div>
        <div class="julg-eixo-pior">${escapeHtml(e.pergunta)} · puxado por ${escapeHtml(pior ? pior.label : e.pior)}</div>
      </div>`;
  }).join('');
  return `
    <div class="julg-secao">
      <div class="julg-secao-titulo">Os quatro eixos</div>
      <div class="text-xs text-mute mb-1">Qualidade e potencial são coisas diferentes: um vídeo pode ser bem produzido e pouco interessante. Cada eixo vale a sua pior dimensão.</div>
      <div class="julg-eixos">${barras}</div>
    </div>`;
}

/* A ata. Recolhida: quem quer saber o que fazer não quer a planilha, mas quem
 * discorda de uma nota precisa poder ver de onde ela veio. */
function julgBlocoAta(item) {
  const juizo = item.juizo || {};
  const avaliadas = juizo.avaliadas || [];
  if (!avaliadas.length) return '';
  const linhas = avaliadas.map((a) => {
    const reprovada = a.nota < a.minimo;
    return `
      <div class="causo-nota ${reprovada ? 'causo-nota-baixa' : ''}">
        <span class="causo-nota-dim">${escapeHtml(a.label)} — ${escapeHtml((julgDimensao(a.dimensao) || {}).pergunta || '')}</span>
        <span class="causo-nota-valor">${a.nota}/10</span>
        ${a.problema ? `<span class="causo-nota-porque">${escapeHtml(a.problema)} <em>(${escapeHtml(a.fonte)})</em></span>` : ''}
      </div>`;
  }).join('');
  const quem = (item.banca || []).map((id) => (JULG_AVALIADORES[id] || {}).label || id);
  return `
    <details class="causo-mesa">
      <summary>A ata — nota por nota</summary>
      <div class="causo-mesa-body">
        <div class="text-xs text-mute mb-1">Leram: ${escapeHtml(quem.join(' · '))}. De cada dimensão vale a PIOR avaliação, e o que a conferência automática mediu passa por cima da opinião.</div>
        ${linhas}
        <div class="text-xs text-mute mt-1">Média das dimensões: ${juizo.media}/100 — mostrada só para referência. Ela não decide nada.</div>
      </div>
    </details>`;
}

/* A comparação com a versão anterior. É o que transforma a ferramenta de
 * detector de problemas em laboratório de melhoria. */
function julgBlocoComparacao(item) {
  if (!item.comparacao) return '';
  const c = item.comparacao;
  const linha = (x, sinal) => `
    <div class="julg-delta">
      <span class="julg-delta-dim">${escapeHtml(x.label)}</span>
      <span class="julg-delta-valor ${sinal}">${x.delta > 0 ? '+' : ''}${x.delta}</span>
      <span class="julg-delta-de">${x.antes} → ${x.depois}</span>
    </div>`;
  const nada = !c.melhoraram.length && !c.pioraram.length;
  return `
    <div class="julg-secao julg-comparacao">
      <div class="julg-secao-titulo">Comparado com a versão anterior</div>
      <div class="julg-comp-cabeca">
        <span>${c.notaAntes}/100</span>
        <span class="julg-comp-seta">→</span>
        <span class="julg-comp-depois ${c.deltaNota >= 0 ? 'sobe' : 'desce'}">${c.notaDepois}/100</span>
        ${c.mudouVeredito ? `<span class="badge ${c.vereditoDepois === 'sim' ? 'success' : ''}">${escapeHtml((JULG_VEREDITOS[c.vereditoDepois] || {}).label || '')}</span>` : ''}
      </div>
      ${c.melhoraram.map((x) => linha(x, 'sobe')).join('')}
      ${c.pioraram.map((x) => linha(x, 'desce')).join('')}
      ${c.iguais.length ? `<div class="text-xs text-mute">Sem mudança: ${escapeHtml(c.iguais.map((x) => x.label).join(', '))}.</div>` : ''}
      ${nada ? '<div class="text-xs text-mute">Nenhuma dimensão mudou de nota.</div>' : ''}
    </div>`;
}

/* TROCAR O FORMATO NÃO PODE EXIGIR NOVA CHAMADA DE IA.
 *
 * A nota ponderada é função pura de duas coisas que já estão guardadas no
 * julgamento — as avaliações e os achados da conferência — mais a tabela de
 * pesos. Trocar o formato muda só a tabela. Submeter tudo de novo gastaria dez
 * chamadas para recalcular uma média que o código faz de graça.
 *
 * Sem isto, o defeito era pior do que gasto: o seletor dizia "Comédia" e a
 * tela continuava mostrando "97/100 · Geral", sem nenhum aviso de que o número
 * na tela não era o do formato selecionado.
 *
 * Nada mais do juízo muda, e não é coincidência: veredito, pior dimensão,
 * principal e ações não dependem de peso nenhum, por desenho. O recálculo
 * roda o MESMO `julgarConteudo` (em vez de refazer só a conta ponderada à
 * parte) justamente para que isso continue verdadeiro sem ninguém precisar
 * lembrar — se um dia o peso vazar para o veredito, vaza aqui também e o
 * teste pega. */
function julgRecalcularPonderado(formato) {
  const it = _julgItemAtual;
  // Julgamento antigo, gravado antes de as avaliações serem guardadas: sem
  // elas o recálculo produziria um juízo vazio e apagaria o diagnóstico da
  // tela. Melhor deixar como está do que destruir o que já foi medido.
  if (!it || !Array.isArray(it.avaliacoes) || !it.avaliacoes.length) return false;
  it.juizo = julgarConteudo(it.avaliacoes, ((it.local || {}).achados) || [], { formato });
  if ((State.julgamentos || []).some((x) => x.id === it.id)) saveJulgamentos();
  renderJulgResultado(it);
  return true;
}

function julgLimparResultado() {
  _julgResultadoVisivel = false;
  _julgItemAtual = null;
  const area = $('#j-result-area');
  if (!area) return;
  area.innerHTML = `
    <div class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-3 7h6z"/><path d="M19 7l3 7h-6z"/></svg>
      </div>
      <div class="empty-title">Aguardando</div>
      <div class="empty-desc">Cole o roteiro ou anexe o vídeo acima. A banca não tenta adivinhar se vai viralizar — ela diz se dá para publicar, onde está fraco e o que consertar primeiro.</div>
    </div>`;
}

/* JULGAR OUTRO CONTEÚDO — limpa a mesa de trabalho.
 *
 * Duas coisas que este botão precisa fazer e que não são óbvias:
 *
 *  1. ZERAR `julgadorOrigemId`. Sem isso o próximo julgamento sairia comparado
 *     com o vídeo ANTERIOR — dois conteúdos sem relação nenhuma lado a lado, com
 *     um "+5 em impacto" que não quer dizer coisa alguma. É o defeito silencioso
 *     que este botão introduziria se fosse só um `value = ''`.
 *  2. NÃO tocar no histórico. O julgamento anterior continua guardado; o que sai
 *     é a mesa, não o arquivo.
 *
 * O rascunho da Seleção (`lote`) também fica: são duas abas, e limpar uma não é
 * pedido para limpar a outra.
 *
 * Só pergunta quando há texto que ainda NÃO está guardado. Quem acabou de julgar
 * e quer o próximo vídeo não precisa ser interrogado — o conteúdo dele está no
 * histórico e volta com um toque. */
function julgNovoConteudo(semPerguntar) {
  const conteudo = String(($('#j-conteudo') || {}).value || '').trim();
  const guardado = (State.julgamentos || []).some((x) => String(x.conteudo || '').trim() === conteudo);
  if (!semPerguntar && conteudo && !guardado
      && !confirm('Este conteúdo ainda não foi julgado e será apagado. Continuar?')) return false;

  const d = julgadorDraft();
  // Formato e lote sobrevivem: são configuração da sessão de trabalho, não do
  // conteúdo específico que acabou de ser julgado.
  State.julgadorDraft = { conteudo: '', visual: '', titulo: '', capa: '', legenda: '', lote: d.lote || '', formato: d.formato || 'geral' };
  saveJulgadorDraft();
  State.julgadorOrigemId = null;
  julgPreencher();
  /* `julgPreencher` só atribui `.value`, e atribuição não dispara evento. Quem
   * escuta `input` — o × de cada campo (clear-field.js), que some quando o campo
   * fica vazio — não ficaria sabendo, e o × continuaria na tela de um campo já
   * limpo. Avisar aqui é mais barato do que fazer `julgPreencher` disparar a
   * cada render. */
  ['#j-conteudo', '#j-visual', '#j-titulo', '#j-capa', '#j-legenda'].forEach((sel) => {
    const el = $(sel);
    if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  julgLimparResultado();
  // A sugestão era daquele vídeo. Deixá-la na tela ao lado de um campo vazio
  // convidaria a colar num conteúdo que não é o dela.
  julgLimparSugestao();
  ['#j-attach-pending', '#j-lote-attach-pending'].forEach((sel) => {
    const p = $(sel); if (p) p.innerHTML = '';
  });
  const campo = $('#j-conteudo');
  if (campo) { try { campo.focus(); } catch (_) { /* */ } }
  return true;
}

/* ----- Sugerir título e legenda -----------------------------------------
 *
 * A ferramenta já tem a transcrição inteira e a descrição visual. O que falta
 * é usar isso para embalar o vídeo — e embalar é o oposto de resumir.
 *
 * A tela NÃO preenche os campos sozinha. Título e legenda podem já estar
 * escritos, e sobrescrever o que o autor digitou sem perguntar é o tipo de
 * ajuda que a pessoa não pediu. A sugestão aparece num painel, com o que ela
 * retém à vista, e quem aplica é ele.
 *
 * O que o painel mostra e por quê:
 *  - a PERGUNTA QUE SOBRA — é o teste da regra, virado em texto. Se não sobra
 *    pergunta, o título é resumo, e isso o autor enxerga sozinho;
 *  - o SELO da conferência — código, não opinião. Verde quando nenhuma palavra
 *    do desfecho vazou; alerta quando vazou, com as palavras na mão.
 */
function julgLimparSugestao() {
  _julgSugestao = null;
  const host = $('#j-sugestao');
  if (host) host.innerHTML = '';
}

function julgBlocoSugestao(sug) {
  const a = sug.auditoria || {};
  const campo = (rotulo, texto, chave, classe) => {
    if (!texto) return '';
    return `
      <div class="julg-sug-campo">
        <div class="julg-sug-topo">
          <span class="julg-sug-rotulo">${rotulo}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-usar="${chave}">Usar</button>
        </div>
        <div class="julg-sug-texto ${classe || ''}">${escapeHtml(texto)}</div>
      </div>`;
  };

  /* O selo diz uma de TRÊS coisas, e a terceira importa: quando a fala é curta
   * demais para ter terços, não há desfecho a medir. Dizer "passou" aí seria
   * afirmar o que não foi conferido. */
  let selo;
  if (!a.conferido) {
    selo = '<span class="julg-sug-selo">Sem conferência — a fala é curta demais para ter começo, meio e fim</span>';
  } else if (a.ok) {
    selo = '<span class="julg-sug-selo ok">✓ Nenhuma palavra do desfecho vazou</span>';
  } else {
    selo = '<span class="julg-sug-selo alerta">⚠ O fim vazou</span>';
  }

  const aviso = (a.problemas || []).length
    ? `<div class="julg-sug-aviso">${a.problemas.map(escapeHtml).join('<br>')}
         <div style="margin-top:.4rem;">A sugestão está aí porque a decisão é sua — mas do jeito que está, quem ler já sabe como termina.</div>
       </div>`
    : '';

  return `
    <div class="julg-sug">
      ${campo('Título', sug.titulo, 'titulo', 'titulo')}
      ${campo('Legenda', sug.legenda, 'legenda')}
      ${sug.pergunta ? `<div class="julg-sug-pergunta">O que sobra na cabeça de quem leu: “${escapeHtml(sug.pergunta)}”</div>` : ''}
      ${sug.fisgada ? `<div class="text-xs text-mute">A isca: ${escapeHtml(sug.fisgada)}</div>` : ''}
      <div style="margin-top:.6rem;">${selo}</div>
      ${aviso}
      <div class="julg-sug-acoes">
        <button type="button" class="btn btn-primary btn-sm" data-usar="ambos">Usar os dois</button>
        <button type="button" class="btn btn-ghost btn-sm" id="j-sug-outra">Sugerir outra</button>
        <button type="button" class="btn btn-ghost btn-sm" id="j-sug-fechar">Dispensar</button>
      </div>
    </div>`;
}

/** Aplica a sugestão nos campos.
 *
 * QUEM GUARDA É O EVENTO, e isso é de propósito. Cada campo desta tela já
 * escreve no rascunho pelo próprio `oninput` (ver `renderJulgador`); disparar
 * `input` depois de mexer no `.value` faz o caminho normal rodar — o rascunho
 * salva e o × de limpar campo aparece. Escrever no rascunho AQUI também seria
 * um segundo caminho para a mesma coisa: passou por uma mutação sem quebrar
 * teste nenhum, que é como código morto se parece de dentro. */
function julgUsarSugestao(quais) {
  if (!_julgSugestao) return;
  const aplicar = (sel, valor) => {
    if (!valor) return;
    const el = $(sel);
    if (!el) return;
    el.value = valor;
    // Atribuir `.value` não dispara evento — sem isto nada disso acontece.
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  if (quais === 'ambos' || quais === 'titulo') aplicar('#j-titulo', _julgSugestao.titulo);
  if (quais === 'ambos' || quais === 'legenda') aplicar('#j-legenda', _julgSugestao.legenda);
  toast(quais === 'ambos' ? 'Título e legenda preenchidos.' : 'Campo preenchido.', 'success');
}

function renderJulgSugestao(sug) {
  const host = $('#j-sugestao');
  if (!host) return;
  _julgSugestao = sug;
  host.innerHTML = julgBlocoSugestao(sug);
  host.querySelectorAll('[data-usar]').forEach((b) => {
    b.onclick = () => julgUsarSugestao(b.dataset.usar);
  });
  const fechar = $('#j-sug-fechar');
  if (fechar) fechar.onclick = julgLimparSugestao;
  const outra = $('#j-sug-outra');
  if (outra) outra.onclick = () => julgSugerirEmbalagem();
}

/* O pedido em si. Uma chamada; duas só quando a conferência reprova a primeira
 * e o motor manda reescrever com as palavras que vazaram na mão. */
async function julgSugerirEmbalagem() {
  const conteudo = String(($('#j-conteudo') || {}).value || '').trim();
  if (conteudo.length < 40) {
    toast('Cole ou anexe o conteúdo primeiro — a sugestão sai da transcrição, não do nada.', 'info', 5000);
    return;
  }
  if (!julgTemChave()) { julgAvisarSemChave(); return; }

  const btn = $('#j-sugerir');
  const original = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Escrevendo…'; }
  const host = $('#j-sugestao');
  if (host) host.innerHTML = '';

  try {
    const sug = await runEmbalagemPipeline({
      conteudo,
      visual: String(($('#j-visual') || {}).value || '').trim(),
      capa: String(($('#j-capa') || {}).value || '').trim(),
      call: callLLM,
      onEtapa: (_k, titulo) => { if (btn) btn.innerHTML = `<span class="spinner"></span> ${escapeHtml(titulo)}`; },
    });
    renderJulgSugestao(sug);
    if (!sug.auditoria.ok) {
      toast('A sugestão saiu, mas a conferência apontou spoiler — veja o aviso no painel.', 'info', 6000);
    }
  } catch (err) {
    toast(err.message || 'Não foi possível escrever a sugestão.', 'error', 6000);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = original; }
  }
}

function renderJulgResultado(item) {
  const area = $('#j-result-area');
  if (!area) return;
  _julgResultadoVisivel = true;
  _julgItemAtual = item;
  const juizo = item.juizo || {};
  area.innerHTML = `
    ${julgBlocoVeredito(juizo)}
    ${julgBlocoPeso(juizo)}
    ${julgBlocoComparacao(item)}
    ${julgBlocoPrincipal(juizo)}
    ${julgBlocoFatorPositivo(juizo)}
    ${julgBlocoAcoes(juizo)}
    ${julgBlocoMedicao(item)}
    ${julgBlocoJornada(item)}
    ${julgBlocoEixos(juizo)}
    ${julgBlocoAta(item)}
    <div class="flex gap-1 flex-wrap mt-2">
      <!-- Os dois primeiros botões são as duas continuações possíveis, e o
           contraste entre eles é o que evita confundi-las: "mexi NESTE vídeo,
           compare" e "acabei com este, vamos ao próximo". -->
      <button class="btn btn-accent btn-sm" id="j-result-novo" title="Limpa os campos para avaliar outro conteúdo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Julgar outro conteúdo
      </button>
      <button class="btn btn-ghost btn-sm" id="j-result-reavaliar" title="Depois de mexer no conteúdo, submeta de novo e veja o que mudou">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>
        Reavaliar depois de mudar
      </button>
      <button class="btn btn-ghost btn-sm" id="j-result-copy">Copiar o diagnóstico</button>
      <button class="btn btn-ghost btn-sm" id="j-result-del" title="Excluir" aria-label="Excluir">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
    <div class="text-xs text-mute mt-2">Potencial não é garantia. A banca julga o que dá para julgar no conteúdo; o que acontece depois de publicar depende de sinais que só existem depois de publicar.</div>`;

  const novo = $('#j-result-novo');
  if (novo) novo.onclick = () => {
    // O conteúdo desta versão já está no histórico — não há o que confirmar.
    if (julgNovoConteudo(true)) {
      toast('Mesa limpa. Cole ou anexe o próximo conteúdo.', 'success');
      try { $('#j-conteudo').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* */ }
    }
  };
  const rea = $('#j-result-reavaliar');
  if (rea) rea.onclick = () => {
    // A reavaliação parte do conteúdo que ESTÁ na tela: o autor mexe e reenvia.
    State.julgadorOrigemId = item.id;
    const campo = $('#j-conteudo');
    if (campo) { campo.focus(); try { campo.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* */ } }
    toast('Mexa no conteúdo acima e submeta de novo — a banca vai comparar com esta versão.', 'info', 6000);
  };
  const copy = $('#j-result-copy');
  if (copy) copy.onclick = () => copyTextComAviso(julgDiagnosticoEmTexto(item), 'Diagnóstico copiado.');
  const del = $('#j-result-del');
  if (del) del.onclick = () => {
    if (!confirm('Excluir este julgamento?')) return;
    State.julgamentos = (State.julgamentos || []).filter((x) => x.id !== item.id);
    saveJulgamentos();
    julgLimparResultado();
    renderJulgHistorico();
    toast('Removido.', 'success');
  };
}

/** O diagnóstico em texto puro — para colar num bloco de notas ou num roteiro. */
function julgDiagnosticoEmTexto(item) {
  const j = item.juizo || {};
  const linhas = [];
  linhas.push(`${(j.vereditoInfo || {}).label || ''} — ${j.nota}/100 (pior dimensão)`);
  if (j.ponderado && (j.ponderado.porDimensao || []).length) {
    linhas.push(`Nota ponderada (peso editorial, não é o algoritmo de nenhuma plataforma): ${j.ponderado.nota}/100`);
  }
  if (j.principal) {
    const p = j.principal;
    linhas.push('');
    linhas.push('SE VOCÊ SÓ PUDER MUDAR UMA COISA');
    // A nota e o "já passa" vêm junto, como na tela. Sem eles, um principal sem
    // texto de problema virava a linha solta "Retenção potencial: " — um
    // rótulo, dois-pontos e nada, que não diz coisa alguma.
    const estado = p.nota < p.minimo ? '' : ' (já passa — é só o ponto mais baixo)';
    linhas.push(`${p.label} — ${p.nota}/10${estado}`);
    if (p.problema) linhas.push(p.problema);
    if (p.correcao && p.correcao !== p.problema) linhas.push(`→ ${p.correcao}`);
  }
  if (j.pontoForte) {
    const f = j.pontoForte;
    const passa = f.nota >= f.minimo;
    linhas.push('');
    linhas.push(passa ? 'PRINCIPAL FATOR POSITIVO' : 'O MENOS FRACO');
    linhas.push(`${f.label} — ${f.nota}/10${passa ? '' : ', e ainda assim é a maior nota da mesa'}`);
  }
  const medidas = ((item.local || {}).achados) || [];
  if (medidas.length) {
    linhas.push('');
    linhas.push('O QUE A MEDIÇÃO ENCONTROU');
    medidas.forEach((a) => linhas.push(`- ${a.texto}`));
  }
  if ((j.acoes || []).length) {
    linhas.push('');
    linhas.push('O QUE EU MUDARIA, EM ORDEM');
    j.acoes.forEach((a, i) => linhas.push(`${i + 1}. [${JULG_ROTULO_GRAVIDADE[a.gravidade]}] ${a.label} (${a.nota}/10) — ${a.acao}`));
  }
  const retencao = (item.avaliacoes || []).find((a) => a.avaliador === 'retencao');
  if ((retencao || {}).jornada && retencao.jornada.length) {
    linhas.push('');
    linhas.push('A JORNADA DO ESPECTADOR, TRECHO POR TRECHO');
    retencao.jornada.forEach((t) => linhas.push(`${t.trecho} [${JULG_ROTULO_RISCO[t.riscoAbandono] || t.riscoAbandono}]${t.observacao ? ` — ${t.observacao}` : ''}`));
    if (retencao.recompensaFinalTexto) linhas.push(`Recompensa no final: ${retencao.recompensaFinal ? 'sim' : 'não'} — ${retencao.recompensaFinalTexto}`);
  }
  /* UMA linha em branco antes do bloco de eixos, não uma entre cada eixo. A
   * versão anterior testava "a última linha é vazia?" DENTRO do laço: valia
   * para o primeiro eixo e, do segundo em diante, a última linha era sempre o
   * eixo anterior — então separava todos, um a um. */
  const eixos = (j.eixos || []).filter((e) => e.nota != null);
  if (eixos.length) {
    linhas.push('');
    linhas.push('OS QUATRO EIXOS');
    eixos.forEach((e) => linhas.push(`${e.label}: ${e.nota}/100`));
  }
  return linhas.join('\n');
}

/* ----- Modo Seleção ----- */

/* O acervo entra num campo só, com os vídeos separados por uma linha de três
 * traços. É deselegante e é de propósito: qualquer coisa mais sofisticada (uma
 * lista de arquivos, um gerenciador) seria mais tela para uma tarefa que o
 * usuário faz colando texto. O botão de anexo já separa sozinho. */
const JULG_SEPARADOR = /^\s*-{3,}\s*$/m;

function julgSepararLote(texto) {
  return String(texto || '').split(JULG_SEPARADOR)
    .map((t) => t.trim()).filter((t) => t.length > 20)
    .map((conteudo, i) => {
      // A primeira linha vira o nome quando é curta — costuma ser o título.
      const primeira = (conteudo.split('\n')[0] || '').trim();
      const nome = (primeira.length && primeira.length <= 70) ? primeira : `Vídeo ${i + 1}`;
      return { id: `lote-${i}`, nome, conteudo };
    });
}

function renderJulgTriagem(res) {
  const area = $('#j-lote-result');
  if (!area) return;
  const linhas = res.fila.map((x, i) => {
    if (!x.ok) {
      return `<div class="julg-fila-item julg-vermelho"><span class="julg-fila-pos">${i + 1}</span>
        <span class="julg-fila-nome">${escapeHtml(x.nome)}</span>
        <span class="julg-fila-porque">não deu para avaliar: ${escapeHtml(x.erro || '')}</span></div>`;
    }
    const j = x.juizo;
    const p = j.principal;
    return `
      <div class="julg-fila-item ${JULG_CLASSE_VEREDITO[j.veredito] || ''}">
        <span class="julg-fila-pos">${i + 1}</span>
        <span class="julg-fila-nome">${escapeHtml(x.nome)}</span>
        <span class="julg-fila-veredito">${escapeHtml((j.vereditoInfo || {}).label || '')} · ${j.nota}/100</span>
        ${p ? `<span class="julg-fila-porque">${escapeHtml(p.label)}: ${escapeHtml((p.problema || '').slice(0, 120))}</span>` : ''}
      </div>`;
  }).join('');
  const banca = (res.banca || []).map((id) => (JULG_AVALIADORES[id] || {}).label || id);
  area.innerHTML = `
    <div class="julg-secao-titulo">A fila — do mais pronto ao mais fraco</div>
    <div class="text-xs text-mute mb-1">Triagem com banca reduzida (${escapeHtml(banca.join(', '))}) mais todas as conferências automáticas. Abra os melhores e submeta à banca inteira antes de publicar.</div>
    ${linhas}`;
}

/* ----- Histórico ----- */

function renderJulgHistorico() {
  const lista = $('#j-history-list');
  if (!lista) return;
  const itens = State.julgamentos || [];
  if (!itens.length) {
    lista.innerHTML = '<div class="text-sm text-mute" style="padding:0.5rem;">Nada avaliado ainda.</div>';
    return;
  }
  lista.innerHTML = itens.map((it) => {
    const j = it.juizo || {};
    return `
      <div class="list-item" data-julg-id="${escapeHtml(it.id)}" role="button" tabindex="0">
        <div class="list-item-header">
          <div class="list-item-title">${escapeHtml(it.nome || 'Conteúdo')}</div>
          <button class="list-item-del" data-julg-del="${escapeHtml(it.id)}" title="Excluir" aria-label="Excluir">✕</button>
        </div>
        <div class="list-item-meta">${escapeHtml((j.vereditoInfo || {}).label || '')} · ${j.nota}/100 · ${escapeHtml(formatDate(it.createdAt))}</div>
      </div>`;
  }).join('');

  lista.querySelectorAll('[data-julg-id]').forEach((el) => {
    const abrir = () => {
      const it = (State.julgamentos || []).find((x) => x.id === el.dataset.julgId);
      if (!it) return;
      const d = julgadorDraft();
      d.conteudo = it.conteudo || d.conteudo;
      d.visual = it.visual || '';
      d.titulo = (it.embalagem || {}).titulo || '';
      d.capa = (it.embalagem || {}).capa || '';
      d.legenda = (it.embalagem || {}).legenda || '';
      d.formato = ((it.juizo || {}).ponderado || {}).formato || d.formato;
      saveJulgadorDraft();
      julgPreencher();
      renderJulgResultado(it);
      fecharJulgHistorico();
    };
    el.onclick = (e) => { if (!e.target.closest('[data-julg-del]')) abrir(); };
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } };
  });
  lista.querySelectorAll('[data-julg-del]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      State.julgamentos = (State.julgamentos || []).filter((x) => x.id !== b.dataset.julgDel);
      saveJulgamentos();
      renderJulgHistorico();
    };
  });
}

function abrirJulgHistorico() {
  renderJulgHistorico();
  const d = $('#j-history-drawer'), b = $('#j-history-backdrop');
  if (d) d.classList.add('open');
  if (b) b.classList.remove('hidden');
}
function fecharJulgHistorico() {
  const d = $('#j-history-drawer'), b = $('#j-history-backdrop');
  if (d) d.classList.remove('open');
  if (b) b.classList.add('hidden');
}

/* ----- Montagem da tela ----- */

function julgPreencher() {
  const d = julgadorDraft();
  const set = (sel, v) => { const el = $(sel); if (el) el.value = v || ''; };
  set('#j-conteudo', d.conteudo);
  set('#j-visual', d.visual);
  set('#j-titulo', d.titulo);
  set('#j-capa', d.capa);
  set('#j-legenda', d.legenda);
  set('#j-lote', d.lote);
  set('#j-formato', d.formato || 'geral');
}

function julgEmbalagemAtual() {
  const d = julgadorDraft();
  return { titulo: d.titulo || '', capa: d.capa || '', legenda: d.legenda || '' };
}

function julgEtapaVisual(hostSel) {
  return (chave, titulo, desc) => {
    const t = $(`${hostSel} .julg-loading-title`), dsc = $(`${hostSel} .julg-loading-desc`);
    if (t) t.textContent = titulo;
    if (dsc) dsc.textContent = desc;
    $$(`${hostSel} .pipeline-step`).forEach((el) => {
      if (el.dataset.step === chave) el.classList.add('active');
      else if (el.classList.contains('active')) el.classList.replace('active', 'done');
    });
  };
}

function julgTelaDeEspera(passos) {
  return `
    <div class="empty">
      <div class="spinner spinner-lg" style="color: var(--accent); border-right-color: transparent; margin: 0 auto 1rem;"></div>
      <div class="empty-title julg-loading-title">Medindo o conteúdo…</div>
      <div class="empty-desc julg-loading-desc">Tempo até o gancho, repetição, promessa da capa.</div>
      <div class="pipeline-steps">${passos}</div>
    </div>`;
}

function renderJulgador() {
  /* TEXTO RECEBIDO DE OUTRA FERRAMENTA vira o CONTEÚDO a julgar — o campo da
   * transcrição. Entra antes de `julgPreencher`, que é quem escreve na tela.
   *
   * Zera `julgadorOrigemId` pelo mesmo motivo do botão "Julgar outro conteúdo":
   * sem isso o próximo veredito sairia comparado com o vídeo anterior, que não
   * tem relação nenhuma com o material que acabou de chegar. */
  if (State.handoff && State.handoff.target === 'julgador') {
    const texto = String(State.handoff.text || '');
    State.handoff = null;
    if (texto.trim()) {
      const d = julgadorDraft();
      d.conteudo = texto;
      d.visual = '';
      d.titulo = ''; d.capa = ''; d.legenda = '';
      saveJulgadorDraft();
      State.julgadorOrigemId = null;
      julgLimparResultado();
      julgLimparSugestao();
    }
  }

  // O seletor de formato — populado a partir do registro, não gravado no HTML,
  // para o perfil de pesos poder ganhar entradas sem tocar em index.html.
  const formatoSel = $('#j-formato');
  if (formatoSel) {
    formatoSel.innerHTML = JULG_FORMATOS.map((f) =>
      `<option value="${escapeHtml(f.id)}">${escapeHtml(f.label)}</option>`).join('');
  }

  julgPreencher();
  { const a = $('#j-api-warning'); if (a) a.classList.add('hidden'); }
  ['#j-attach-pending', '#j-lote-attach-pending'].forEach((sel) => {
    const p = $(sel); if (p) p.innerHTML = '';
  });

  /* A TELA INTEIRA É RELIGADA A CADA RENDER, sem guard de "uma vez só".
   *
   * O guard existia para não empilhar `addEventListener`. Trocando os dois
   * ouvintes de rascunho por `oninput =`, toda a ligação desta tela passa a ser
   * por ATRIBUIÇÃO — religar substitui em vez de acumular, e nada empilha.
   *
   * O que se ganha: os handlers deixam de ficar presos aos elementos do primeiro
   * render. Com o guard, um botão acrescentado depois (foi o caso do "Julgar
   * outro conteúdo") só era ligado se por acaso já existisse na primeira vez —
   * e numa tela remontada nenhum deles funcionava. */
  wireMtabs('#view-julgador');

  // Rascunho — cada campo guarda sozinho.
  [['#j-conteudo', 'conteudo'], ['#j-visual', 'visual'], ['#j-titulo', 'titulo'],
    ['#j-capa', 'capa'], ['#j-legenda', 'legenda'], ['#j-lote', 'lote'], ['#j-formato', 'formato']].forEach(([sel, chave]) => {
    const el = $(sel);
    if (!el) return;
    const guardar = () => {
      julgadorDraft()[chave] = el.value;
      saveJulgadorDraft();
      // Mexeu no conteúdo? O diagnóstico na tela é da versão anterior. Ele
      // sai, mas continua guardado no histórico — e vira base de comparação.
      if (chave === 'conteudo' && _julgResultadoVisivel) julgLimparResultado();
      // Trocou o formato com um diagnóstico na tela? A nota ponderada é
      // recalculada na hora, sem gastar chamada de IA nenhuma.
      if (chave === 'formato' && _julgResultadoVisivel) julgRecalcularPonderado(el.value);
    };
    el.oninput = guardar;
    /* `change` também, e não é redundância: o `<select>` é o único campo desta
     * tela em que o navegador é quem escolhe qual evento disparar, e a
     * plataforma inteira liga seletor por `change` (ver generate.js,
     * posters.js). Ligar os dois faz o formato guardar em qualquer navegador —
     * e como o corpo é idempotente, disparar duas vezes não faz diferença. */
    if (el.tagName === 'SELECT') el.onchange = guardar;
  });

  if ($('#j-novo')) $('#j-novo').onclick = () => {
    if (julgNovoConteudo()) toast('Mesa limpa. Cole ou anexe o próximo conteúdo.', 'success');
  };

  if ($('#j-sugerir')) $('#j-sugerir').onclick = julgSugerirEmbalagem;

  if ($('#j-history-open')) $('#j-history-open').onclick = abrirJulgHistorico;
  if ($('#j-history-close')) $('#j-history-close').onclick = fecharJulgHistorico;
  if ($('#j-history-backdrop')) $('#j-history-backdrop').onclick = fecharJulgHistorico;
  if ($('#j-history-clear')) $('#j-history-clear').onclick = () => {
    if (!(State.julgamentos || []).length) return;
    if (!confirm('Apagar todos os julgamentos guardados?')) return;
    State.julgamentos = [];
    saveJulgamentos();
    renderJulgHistorico();
    toast('Histórico limpo.', 'success');
  };

  /* ---- Submeter um conteúdo à banca ---- */
  if ($('#j-submit')) $('#j-submit').onclick = async () => {
    const conteudo = String(($('#j-conteudo') || {}).value || '').trim();
    if (conteudo.length < 40) {
      toast('Cole o roteiro ou a transcrição — a banca precisa do conteúdo inteiro para julgar.', 'info', 5000);
      return;
    }
    { const a = $('#j-api-warning'); if (a) a.classList.add('hidden'); }
    if (!julgTemChave()) { julgAvisarSemChave(); return; }

    const btn = $('#j-submit');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> A banca lê…';
    /* A TELA DE ESPERA SUBSTITUI O DIAGNÓSTICO, e o estado tem de dizer isso.
     * Sem zerar aqui, `_julgResultadoVisivel` continuava `true` durante a
     * espera: trocar o formato no meio de uma submissão chamava o recálculo,
     * que redesenhava o resultado ANTERIOR por cima da tela de carregamento —
     * e as etapas seguintes do pipeline pintavam um progresso que já não
     * estava mais na tela. */
    _julgResultadoVisivel = false;
    _julgItemAtual = null;
    $('#j-result-area').innerHTML = julgTelaDeEspera(`
      <span class="pipeline-step" data-step="conferencia">Medição</span>
      <span class="pipeline-step" data-step="banca">Banca</span>
      <span class="pipeline-step" data-step="juiz">Veredito</span>`);

    try {
      const embalagem = julgEmbalagemAtual();
      // O que se VÊ — a segunda fonte, tão parte do vídeo quanto a fala.
      const visual = String(($('#j-visual') || {}).value || '').trim();
      const res = await runJulgamentoPipeline({
        conteudo, embalagem, visual, formato: julgadorDraft().formato,
        call: callLLM, onEtapa: julgEtapaVisual('#j-result-area'),
      });
      // A comparação só existe quando o autor pediu para reavaliar: comparar
      // com um vídeo qualquer do histórico não diria nada.
      const origem = State.julgadorOrigemId
        ? (State.julgamentos || []).find((x) => x.id === State.julgadorOrigemId) : null;
      const item = {
        id: uuid(),
        createdAt: new Date().toISOString(),
        nome: embalagem.titulo || conteudo.slice(0, 60).replace(/\s+/g, ' '),
        conteudo, embalagem, visual,
        juizo: res.juizo,
        avaliacoes: res.avaliacoes,
        banca: res.banca,
        local: res.local,
        origemId: origem ? origem.id : null,
        comparacao: origem ? compararJulgamentos(origem.juizo, res.juizo) : null,
        model: res.model,
      };
      State.julgadorOrigemId = null;
      State.julgamentos = State.julgamentos || [];
      State.julgamentos.unshift(item);
      saveJulgamentos();
      renderJulgResultado(item);
      renderJulgHistorico();
      toast((res.juizo.vereditoInfo || {}).label || 'Pronto.', res.juizo.veredito === 'sim' ? 'success' : 'info');
    } catch (err) {
      toast(err.message || 'Não foi possível avaliar.', 'error', 6000);
      $('#j-result-area').innerHTML = `
        <div class="empty"><div class="empty-title">Erro</div>
        <div class="empty-desc">${escapeHtml(err.message || 'Tente novamente.')}</div></div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  };

  /* ---- Modo Seleção ---- */
  if ($('#j-lote-submit')) $('#j-lote-submit').onclick = async () => {
    const itens = julgSepararLote(($('#j-lote') || {}).value);
    if (itens.length < 2) {
      toast('Cole pelo menos dois conteúdos, separados por uma linha com ---', 'info', 6000);
      return;
    }
    { const a = $('#j-api-warning'); if (a) a.classList.add('hidden'); }
    if (!julgTemChave()) { julgAvisarSemChave(); return; }

    const btn = $('#j-lote-submit');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Triando ${itens.length}…`;
    $('#j-lote-result').innerHTML = julgTelaDeEspera('<span class="pipeline-step active" data-step="triagem">Triagem</span>');
    try {
      const res = await runTriagemPipeline({
        itens, formato: julgadorDraft().formato,
        call: callLLM, onEtapa: julgEtapaVisual('#j-lote-result'),
      });
      renderJulgTriagem(res);
      const prontos = res.fila.filter((x) => x.ok && x.juizo.veredito === 'sim').length;
      toast(`Triagem pronta — ${prontos} de ${itens.length} sem falha crítica.`, 'success', 6000);
    } catch (err) {
      toast(err.message || 'Não foi possível triar.', 'error', 6000);
      $('#j-lote-result').innerHTML = `
        <div class="empty"><div class="empty-title">Erro</div>
        <div class="empty-desc">${escapeHtml(err.message || 'Tente novamente.')}</div></div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  };

  /* Anexo.
   *
   * O `pendente` não é detalhe: vídeo e áudio acima do limite passam pelo
   * compressor de Web Audio, que no celular só funciona a partir de um gesto do
   * usuário. A primeira versão desta tela convertia direto no `change` do
   * seletor de arquivo — que não conta como gesto — e o resultado era 45
   * segundos de espera e um erro de "formato incompatível" com o formato
   * perfeitamente compatível. */
  if (typeof ingestLigarAnexo === 'function') {
    ingestLigarAnexo({
      botao: '#j-attach-btn', input: '#j-attach-input',
      campo: '#j-conteudo', pendente: '#j-attach-pending', organizar: true,
    });
    ingestLigarAnexo({
      botao: '#j-lote-attach-btn', input: '#j-lote-attach-input',
      campo: '#j-lote', pendente: '#j-lote-attach-pending', separador: '\n\n---\n\n', organizar: true,
    });
  }

  if (!_julgResultadoVisivel) julgLimparResultado();
  renderJulgHistorico();
}
