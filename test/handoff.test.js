// Fase 0 — rede de segurança: roteamento do handoff "Enviar para".
// "Texto é a moeda comum" — uma regressão aqui quebra a integração entre TODAS
// as ferramentas. Os destinos com efeito externo (goTo / criar cartaz) são
// stubados via escopo global, já que o código os referencia como variáveis livres.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let S;
beforeEach(() => {
  clearStorage();
  // toast() faz appendChild em #toast-stack — precisa existir no DOM do jsdom.
  document.body.innerHTML = '<div id="toast-stack"></div>';
  S = loadModules(['core.js', 'handoff.js'], [
    'TEXT_CONSUMERS', 'sendToBarHtml', 'sendTextTo', 'State',
  ]);
  // Stubs dos destinos que tocam o app (variáveis livres → globalThis).
  globalThis.goTo = vi.fn();
  globalThis.createPosterFromGeneration = vi.fn();
  globalThis.createCarouselFromGeneration = vi.fn();
});

describe('sendToBarHtml', () => {
  it('exclui a ferramenta de origem', () => {
    const html = S.sendToBarHtml('generate');
    expect(html).not.toContain('data-sendto="generate"');
    expect(html).toContain('data-sendto="autopost"');
    expect(html).toContain('data-sendto="cartazes"');
  });

  it('aceita lista de exclusão', () => {
    const html = S.sendToBarHtml(['generate', 'cartazes']);
    expect(html).not.toContain('data-sendto="generate"');
    expect(html).not.toContain('data-sendto="cartazes"');
    expect(html).toContain('data-sendto="autopost"');
  });
});

describe('sendTextTo', () => {
  it('destino nativo (Gerar): grava handoff e navega', () => {
    S.State.handoff = null;
    S.sendTextTo('generate', '  olá mundo  ');
    expect(S.State.handoff).toEqual({ target: 'generate', text: 'olá mundo' });
    expect(globalThis.goTo).toHaveBeenCalledWith('generate');
  });

  it('texto vazio não navega nem entrega', () => {
    S.sendTextTo('generate', '   ');
    expect(globalThis.goTo).not.toHaveBeenCalled();
  });

  it('destino com entrega própria (Cartaz): chama createPosterFromGeneration', () => {
    S.sendTextTo('cartazes', 'texto da matéria');
    expect(globalThis.createPosterFromGeneration).toHaveBeenCalledTimes(1);
    const arg = globalThis.createPosterFromGeneration.mock.calls[0][0];
    expect(arg.content).toBe('texto da matéria');
  });

  it('destino embutido (AutoPost): deixa conteúdo pendente e navega', () => {
    S.State.pendingContent = null;
    S.sendTextTo('autopost', 'roteiro');
    expect(S.State.pendingContent).toMatchObject({ frame: '#autopostFrame', text: 'roteiro' });
    expect(globalThis.goTo).toHaveBeenCalledWith('autopost');
  });

  it('avisa se o destino embutido não consumir o conteúdo a tempo', () => {
    vi.useFakeTimers();
    S.State.pendingContent = null;
    S.sendTextTo('autopost', 'roteiro'); // ninguém entrega → continua pendente
    vi.advanceTimersByTime(8001);
    expect(document.querySelector('#toast-stack').textContent).toContain('demorou a responder');
    vi.useRealTimers();
  });
});

/* ==========================================================================
 * ENTREGA ao iframe embutido — `loaded` vs `ready`.
 *
 * mountToolFrame (core.js) marca DOIS estados diferentes no mesmo elemento:
 *   loaded → o src acabou de ser atribuído; marcado NA HORA, o iframe pode nem
 *            ter começado a carregar. É trava anti-remontagem.
 *   ready  → o evento load disparou; só aqui existe contentWindow escutando.
 * A entrega checava `loaded`. Postar para um iframe que só está `loaded` manda
 * o texto para o vazio E limpa pendingContent — então a reentrega no load nunca
 * acontece e o conteúdo do usuário desaparece sem nenhum erro.
 * ======================================================================== */
describe('deliverPendingContent exige o iframe REALMENTE carregado', () => {
  let D;
  beforeEach(() => {
    D = loadModules(['core.js', 'handoff.js'], ['deliverPendingContent', 'State']);
    globalThis.goTo = vi.fn();
  });

  /** Monta um iframe de teste com os flags pedidos e espiona o postMessage. */
  function frameFalso({ loaded, ready }) {
    document.body.innerHTML = '<div id="toast-stack"></div><iframe id="autopostFrame"></iframe>';
    const f = document.querySelector('#autopostFrame');
    if (loaded) f.dataset.loaded = '1';
    if (ready) f.dataset.ready = '1';
    const enviados = [];
    Object.defineProperty(f, 'contentWindow', {
      configurable: true,
      value: { postMessage: (msg) => enviados.push(msg) },
    });
    return { f, enviados };
  }

  it('iframe só "loaded" (ainda carregando): NÃO entrega e mantém pendente', () => {
    const { enviados } = frameFalso({ loaded: true, ready: false });
    D.State.pendingContent = { frame: '#autopostFrame', target: 'novopacote', text: 'matéria' };
    D.deliverPendingContent();
    expect(enviados).toEqual([]);
    // o essencial: o conteúdo continua na fila para o load reentregar
    expect(D.State.pendingContent).not.toBeNull();
    expect(D.State.pendingContent.text).toBe('matéria');
  });

  it('iframe "ready": entrega e limpa a fila', () => {
    const { enviados } = frameFalso({ loaded: true, ready: true });
    D.State.pendingContent = { frame: '#autopostFrame', target: 'novopacote', text: 'matéria' };
    D.deliverPendingContent();
    expect(enviados.length).toBe(1);
    expect(enviados[0]).toMatchObject({ type: 'agente:content', target: 'novopacote', text: 'matéria' });
    expect(D.State.pendingContent).toBeNull();
  });

  it('sem nada pendente, não faz nada', () => {
    const { enviados } = frameFalso({ loaded: true, ready: true });
    D.State.pendingContent = null;
    expect(() => D.deliverPendingContent()).not.toThrow();
    expect(enviados).toEqual([]);
  });

  it('iframe inexistente não quebra nem descarta o conteúdo', () => {
    document.body.innerHTML = '<div id="toast-stack"></div>';
    D.State.pendingContent = { frame: '#naoExiste', target: 'x', text: 'matéria' };
    expect(() => D.deliverPendingContent()).not.toThrow();
    expect(D.State.pendingContent).not.toBeNull();
  });
});
