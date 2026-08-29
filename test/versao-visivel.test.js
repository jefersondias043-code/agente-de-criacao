// VERSÃO VISÍVEL E ATUALIZAÇÃO FORÇADA
//
// A plataforma é um PWA: o service worker guarda os arquivos para funcionar
// offline, e depois de uma publicação o aparelho pode seguir servindo a versão
// antiga até o worker ser trocado. Sem um número na tela, "não mudou nada aqui"
// é indistinguível de "não foi publicado" — e o usuário não tinha como
// desempatar isso sozinho.
//
// Este arquivo tranca as duas pontas: a versão aparece, e o botão realmente
// derruba o que estava guardado (na ordem certa) antes de recarregar.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModules, clearStorage } from './helpers/load.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Monta a tela de Configurações com os alvos que renderSettings preenche. */
function telaConfig(build) {
  document.body.innerHTML = `
    <div data-build="${build}"></div>
    <button class="s-provider-btn" data-provider="groq"></button>
    <div id="s-provider-config"></div>
    <span id="s-build">—</span>
    <button id="s-update-now"></button>
    <div class="toast-stack" id="toast-stack"></div>`;
  const T = loadModules(['catalogs.js', 'core.js', 'settings.js'], ['renderSettings', 'State']);
  T.renderSettings();
  return T;
}

let originais;
beforeEach(() => {
  clearStorage();
  originais = {
    sw: navigator.serviceWorker,
    caches: globalThis.caches,
    location: window.location,
  };
});
afterEach(() => {
  if (originais.caches === undefined) delete globalThis.caches;
  else globalThis.caches = originais.caches;
});

describe('a versão aparece nas Configurações', () => {
  it('mostra o build que está rodando no aparelho', () => {
    telaConfig('2026-08-29-r269');
    expect(document.getElementById('s-build').textContent).toBe('2026-08-29-r269');
  });

  it('sem marcador, diz "desconhecida" em vez de ficar em branco', () => {
    // Campo vazio parece defeito da tela; a palavra diz que a informação falta.
    document.body.innerHTML = `
      <button class="s-provider-btn" data-provider="groq"></button>
      <div id="s-provider-config"></div><span id="s-build">—</span>`;
    const T = loadModules(['catalogs.js', 'core.js', 'settings.js'], ['renderSettings']);
    T.renderSettings();
    expect(document.getElementById('s-build').textContent).toBe('desconhecida');
  });

  it('o marcador do index.html casa com a versão do service worker', () => {
    // Se os dois saírem de sincronia, o número na tela mente — e era justamente
    // a mentira que este cartão existe para acabar.
    const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    const sw = fs.readFileSync(path.join(RAIZ, 'service-worker.js'), 'utf8');
    const build = (html.match(/data-build="([^"]+)"/) || [])[1] || '';
    const cache = (sw.match(/agp-v(\d+)/) || [])[1] || '';
    expect(build).toMatch(/-r\d+$/);
    expect(build.endsWith(`-r${cache}`), `index.html=${build} vs service-worker=agp-v${cache}`).toBe(true);
  });
});

describe('o botão de atualizar derruba o que estava guardado', () => {
  it('desregistra o worker, limpa os caches e recarrega por uma URL nova', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const deletados = [];
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: async () => [{ unregister }] }, configurable: true,
    });
    globalThis.caches = {
      keys: async () => ['agp-v268', 'agp-v267'],
      delete: async (n) => { deletados.push(n); return true; },
    };
    const replace = vi.fn();
    delete window.location;
    window.location = { href: 'https://exemplo.com/app/', replace };

    telaConfig('2026-08-29-r269');
    await document.getElementById('s-update-now').onclick();

    expect(unregister).toHaveBeenCalled();
    expect(deletados).toEqual(['agp-v268', 'agp-v267']);
    // A URL precisa mudar: sem service worker o HTML ainda pode vir do cache de
    // disco, e aí a limpeza toda não teria adiantado nada.
    expect(replace).toHaveBeenCalled();
    expect(replace.mock.calls[0][0]).toMatch(/[?&]atualizar=\d+/);
  });

  it('navegador sem service worker nem caches ainda assim recarrega', async () => {
    // Cada passo é isolado de propósito: um ambiente sem PWA não pode deixar o
    // usuário preso num botão que não faz nada.
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    delete globalThis.caches;
    const replace = vi.fn();
    delete window.location;
    window.location = { href: 'https://exemplo.com/app/', replace };

    telaConfig('2026-08-29-r269');
    await document.getElementById('s-update-now').onclick();
    expect(replace).toHaveBeenCalled();
  });
});
