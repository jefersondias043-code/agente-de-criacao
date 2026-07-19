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
