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

function julgadorDraft() {
  if (!State.julgadorDraft) {
    State.julgadorDraft = { conteudo: '', titulo: '', capa: '', legenda: '', lote: '' };
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

function julgLimparResultado() {
  _julgResultadoVisivel = false;
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
  State.julgadorDraft = { conteudo: '', titulo: '', capa: '', legenda: '', lote: d.lote || '' };
  saveJulgadorDraft();
  State.julgadorOrigemId = null;
  julgPreencher();
  julgLimparResultado();
  ['#j-attach-pending', '#j-lote-attach-pending'].forEach((sel) => {
    const p = $(sel); if (p) p.innerHTML = '';
  });
  const campo = $('#j-conteudo');
  if (campo) { try { campo.focus(); } catch (_) { /* */ } }
  return true;
}

function renderJulgResultado(item) {
  const area = $('#j-result-area');
  if (!area) return;
  _julgResultadoVisivel = true;
  const juizo = item.juizo || {};
  area.innerHTML = `
    ${julgBlocoVeredito(juizo)}
    ${julgBlocoComparacao(item)}
    ${julgBlocoPrincipal(juizo)}
    ${julgBlocoAcoes(juizo)}
    ${julgBlocoMedicao(item)}
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
  if (copy) copy.onclick = () => copyText(julgDiagnosticoEmTexto(item)).then(() => toast('Copiado.', 'success'));
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
  if (j.principal) {
    linhas.push('');
    linhas.push('SE VOCÊ SÓ PUDER MUDAR UMA COISA');
    linhas.push(`${j.principal.label}: ${j.principal.problema || ''}`);
    if (j.principal.correcao) linhas.push(`→ ${j.principal.correcao}`);
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
  (j.eixos || []).filter((e) => e.nota != null).forEach((e) => {
    if (linhas[linhas.length - 1] !== '') linhas.push('');
    linhas.push(`${e.label}: ${e.nota}/100`);
  });
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
      d.titulo = (it.embalagem || {}).titulo || '';
      d.capa = (it.embalagem || {}).capa || '';
      d.legenda = (it.embalagem || {}).legenda || '';
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
  set('#j-titulo', d.titulo);
  set('#j-capa', d.capa);
  set('#j-legenda', d.legenda);
  set('#j-lote', d.lote);
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
  [['#j-conteudo', 'conteudo'], ['#j-titulo', 'titulo'], ['#j-capa', 'capa'],
    ['#j-legenda', 'legenda'], ['#j-lote', 'lote']].forEach(([sel, chave]) => {
    const el = $(sel);
    if (!el) return;
    el.oninput = () => {
      julgadorDraft()[chave] = el.value;
      saveJulgadorDraft();
      // Mexeu no conteúdo? O diagnóstico na tela é da versão anterior. Ele
      // sai, mas continua guardado no histórico — e vira base de comparação.
      if (chave === 'conteudo' && _julgResultadoVisivel) julgLimparResultado();
    };
  });

  if ($('#j-novo')) $('#j-novo').onclick = () => {
    if (julgNovoConteudo()) toast('Mesa limpa. Cole ou anexe o próximo conteúdo.', 'success');
  };

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
    $('#j-result-area').innerHTML = julgTelaDeEspera(`
      <span class="pipeline-step" data-step="conferencia">Medição</span>
      <span class="pipeline-step" data-step="banca">Banca</span>
      <span class="pipeline-step" data-step="juiz">Veredito</span>`);

    try {
      const embalagem = julgEmbalagemAtual();
      const res = await runJulgamentoPipeline({
        conteudo, embalagem, call: callLLM, onEtapa: julgEtapaVisual('#j-result-area'),
      });
      // A comparação só existe quando o autor pediu para reavaliar: comparar
      // com um vídeo qualquer do histórico não diria nada.
      const origem = State.julgadorOrigemId
        ? (State.julgamentos || []).find((x) => x.id === State.julgadorOrigemId) : null;
      const item = {
        id: uuid(),
        createdAt: new Date().toISOString(),
        nome: embalagem.titulo || conteudo.slice(0, 60).replace(/\s+/g, ' '),
        conteudo, embalagem,
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
      const res = await runTriagemPipeline({ itens, call: callLLM, onEtapa: julgEtapaVisual('#j-lote-result') });
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
      campo: '#j-conteudo', pendente: '#j-attach-pending',
    });
    ingestLigarAnexo({
      botao: '#j-lote-attach-btn', input: '#j-lote-attach-input',
      campo: '#j-lote', pendente: '#j-lote-attach-pending', separador: '\n\n---\n\n',
    });
  }

  if (!_julgResultadoVisivel) julgLimparResultado();
  renderJulgHistorico();
}
