#!/usr/bin/env node
// Regenera detector-flop.tailwind.css a partir das classes usadas em
// detector-flop.html. O Detector Flop usa Tailwind; ANTES via Play CDN
// (cdn.tailwindcss.com — próprio p/ desenvolvimento e frágil: bloqueadores/redes
// que barram o script deixavam a página sem estilo). Agora é um build ESTÁTICO
// auto-hospedado, sem dependência de CDN (funciona inclusive via file://).
//
// Rode SEMPRE que mudar classes Tailwind no detector-flop.html:
//     npm run build:detector-css
// (baixa o tailwindcss sob demanda via npx; precisa de internet só nessa hora.)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'detector-flop.html');
const OUT = path.join(ROOT, 'detector-flop.tailwind.css');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'detcss-'));
// Escaneia o HTML (classes literais, inclusive nos <script>) e inclui o preflight
// (base) — igual ao que o Play CDN entregava.
fs.writeFileSync(path.join(tmp, 'tailwind.config.js'),
  `module.exports={content:[${JSON.stringify(HTML)}],theme:{extend:{}},corePlugins:{preflight:true}};`);
fs.writeFileSync(path.join(tmp, 'input.css'), '@tailwind base;@tailwind components;@tailwind utilities;');

execFileSync('npx', [
  '--yes', 'tailwindcss@3.4.17',
  '-c', path.join(tmp, 'tailwind.config.js'),
  '-i', path.join(tmp, 'input.css'),
  '-o', OUT, '--minify',
], { stdio: 'inherit' });

console.log('✓ detector-flop.tailwind.css regenerado a partir de detector-flop.html');
