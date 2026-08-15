'use strict';
/* ============================================================
   CONECTIVIDADE — handoff de conteúdo entre ferramentas
   Princípio: TEXTO é a moeda comum. Qualquer ferramenta que produz texto
   pode "Enviar para" outra que consome texto.
   - Destinos NATIVOS (Gerar): via State.handoff + goTo (o render pré-preenche).
   - Destinos EMBUTIDOS (AutoPost/Detector): via postMessage (mesma ponte da
     config); o iframe recebe 'agente:content', troca de aba e preenche o campo.
   ============================================================ */
const TEXT_CONSUMERS = [
  { id: 'generate', label: 'Gerar matéria', kind: 'native', view: 'generate' },
  // Narrativa: recebe o texto como IDEIA BRUTA — o ponto de partida para achar
  // o desejo, o obstáculo e o risco antes de virar conteúdo.
  { id: 'narrativa', label: 'Narrativa', kind: 'native', view: 'narrativa' },
  // Causos: o texto vira a IDEIA de onde a mesa tira a história.
  { id: 'causos', label: 'Causos', kind: 'native', view: 'causos' },
  // Pacote: o texto vira o CONTEÚDO a empacotar — título, legenda, hashtags e
  // palavras-chave a partir do que qualquer outra ferramenta já produziu.
  { id: 'pacote', label: 'Pacote', kind: 'native', view: 'pacote' },
  // Aferidor: o texto vira o CONTEÚDO a aferir — o questionário binário roda
  // sobre ele e a nota sai de uma conta do código.
  { id: 'aferidor', label: 'Aferidor', kind: 'native', view: 'aferidor' },
  // Cartazes: cria um cartaz a partir do texto (reusa o parser de matéria → headline/categoria/etc.)
  { id: 'cartazes', label: 'Cartaz', kind: 'native', view: 'posters',
    deliver: (text) => createPosterFromGeneration({ id: uuid(), content: text, style: '—', tone: '—', createdAt: new Date().toISOString() }) },
  // Carrossel: cria um carrossel (vários slides) a partir do texto.
  { id: 'carrossel', label: 'Carrossel', kind: 'native', view: 'posters',
    deliver: (text) => createCarouselFromGeneration({ id: uuid(), content: text, style: '—', tone: '—', createdAt: new Date().toISOString() }) },
  // Replicador: gera uma nova versão a partir de um conteúdo que já funcionou.
  { id: 'replicador', label: 'Replicador', kind: 'embedded', view: 'replicador', frame: '#replicadorFrame', target: 'replicar' },
];

/** Entrega o conteúdo pendente ao iframe embutido (se já carregado). Chamado
 *  logo após enviar (iframe já aberto) e no evento load de cada iframe.
 *
 *  A guarda é `dataset.ready`, NÃO `dataset.loaded`: os dois existem e querem
 *  dizer coisas diferentes (ver mountToolFrame em core.js).
 *    loaded → o src já foi atribuído; marcado NA HORA, o iframe pode nem ter
 *             começado a carregar. Serve de trava anti-remontagem.
 *    ready  → o evento load disparou; aí sim existe contentWindow ouvindo.
 *  Postar mensagem para um iframe apenas `loaded` manda o texto para o vazio E
 *  limpa State.pendingContent, então a reentrega no load nunca acontece — o
 *  conteúdo do usuário desaparece sem erro. Hoje as duas chamadas são seguras
 *  por acidente do fluxo; a guarda certa impede que a terceira não seja. */
function deliverPendingContent() {
  const p = State.pendingContent;
  if (!p) return;
  const f = $(p.frame);
  if (!f || !f.dataset.ready) return; // será entregue quando o iframe carregar
  try {
    f.contentWindow.postMessage({ type: 'agente:content', target: p.target, text: p.text },
      typeof toolTargetOrigin === 'function' ? toolTargetOrigin() : '*');
  } catch (e) { /* */ }
  State.pendingContent = null;
}

/** Envia um texto para a ferramenta consumidora escolhida. */
function sendTextTo(consumerId, text) {
  text = (text || '').trim();
  if (!text) { toast('Nada para enviar.', 'error'); return; }
  const c = TEXT_CONSUMERS.find((x) => x.id === consumerId);
  if (!c) return;
  if (c.kind === 'native') {
    if (typeof c.deliver === 'function') {
      c.deliver(text); // destino com entrega própria (ex.: Cartazes cria o cartaz)
    } else {
      State.handoff = { target: c.id, text };
      goTo(c.view); // o render do destino detecta State.handoff e pré-preenche
    }
  } else {
    State.pendingContent = { frame: c.frame, target: c.target, text };
    goTo(c.view); // dispara o lazy-load do iframe (render*)
    const f = $(c.frame);
    if (f && f.dataset.ready) deliverPendingContent(); // já carregado de fato: entrega já
    // Confiabilidade: se a ferramenta não consumir o conteúdo a tempo (iframe que
    // não carrega), avisa em vez de deixar pendente em silêncio.
    setTimeout(() => {
      if (State.pendingContent && State.pendingContent.frame === c.frame) {
        toast(c.label + ' demorou a responder — reabra a ferramenta e tente de novo.', 'error', 6000);
      }
    }, 8000);
  }
  toast('Enviado para ' + c.label + '.', 'success');
}

/** HTML da barra "Enviar para…" (exclui a ferramenta de origem). */
function sendToBarHtml(exclude) {
  const ex = Array.isArray(exclude) ? exclude : [exclude];
  const items = TEXT_CONSUMERS.filter((c) => !ex.includes(c.id));
  if (!items.length) return '';
  return `<div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-top:0.75rem; padding-top:0.75rem; border-top:1px dashed var(--line);">
    <span style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-mute); font-weight:600;">Enviar para</span>
    ${items.map((c) => `<button class="btn btn-ghost btn-sm" data-sendto="${c.id}">${escapeHtml(c.label)} →</button>`).join('')}
  </div>`;
}

/** Liga os botões [data-sendto] dentro de rootEl. getText() devolve o texto. */
function wireSendTo(rootEl, getText) {
  if (!rootEl) return;
  rootEl.querySelectorAll('[data-sendto]').forEach((b) => {
    b.onclick = () => sendTextTo(b.dataset.sendto, getText());
  });
}

// Recebe conteúdo DEVOLVIDO pelas ferramentas embutidas (ex.: pacote do AutoPost)
// e roteia para o destino escolhido. postMessage funciona em file:// também.
// SEGURANÇA: só aceita comandos vindos dos iframes das nossas ferramentas.
if (typeof window !== 'undefined') {
  window.addEventListener('message', function (e) {
    if (!e || !e.data || typeof isToolFrameSource !== 'function' || !isToolFrameSource(e)) return;
    // Canal de TEXTO: roteia para a ferramenta consumidora escolhida.
    if (e.data.type === 'agente:content-out' && e.data.target) {
      sendTextTo(e.data.target, String(e.data.text || ''));
    }
    // Canal de IMAGEM (novo): o Removedor de Fundo envia o recorte pronto (PNG
    // transparente) para virar uma CAMADA no editor de Cartaz. Reusa o sistema
    // de camadas unificado (r116). Só aceita data URL de imagem.
    else if (e.data.type === 'agente:image-out' && typeof e.data.dataUrl === 'string' &&
             /^data:image\//.test(e.data.dataUrl) && typeof addImageAsLayer === 'function') {
      addImageAsLayer(e.data.dataUrl);
    }
  });
}
