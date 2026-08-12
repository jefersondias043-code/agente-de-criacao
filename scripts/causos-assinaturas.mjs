// Gera as assinaturas do modo CAUSOS para test/causos-intocado.test.js.
//
// O modo Causos é o que o usuário aprovou e pediu para não mexer. O teste que o
// protege compara assinaturas dos prompts e das contas; quando uma mudança nele
// for INTENCIONAL, rode este script e cole a saída no teste.
//
// Rodar sem querer e colar a saída derrota o propósito do teste: ele existe
// justamente para obrigar a decisão a ser consciente.
//
//   node scripts/causos-assinaturas.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { assinaturasCausos } from '../test/fixtures/causos-golden.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARQUIVOS = ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js', 'causos-motor.js'];
const NOMES = ['causoBlocoDoutrina', 'buildConceitosPrompt', 'buildDossiePrompt', 'buildContarPrompt',
  'buildCriticoPrompt', 'buildReescreverCausoPrompt', 'conferirCausoLocal', 'julgarCauso',
  'causoCriticosDe', 'CAUSO_GENEROS', 'CAUSO_DIMENSOES'];

// Os módulos são scripts clássicos de escopo global: o jsdom dá o document e o
// localStorage de que eles dependem no boot.
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://exemplo.test/', runScripts: 'outside-only' });
for (const k of ['window', 'document', 'localStorage']) {
  Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
}

const codigo = ARQUIVOS.map((f) => readFileSync(join(raiz, 'src', f), 'utf8')).join('\n;\n');
dom.window.eval(`${codigo}\n;window.__CAP__ = { ${NOMES.join(', ')} };`);

const a = assinaturasCausos(dom.window.__CAP__);
console.log('const ESPERADO = {');
for (const [k, v] of Object.entries(a)) console.log(`  ${k}: ${JSON.stringify(v)},`);
console.log('};');
