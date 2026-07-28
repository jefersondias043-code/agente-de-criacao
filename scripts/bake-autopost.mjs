// Gera o autopost-ia.html (arquivo ÚNICO, embutido no app pai via iframe) a
// partir da versão modular em autopost-ia/ — a FONTE DA VERDADE. Assim as duas
// versões (standalone e embutida) ficam SEMPRE idênticas: o standalone roda os
// módulos soltos; o embutido é o MESMO app com CSS/JS "assados" num só arquivo
// (self-contained: funciona em file:// e é cacheado como 1 recurso pelo SW pai).
//
// A integração com a plataforma (config, handoff, "Enviar para", ingestão) já
// mora em autopost-ia/js/bridge.js (ativa só quando IS_EMBEDDED) — nada a injetar.
//
// Uso:
//   node scripts/bake-autopost.mjs           gera/atualiza autopost-ia.html
//   node scripts/bake-autopost.mjs --check    só verifica se está em sincronia
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'autopost-ia');
const OUT = path.join(ROOT, 'autopost-ia.html');

const readSrc = (rel) => fs.readFileSync(path.join(SRC_DIR, rel), 'utf8');

// `</script>` dentro de string JS encerraria a tag ao ser inlined — escapa.
const safeJs = (js) => js.replace(/<\/script>/gi, '<\\/script>');
// `</style>` dentro do CSS idem (raro, mas defensivo).
const safeCss = (css) => css.replace(/<\/style>/gi, '<\\/style>');

function bake() {
  let html = readSrc('index.html');

  // 1) CSS externo → <style> inline.
  html = html.replace(
    /<link\s+rel="stylesheet"\s+href="(css\/[^"]+)"\s*\/?>/i,
    (_m, href) => `<style>\n${safeCss(readSrc(href))}\n</style>`
  );

  // 2) Cada <script src="js/..."> → <script> inline (mantém a ordem).
  html = html.replace(
    /<script\s+src="(js\/[^"]+)"\s*><\/script>/gi,
    (_m, src) => `<script>\n${safeJs(readSrc(src))}\n</script>`
  );

  // 3) O design system é COMPARTILHADO: fica como <link> (um recurso só no
  //    cache do SW, em vez de duplicado dentro de cada ferramenta). Só o
  //    caminho muda — o standalone vive em autopost-ia/, o assado na raiz.
  html = html.replace(
    /(<link\s+rel="stylesheet"\s+href=")\.\.\/(design-system\.css"\s*\/?>)/i,
    '$1$2'
  );

  // 4) Manifest é do app standalone (não existe na raiz e não faz sentido no
  //    iframe) — remove pra não dar 404. Ícones resolvem pra raiz e ficam.
  html = html.replace(/<link\s+rel="manifest"[^>]*>\s*/i, '');

  // 5) Carimbo: arquivo GERADO, não editar à mão.
  const banner = '<!-- GERADO por scripts/bake-autopost.mjs a partir de autopost-ia/ — NÃO EDITE À MÃO. -->\n';
  html = html.replace(/^<!DOCTYPE html>/i, '<!DOCTYPE html>\n' + banner.trim());

  // Sanidade: nenhum <script src="js/..."> ou link css/ pode ter sobrado.
  if (/<script\s+src="js\//i.test(html) || /href="css\//i.test(html)) {
    console.error('✗ Sobrou referência externa não-inlined no autopost-ia.html'); process.exit(1);
  }
  return html;
}

const generated = bake();
const check = process.argv.includes('--check');
const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';

if (check) {
  if (generated !== current) {
    console.error('✗ autopost-ia.html está DESATUALIZADO em relação a autopost-ia/. Rode: node scripts/bake-autopost.mjs');
    process.exit(1);
  }
  console.log('✓ autopost-ia.html em sincronia com autopost-ia/.');
} else {
  fs.writeFileSync(OUT, generated);
  console.log(`✓ autopost-ia.html gerado de autopost-ia/ (${(generated.length / 1024).toFixed(0)} KB).`);
}
