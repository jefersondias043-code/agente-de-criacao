// SERVICE WORKER — a lista de precache tem de dizer a verdade
//
// Este teste nasceu ao remover o Detector Flop e o AutoPost IA (r227): os cinco
// arquivos deles continuavam listados depois de apagados do repositório. O
// `check:manifest` não pegaria — ele confere os scripts de src/ entre o
// index.html e o service worker, e esses cinco são arquivos de topo, que
// ninguém estava conferindo.
//
// ESCREVI PRIMEIRO QUE UM 404 AQUI DERRUBAVA O INSTALL INTEIRO, porque é o que
// `cache.addAll` faz. Medi no Chromium antes de fechar e não é o que acontece
// nesta base: o install usa `Promise.allSettled` com um `c.add` por URL, e o
// comentário no service-worker.js conta que o `addAll` foi abandonado
// exatamente por isso. Com um arquivo inexistente na lista, o SW ativou e
// guardou as outras 45 respostas normalmente.
//
// Então o que este teste protege é mais modesto do que eu supunha, e vale
// assim mesmo:
//   - URL listada e ausente: um 404 desperdiçado a cada instalação, e uma lista
//     que mente sobre o que o app publica;
//   - página publicada e NÃO listada: essa sim some no offline, calada.
// A segunda metade é a que morde de verdade.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(raiz, 'service-worker.js'), 'utf8');

/** As URLs da lista URLS, sem a raiz './' (que é a própria página). */
const listadas = (() => {
  const bloco = sw.slice(sw.indexOf('const URLS = ['), sw.indexOf('];', sw.indexOf('const URLS = [')));
  return [...bloco.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
})();

describe('a lista de precache do service worker', () => {
  it('não está vazia — a comparação precisa comparar algo', () => {
    expect(listadas.length).toBeGreaterThan(20);
  });

  it('só lista arquivos que existem no repositório', () => {
    const faltando = listadas.filter((u) => !existsSync(join(raiz, u)));
    expect(faltando, 'listados no precache mas ausentes do disco').toEqual([]);
  });

  it('não deixa de fora nenhuma página que o app publica', () => {
    // Uma página fora da lista carrega online e some no offline.
    const paginas = ['index.html', 'replicador.html', 'removedor.html'];
    for (const p of paginas) {
      if (!existsSync(join(raiz, p))) continue;
      expect(listadas, `${p} ficou fora do precache`).toContain(p);
    }
  });

  it('não lista as ferramentas removidas no r227', () => {
    const mortos = listadas.filter((u) => /detector|autopost/i.test(u));
    expect(mortos).toEqual([]);
  });
});
