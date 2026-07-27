// Camadas de imagem do cartaz (recorte do Removedor vira objeto independente).
// Trava o contrato do MODELO (x/y/scale/rotation/z persistidos) e da geometria
// do nó renderizado — mover, redimensionar, GIRAR e empilhar sem perder a
// transparência do PNG. As interações por ponteiro (arrastar/pinça/alças) são
// exercitadas em navegador; aqui garantimos o que é verificável em jsdom.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let L;
beforeEach(() => {
  clearStorage();
  document.body.innerHTML = '<div id="toast-stack"></div>';
  L = loadModules(['catalogs.js', 'core.js', 'posters.js', 'poster-elements.js'], [
    'addImageAsLayer', 'buildLayerOverlay', 'renderLayerList', '_commitLayer',
    '_overlayRotateHandle', '_overlayResizeHandle', 'collectOverlays',
    'ensureOverlayZ', 'nextOverlayZ', 'LAYER_BASE_W', 'State',
  ]);
  L.State.posters = [{ id: 'p1', elements: [], layers: [] }];
  L.State.activePosterId = 'p1';
  globalThis.goTo = () => {};       // navegação mora em app.js (fora deste recorte)
});

const layers = () => L.State.posters[0].layers;
const FMT = { w: 1080, h: 1440 };

describe('addImageAsLayer', () => {
  it('nasce centralizada, em escala 1 e sem rotação', () => {
    L.addImageAsLayer(PNG);
    expect(layers().length).toBe(1);
    expect(layers()[0]).toMatchObject({ x: 50, y: 50, scale: 1, rotation: 0 });
    expect(layers()[0].src).toBe(PNG);          // data URL intacto = transparência preservada
  });

  it('ignora entradas que não são imagem', () => {
    L.addImageAsLayer('javascript:alert(1)');
    L.addImageAsLayer('');
    expect(layers().length).toBe(0);
  });

  it('empilha cada recorte acima do anterior', () => {
    L.addImageAsLayer(PNG);
    L.addImageAsLayer(PNG);
    expect(layers()[1].z).toBeGreaterThan(layers()[0].z);
  });
});

describe('_commitLayer', () => {
  it('grava rotação e escala na camada certa', () => {
    L.addImageAsLayer(PNG);
    L.addImageAsLayer(PNG);
    const id = layers()[1].id;
    L._commitLayer(id, { rotation: 35, scale: 1.4 });
    expect(layers()[1]).toMatchObject({ rotation: 35, scale: 1.4 });
    expect(layers()[0].rotation).toBe(0);       // não vaza para a vizinha
  });
});

describe('buildLayerOverlay — geometria do nó', () => {
  const build = (patch) => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const layer = Object.assign({ id: 'L1', src: PNG, x: 50, y: 50, scale: 1, rotation: 0, z: 1 }, patch);
    return L.buildLayerOverlay(L.State.posters[0], layer, root, FMT, 10);
  };

  it('ancora pelo CENTRO e aplica a rotação na mesma transform', () => {
    const box = build({ x: 30, y: 70, rotation: 45 });
    expect(box.style.left).toBe('30%');
    expect(box.style.top).toBe('70%');
    // translate(-50%,-50%) + rotate() juntos: o transform-origin padrão (centro
    // da própria caixa) vale para a matriz composta → gira SEM sair do lugar.
    expect(box.style.transform.replace(/\s+/g, '')).toContain('translate(-50%,-50%)');
    expect(box.style.transform).toContain('rotate(45deg)');
  });

  it('escala vira largura em px sobre a base da camada', () => {
    expect(build({ scale: 1 }).style.width).toBe(L.LAYER_BASE_W + 'px');
    expect(build({ scale: 1.5 }).style.width).toBe(Math.round(L.LAYER_BASE_W * 1.5) + 'px');
  });

  it('camada legada (sem rotation) renderiza em 0° em vez de NaN', () => {
    const box = build({ rotation: undefined });
    expect(box.style.transform).toContain('rotate(0deg)');
  });

  it('carrega o PNG original sem reprocessar (transparência intacta)', () => {
    const img = build({}).querySelector('img');
    expect(img.getAttribute('src')).toBe(PNG);
  });

  it('traz as alças de girar e redimensionar, e o botão de excluir', () => {
    const box = build({});
    expect(box.querySelector('.pe-rotate-handle')).toBeTruthy();
    expect(box.querySelector('.pe-layer-handle')).toBeTruthy();
    expect(box.querySelector('.pe-del-badge')).toBeTruthy();
  });
});

describe('chrome das camadas', () => {
  // O `display` das alças é decidido pelo CSS (.pe-ov-chrome some; .pe-ov-sel
  // mostra; .exporting esconde de novo). Se a alça trouxesse `display` INLINE,
  // ela venceria o CSS e apareceria sempre — inclusive no PNG exportado.
  it('nenhuma alça define display inline', () => {
    expect(L._overlayRotateHandle().style.display).toBe('');
    expect(L._overlayResizeHandle().style.display).toBe('');
  });

  it('as alças entram na classe que o CSS usa para escondê-las', () => {
    expect(L._overlayRotateHandle().classList.contains('pe-ov-chrome')).toBe(true);
    expect(L._overlayResizeHandle().classList.contains('pe-ov-chrome')).toBe(true);
  });
});

describe('hierarquia unificada', () => {
  it('camadas e elementos dividem a MESMA ordem de empilhamento', () => {
    const s = L.State.posters[0];
    s.elements.push({ id: 'e1', type: 'rect', z: 1 });
    s.layers.push({ id: 'l1', src: PNG, x: 50, y: 50, scale: 1, rotation: 0, z: 2 });
    s.elements.push({ id: 'e2', type: 'rect', z: 3 });
    expect(L.collectOverlays(s).map((o) => o.id)).toEqual(['e1', 'l1', 'e2']);
  });
});
