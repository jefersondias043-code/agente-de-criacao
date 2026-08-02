#!/usr/bin/env node
/**
 * AUDITORIA DE ÁREA SEGURA — mede, com layout REAL, se algum texto de algum
 * modelo cai sob as faixas que Instagram/TikTok desenham por cima do cartaz.
 *
 * Por que existe: a promessa "nenhuma informação importante fica encoberta" é
 * geométrica, e geometria não se confere lendo código nem em jsdom (que não
 * tem layout). Só medindo o retângulo de cada nó de texto num navegador de
 * verdade. Foi assim que se descobriu que 60 dos 66 modelos vazavam — quase
 * sempre o rodapé, que encosta na base bem onde a legenda do Reels começa.
 *
 * Uso:
 *   node scripts/static-server.mjs &        # serve em :8080
 *   node scripts/audit-area-segura.mjs      # audita as 3 plataformas
 *   node scripts/audit-area-segura.mjs reels
 *
 * Sai com código 1 se achar vazamento — serve como portão em CI.
 *
 * Requer Playwright + Chromium. Sem eles, avisa e sai com 0 (não é parte do
 * `npm run verify`, que precisa rodar em qualquer máquina).
 */
const PORTA = process.env.PORT || 8080;
const ZONAS = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const TOLERANCIA = 3;   // px do cartaz; abaixo disso é arredondamento de layout

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('⚠ Playwright não instalado — auditoria de área segura pulada.');
  console.log('  (npm i -D playwright && npx playwright install chromium)');
  process.exit(0);
}

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1200, height: 900 } });
const errosPagina = [];
pagina.on('pageerror', (e) => errosPagina.push(e.message));
pagina.on('dialog', (d) => d.accept());

try {
  await pagina.goto(`http://127.0.0.1:${PORTA}/index.html`, { waitUntil: 'domcontentloaded' });
} catch {
  console.error(`✗ Nada respondendo em :${PORTA}. Suba com "node scripts/static-server.mjs".`);
  await navegador.close();
  process.exit(1);
}

await pagina.waitForFunction(() => typeof window.renderPosterTemplate === 'function');
await pagina.click('.nav-item[data-view="posters"]');
await pagina.waitForTimeout(300);
await pagina.click('#pg-new');
await pagina.waitForTimeout(500);

const achados = await pagina.evaluate(async ({ zonasArg, tol }) => {
  const zonas = zonasArg.length ? zonasArg
    : Object.keys(POSTER_SAFE_ZONES).filter((z) => z !== 'livre' && z !== 'feed');
  const alvo = State.posters.find((x) => x.id === State.activePosterId);
  const base = {
    format: '9:16',
    headline: 'Prefeitura entrega novas obras na capital baiana',
    category: 'CIDADES', location: 'Salvador, BA',
    subtitle: 'Investimento beneficia milhares de famílias na região metropolitana',
    description: 'Primeiro item.\nSegundo item.\nTerceiro item.',
    figure: '47%', labelA: 'Antes', labelB: 'Depois',
    personName: 'Maria Silva', personRole: 'Prefeita',
  };
  const out = [];
  for (const zona of zonas) {
    for (const [id] of Object.entries(POSTER_TEMPLATES)) {
      Object.assign(alvo, base, { template: id, safeZone: zona });
      renderPosterTemplate(alvo);
      await new Promise((r) => requestAnimationFrame(r));
      const raiz = document.querySelector('#p-stage .poster-1440');
      if (!raiz) { out.push({ zona, id, erro: 'sem nó raiz' }); continue; }
      const fmt = POSTER_FORMATS['9:16'];
      const rb = raiz.getBoundingClientRect();
      const k = rb.width / fmt.w;
      const r = ptSafeRect(alvo, fmt);
      // Só INFORMAÇÃO: decoração translúcida e marca-d'água podem sangrar — é
      // a função delas, e é o fundo que aparece atrás dos botões do app.
      const folhas = [...raiz.querySelectorAll('*')].filter((el) =>
        el.children.length === 0 && (el.textContent || '').trim() && !_safeEhDecoracao(el));
      let pior = 0; let qual = null;
      for (const el of folhas) {
        const bb = el.getBoundingClientRect();
        if (!bb.width || !bb.height) continue;
        const v = {
          topo: Math.round(r.top - (bb.top - rb.top) / k),
          base: Math.round((bb.bottom - rb.top) / k - (fmt.h - r.bottom)),
          dir: Math.round((bb.right - rb.left) / k - (fmt.w - r.right)),
          esq: Math.round(r.left - (bb.left - rb.left) / k),
        };
        const m = Math.max(v.topo, v.base, v.dir, v.esq);
        if (m > tol && m > pior) { pior = m; qual = { txt: (el.textContent || '').trim().slice(0, 24), v }; }
      }
      out.push({ zona, id, nos: folhas.length, pior, qual });
    }
  }
  return out;
}, { zonasArg: ZONAS, tol: TOLERANCIA });

await navegador.close();

const vazam = achados.filter((a) => a.pior > TOLERANCIA || a.erro);
const nos = achados.reduce((a, x) => a + (x.nos || 0), 0);
console.log(`Combinações auditadas (modelo × plataforma): ${achados.length}`);
console.log(`Nós de informação medidos: ${nos}`);
if (errosPagina.length) console.log(`Erros de página: ${errosPagina.slice(0, 3).join(' | ')}`);

if (!vazam.length) {
  console.log('✓ Nenhum texto de informação cai sob as faixas do aplicativo.');
  process.exit(0);
}
console.error(`✗ ${vazam.length} combinação(ões) com texto encoberto:`);
vazam.sort((a, b) => (b.pior || 0) - (a.pior || 0)).forEach((a) => {
  console.error(`  ${String(a.pior || '—').padStart(4)}px  ${a.zona.padEnd(10)} ${a.id.padEnd(22)} ${a.qual ? JSON.stringify(a.qual) : a.erro}`);
});
process.exit(1);
