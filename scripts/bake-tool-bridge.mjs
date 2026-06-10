// "Assa" (baked) o tema claro + a ponte de configuração DENTRO dos HTMLs das
// ferramentas, para funcionar em file:// (onde o app pai NÃO pode injetar de fora).
// Extrai o tema dos módulos JS (fonte única) e injeta antes de </head>.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, c) => fs.writeFileSync(path.join(root, p), c);

function extractTheme(js, name) {
  const m = js.match(new RegExp('const ' + name + ' = `([\\s\\S]*?)`;'));
  return m ? m[1] : '';
}

const detectorTheme = extractTheme(read('src/detector.js'), 'DETECTOR_LIGHT_THEME');
const autopostTheme = extractTheme(read('src/autopost.js'), 'AUTOPOST_LIGHT_THEME');
if (!detectorTheme || !autopostTheme) { console.error('Falha ao extrair tema dos JS'); process.exit(1); }

const bridge = [
  '<script>',
  '/* Ponte de configuração com o app principal (Agente) — funciona em file:// e em servidor.',
  '   Recebe chave+modelo via postMessage e guarda em window.__AGENTE_CONFIG__ + localStorage. */',
  '(function(){',
  '  function applyCfg(c){',
  '    if(!c) return;',
  '    window.__AGENTE_CONFIG__ = { groqKey: c.groqKey||"", groqModel: c.groqModel||"" };',
  '    try {',
  '      if(c.groqKey){ localStorage.setItem("groq_api_key", c.groqKey); localStorage.setItem("df_groq_key", c.groqKey); }',
  '      if(c.groqModel){ localStorage.setItem("groq_model", c.groqModel); localStorage.setItem("df_model", c.groqModel); }',
  '    } catch(_){}',
  '  }',
  '  window.addEventListener("message", function(e){ if(e && e.data && e.data.type==="agente:config") applyCfg(e.data); });',
  '  try { if(window.parent && window.parent!==window) window.parent.postMessage({type:"agente:config-request"}, "*"); } catch(_){}',
  '})();',
  '<\/script>',
].join('\n');

function bake(file, theme) {
  let html = read(file);
  if (html.includes('id="agente-light-theme"')) { console.log('já bakeado:', file); return; }
  const block = '<style id="agente-light-theme">\n' + theme + '\n</style>\n' + bridge + '\n</head>';
  if (!html.includes('</head>')) { console.error('sem </head>:', file); return; }
  html = html.replace('</head>', block);
  write(file, html);
  console.log('bakeado:', file, '· tema', theme.length, 'chars');
}

bake('autopost-ia.html', autopostTheme);
bake('detector-flop.html', detectorTheme);
