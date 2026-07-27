#!/usr/bin/env node
// Verifica o JavaScript EMBUTIDO nos .html da raiz (as ferramentas: removedor,
// autopost, detector, replicador e o boot do index).
//
// Por que existe: o `npm run lint` só olha `src/**/*.js`, mas as ferramentas
// somam mais de 10 mil linhas de JS dentro de <script> no HTML — nenhuma delas
// passava por verificação alguma. Um erro de sintaxe só apareceria no console
// do usuário, com a ferramenta inteira morta. Aqui extraímos cada bloco e o
// entregamos ao parser do próprio Node.
//
// Uso: node scripts/check-html-js.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Blocos <script> SEM src (código embutido), com a linha onde cada um começa. */
function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;                 // externo: nada a verificar
    if (/type\s*=\s*["']?(application\/json|text\/template)/i.test(attrs)) continue;
    const line = html.slice(0, m.index).split('\n').length;
    out.push({ code: m[2], line, module: /type\s*=\s*["']?module/i.test(attrs) });
  }
  return out;
}

const files = readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
let blocos = 0;
const erros = [];

for (const f of files) {
  const html = readFileSync(path.join(ROOT, f), 'utf8');
  for (const s of inlineScripts(html)) {
    if (!s.code.trim()) continue;
    blocos++;
    try {
      // Só COMPILA (não executa) — pega erro de sintaxe sem tocar em nada.
      new vm.Script(s.code, { filename: `${f}:${s.line}` });
    } catch (e) {
      erros.push(`${f} (bloco na linha ${s.line}): ${e.message}`);
    }
  }
}

if (erros.length) {
  console.error('✗ JavaScript embutido com erro de sintaxe:');
  erros.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log(`✓ JS embutido verificado: ${blocos} blocos em ${files.length} arquivos HTML.`);
