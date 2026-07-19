#!/usr/bin/env node
// Regenera os blocos de scripts marcados em index.html e service-worker.js a
// partir de scripts/scripts.manifest.mjs. Idempotente: rodar sem mudar o
// manifesto não altera os arquivos. Use `--check` para apenas verificar (CI).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCRIPTS } from './scripts.manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

function replaceBlock(content, startMarker, endMarker, body) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end === -1) throw new Error(`Marcadores não encontrados: ${startMarker} / ${endMarker}`);
  const before = content.slice(0, start + startMarker.length);
  const after = content.slice(end);
  return before + '\n' + body + '\n' + after;
}

// index.html — tags <script>
const indexPath = path.join(ROOT, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
const indexBody = SCRIPTS.map((f) => `<script src="src/${f}"></script>`).join('\n');
const indexNew = replaceBlock(indexHtml, '<!-- scripts:start -->', '<!-- scripts:end -->', indexBody);

// service-worker.js — entradas da lista URLS
const swPath = path.join(ROOT, 'service-worker.js');
let sw = fs.readFileSync(swPath, 'utf8');
const swBody = SCRIPTS.map((f) => `  './src/${f}',`).join('\n');
const swNew = replaceBlock(
  sw,
  '// scripts:start — gerado de scripts/scripts.manifest.mjs (npm run sync:manifest)',
  '  // scripts:end',
  swBody,
);

const changes = [];
if (indexNew !== indexHtml) changes.push('index.html');
if (swNew !== sw) changes.push('service-worker.js');

if (checkOnly) {
  if (changes.length) {
    console.error('✗ Blocos de script desatualizados em: ' + changes.join(', ') + ' — rode `npm run sync:manifest`.');
    process.exit(1);
  }
  console.log('✓ index.html e service-worker.js em sincronia com o manifesto.');
} else {
  if (indexNew !== indexHtml) fs.writeFileSync(indexPath, indexNew);
  if (swNew !== sw) fs.writeFileSync(swPath, swNew);
  console.log(changes.length ? '✓ Atualizado: ' + changes.join(', ') : '✓ Já estava em sincronia (nada a fazer).');
}
