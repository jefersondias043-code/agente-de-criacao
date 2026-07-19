#!/usr/bin/env node
// Fase 0 — fonte de verdade do manifesto de scripts.
// O index.html (tags <script>) e a lista URLS do service-worker são mantidos À
// MÃO; desalinhar com src/ quebra o boot em silêncio (função undefined) ou serve
// cache obsoleto/404. Este verificador falha se as três listas divergirem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 1. Scripts de src/ carregados pelo index.html.
const indexScripts = [...read('index.html').matchAll(/<script\s+src="src\/([^"]+\.js)"\s*><\/script>/g)].map((m) => m[1]);

// 2. Scripts de src/ na lista URLS do service-worker.
const swScripts = [...read('service-worker.js').matchAll(/['"]\.\/src\/([^'"]+\.js)['"]/g)].map((m) => m[1]);

// 3. Arquivos .js reais em src/.
const srcFiles = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js'));

const missing = (have, want) => want.filter((x) => !have.includes(x));
const problems = [];
missing(indexScripts, srcFiles).forEach((f) => problems.push(`src/${f} existe mas NÃO é carregado pelo index.html`));
missing(srcFiles, indexScripts).forEach((f) => problems.push(`index.html carrega src/${f} que NÃO existe`));
missing(swScripts, srcFiles).forEach((f) => problems.push(`src/${f} existe mas NÃO está no cache do service-worker (risco de cache obsoleto)`));
missing(srcFiles, swScripts).forEach((f) => problems.push(`service-worker cacheia src/${f} que NÃO existe`));

if (problems.length) {
  console.error('✗ Manifesto de scripts inconsistente:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log(`✓ Manifesto consistente: ${srcFiles.length} scripts em src/ alinhados entre index.html e service-worker.`);
