// Converte os módulos ESM (src/*.js) em scripts clássicos de escopo global,
// para que o app funcione ao abrir index.html via file:// (duplo-clique),
// onde <script type="module"> é bloqueado por CORS.
// Remove linhas import/export (a wiring adicionada no split) e prefixa 'use strict'.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const importRe = /^import\s+\{[^}]*\}\s+from\s+'[^']+';\s*$/;
const exportRe = /^export\s+\{[^}]*\}\s*;?\s*$/;

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const p = path.join(dir, f);
  const kept = fs.readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => !importRe.test(l) && !exportRe.test(l));
  let body = kept.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n');
  const out = "'use strict';\n" + body;
  fs.writeFileSync(p, out);
  console.log('classic:', f);
}
