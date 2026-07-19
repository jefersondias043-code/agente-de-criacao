// Carregador compartilhado para testar os módulos de ESCOPO GLOBAL.
//
// Os módulos em src/ são scripts clássicos (não-ESM) que dependem de escopo
// global e ordem de carregamento — exatamente como rodam no navegador via
// file://. Para testá-los, concatenamos os arquivos na ordem certa, anexamos
// uma linha de captura DENTRO do mesmo eval (porque `'use strict'` + eval
// indireto isola as declarações em seu próprio escopo) e devolvemos os símbolos
// pedidos. Mesmo truque do test/pure.test.js original, fatorado para reuso.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

const readSrc = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

/**
 * Carrega uma lista de arquivos de src/ no escopo global do teste e devolve um
 * objeto com os símbolos capturados.
 * @param {string[]} files  arquivos em src/, em ordem de dependência
 * @param {string[]} captureNames identificadores top-level a capturar
 * @returns {Record<string, any>}
 */
export function loadModules(files, captureNames) {
  const code =
    files.map(readSrc).join('\n;\n') +
    `\n;globalThis.__CAP__ = { ${captureNames.join(', ')} };`;
  // eval INDIRETO → roda no escopo global do jsdom (document/window/localStorage)
  (0, eval)(code);
  return globalThis.__CAP__;
}

/** Limpa o localStorage polyfillado entre testes (isolamento). */
export function clearStorage() {
  if (typeof localStorage !== 'undefined') localStorage.clear();
}
