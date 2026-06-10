// Build script (one-shot) — decompõe index.html monolítico em arquivos.
// Behavior-preserving: move o código VERBATIM por faixas de linha; só adiciona
// import/export e troca srcdoc->src no Detector. Não altera lógica.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
fs.mkdirSync(srcDir, { recursive: true });

const raw = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const lines = raw.split('\n'); // mantém '\r' final em cada linha se CRLF

// slice por faixa 1-indexed inclusiva
const R = (s, e) => lines.slice(s - 1, e).join('\n');
const Rs = (ranges) => ranges.map(([s, e]) => R(s, e)).join('\n');

// ---------- 1) styles.css (conteúdo entre <style> e </style>) ----------
fs.writeFileSync(path.join(root, 'styles.css'), R(29, 1184).replace(/\r$/gm, '') + '\n');

// ---------- 2) detector-flop.html (eval do literal DETECTOR_FLOP_HTML) ----------
const detLine = lines[2410].trim(); // linha 2411 (1-indexed)
const expr = detLine.replace(/^const\s+DETECTOR_FLOP_HTML\s*=\s*/, '').replace(/;$/, '');
const detectorHtml = (0, eval)(expr);
fs.writeFileSync(path.join(root, 'detector-flop.html'), detectorHtml);

// ---------- 3) módulos ESM (src/*.js) ----------
const modules = [
  {
    file: 'catalogs.js',
    imports: '',
    ranges: [[1825, 2235]],
    transforms: [],
    exports: 'export { STYLES, TONES, TONE_PROMPTS, PROVIDER_MODELS };',
  },
  {
    file: 'core.js',
    imports: '',
    ranges: [[1726, 1823], [2237, 2275]],
    transforms: [],
    exports: 'export { STORAGE_KEYS, loadJSON, saveJSON, loadPortals, State, uuid, $, $$, toast, formatBytes, formatDate, escapeHtml, truncate };',
  },
  {
    file: 'llm.js',
    imports:
      "import { State } from './core.js';\n" +
      "import { TONE_PROMPTS } from './catalogs.js';",
    ranges: [[2443, 2693]],
    transforms: [],
    exports: 'export { MAX_CONTENT_CHARS, findCatalogItem, buildPrompt, cleanText, callGroq, callOpenAI, callAnthropic, callLLM };',
  },
  {
    file: 'generate.js',
    imports:
      "import { State, $, $$, toast, escapeHtml, formatDate, saveJSON, STORAGE_KEYS, uuid } from './core.js';\n" +
      "import { STYLES, TONES } from './catalogs.js';\n" +
      "import { MAX_CONTENT_CHARS, buildPrompt, callLLM, cleanText } from './llm.js';\n" +
      "import { createPosterFromGeneration } from './posters.js';\n" +
      "import { goTo } from './app.js';",
    ranges: [[2695, 2868]],
    transforms: [],
    exports: 'export { renderGenerate, renderGenerationResult };',
  },
  {
    file: 'extract.js',
    imports:
      "import { $, State, saveJSON, STORAGE_KEYS, uuid, escapeHtml, formatBytes, formatDate, truncate, toast } from './core.js';",
    ranges: [[2870, 3158]],
    transforms: [],
    exports: 'export { renderExtract };',
  },
  {
    file: 'posters.js',
    imports:
      "import { State, $, $$, saveJSON, STORAGE_KEYS, uuid, toast, escapeHtml, truncate, formatDate } from './core.js';\n" +
      "import { goTo } from './app.js';",
    ranges: [[3160, 4242], [4677, 4801]],
    transforms: [],
    exports: 'export { createPosterFromGeneration, renderPosters };',
  },
  {
    file: 'downloads.js',
    imports:
      "import { $, State, saveJSON, STORAGE_KEYS, uuid, escapeHtml, truncate, formatDate, toast } from './core.js';",
    ranges: [[4356, 4569]],
    transforms: [],
    exports: 'export { renderDownloads };',
  },
  {
    file: 'history.js',
    imports:
      "import { $, State, saveJSON, STORAGE_KEYS, escapeHtml, truncate, formatDate, toast } from './core.js';\n" +
      "import { createPosterFromGeneration } from './posters.js';",
    ranges: [[4244, 4354]],
    transforms: [],
    exports: 'export { renderHistory };',
  },
  {
    file: 'settings.js',
    imports:
      "import { $, State, saveJSON, STORAGE_KEYS, escapeHtml, toast } from './core.js';\n" +
      "import { PROVIDER_MODELS } from './catalogs.js';",
    ranges: [[4571, 4675]],
    transforms: [],
    exports: 'export { renderSettings };',
  },
  {
    file: 'detector.js',
    imports: "import { $ } from './core.js';",
    ranges: [[2345, 2406], [2413, 2437]],
    transforms: [['f.srcdoc = DETECTOR_FLOP_HTML;', "f.src = 'detector-flop.html';"]],
    exports: 'export { renderDetector };',
  },
  {
    file: 'app.js',
    imports:
      "import { $, $$, State } from './core.js';\n" +
      "import { renderGenerate } from './generate.js';\n" +
      "import { renderExtract } from './extract.js';\n" +
      "import { renderPosters } from './posters.js';\n" +
      "import { renderDownloads } from './downloads.js';\n" +
      "import { renderHistory } from './history.js';\n" +
      "import { renderDetector } from './detector.js';\n" +
      "import { renderSettings } from './settings.js';",
    ranges: [[2276, 2343], [4807, 4810]],
    transforms: [],
    exports: 'export { goTo, renderNav };',
  },
];

for (const m of modules) {
  let body = Rs(m.ranges);
  for (const [from, to] of m.transforms) body = body.split(from).join(to);
  const header = '// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.\n' +
    (m.imports ? m.imports + '\n' : '');
  const out = header + '\n' + body.replace(/\s+$/, '') + '\n\n' + m.exports + '\n';
  fs.writeFileSync(path.join(srcDir, m.file), out);
}

// ---------- 4) novo index.html ----------
const linkTag = '<link rel="stylesheet" href="styles.css" />';
const moduleTag = '<script type="module" src="src/app.js"></script>';
const newIndex = [
  R(1, 27),        // doctype ... SW reg </script> + blank
  linkTag,
  R(1186, 1717),   // </head> ... body ... toast-stack + blank
  moduleTag,
  R(4812, 4814),   // blank, </body>, </html>
].join('\n') + '\n';
fs.writeFileSync(path.join(root, 'index.html'), newIndex);

console.log('OK split. Módulos:', modules.map((m) => m.file).join(', '));
console.log('detector-flop.html bytes:', detectorHtml.length);
