#!/usr/bin/env node
// Sobe a versão de forma ATÔMICA: o cache do service-worker (agp-vNN) e o
// marcador de build do index.html (data-build) juntos. Evita o bug clássico de
// "esqueci de subir a versão do SW" → usuário rodando código obsoleto do cache.
// Uso: node scripts/bump-version.mjs        (incrementa o agp-vNN e carimba a data)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. service-worker.js: agp-vNN → agp-v(N+1)
const swPath = path.join(ROOT, 'service-worker.js');
let sw = fs.readFileSync(swPath, 'utf8');
const m = sw.match(/const CACHE = 'agp-v(\d+)';/);
if (!m) { console.error('✗ CACHE agp-vNN não encontrado no service-worker.js'); process.exit(1); }
const next = Number(m[1]) + 1;
sw = sw.replace(/const CACHE = 'agp-v\d+';/, `const CACHE = 'agp-v${next}';`);
fs.writeFileSync(swPath, sw);

// 2. index.html: data-build="AAAA-MM-DD-rNN" → data e build novos
const indexPath = path.join(ROOT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const today = new Date().toISOString().slice(0, 10);
html = html.replace(/data-build="[^"]*"/, `data-build="${today}-r${next}"`);
fs.writeFileSync(indexPath, html);

console.log(`✓ Versão subida: service-worker CACHE=agp-v${next} · index.html data-build=${today}-r${next}`);
