// saveImagesToDevice / canvasToBlob — exportação de imagens que funciona no
// iPhone. O bug corrigido: no iOS o <a download> é ignorado e nada chega à
// galeria de Fotos. O caminho certo é a Web Share API com arquivos.
// Usa injeção de dependências (deps) para não depender das APIs do jsdom
// (navigator.share/canShare e URL.createObjectURL não existem lá).
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules } from './helpers/load.mjs';

let C;
beforeEach(() => {
  C = loadModules(['catalogs.js', 'core.js'], ['saveImagesToDevice', 'canvasToBlob']);
});

function fakeBlob(type = 'image/png') { return { type, size: 4 }; }
function FakeFile(parts, name, opts) { this.parts = parts; this.name = name; this.type = opts && opts.type; }

function makeDownloadDeps() {
  const created = [];
  const urls = [];
  const doc = {
    body: { appendChild() {} },
    createElement(tag) {
      const el = { tag, href: '', download: '', clicked: false, click() { this.clicked = true; }, remove() {} };
      created.push(el);
      return el;
    },
  };
  const urlApi = {
    createObjectURL(b) { urls.push(b); return 'blob:' + (urls.length - 1); },
    revoked: [],
    revokeObjectURL(u) { this.revoked.push(u); },
  };
  return { doc, urlApi, created, urls, File: FakeFile };
}

describe('saveImagesToDevice', () => {
  it('usa Web Share com ARQUIVOS quando o navegador suporta (caminho iPhone)', async () => {
    let shareArg = null;
    const nav = {
      canShare: (a) => Array.isArray(a && a.files),
      share: async (a) => { shareArg = a; },
    };
    const dl = makeDownloadDeps();
    const how = await C.saveImagesToDevice(
      [{ name: 'a.png', blob: fakeBlob() }, { name: 'b.png', blob: fakeBlob() }],
      'Carrossel',
      { nav, doc: dl.doc, urlApi: dl.urlApi, File: FakeFile },
    );
    expect(how).toBe('shared');
    expect(shareArg.files).toHaveLength(2);
    expect(shareArg.files[0]).toBeInstanceOf(FakeFile);
    expect(shareArg.title).toBe('Carrossel');
    // NÃO deve baixar duplicado quando compartilhou
    expect(dl.created).toHaveLength(0);
  });

  it('cai no download quando o navegador NÃO sabe compartilhar arquivos (desktop)', async () => {
    const nav = { canShare: () => false, share: async () => {} };
    const dl = makeDownloadDeps();
    const how = await C.saveImagesToDevice(
      [{ name: 'cartaz.png', blob: fakeBlob() }],
      'Cartaz',
      { nav, doc: dl.doc, urlApi: dl.urlApi, File: FakeFile },
    );
    expect(how).toBe('downloaded');
    expect(dl.created).toHaveLength(1);
    expect(dl.created[0].download).toBe('cartaz.png');
    expect(dl.created[0].clicked).toBe(true);
    expect(dl.urls).toHaveLength(1);
  });

  it('sem navigator (ambiente sem share) também baixa', async () => {
    const dl = makeDownloadDeps();
    const how = await C.saveImagesToDevice(
      [{ name: 'x.png', blob: fakeBlob() }],
      null,
      { nav: null, doc: dl.doc, urlApi: dl.urlApi, File: FakeFile },
    );
    expect(how).toBe('downloaded');
    expect(dl.created[0].clicked).toBe(true);
  });

  it('quando o usuário FECHA a folha de compartilhamento (AbortError) não baixa duplicado', async () => {
    const nav = {
      canShare: () => true,
      share: async () => { const e = new Error('cancelado'); e.name = 'AbortError'; throw e; },
    };
    const dl = makeDownloadDeps();
    const how = await C.saveImagesToDevice(
      [{ name: 'a.png', blob: fakeBlob() }],
      'Cartaz',
      { nav, doc: dl.doc, urlApi: dl.urlApi, File: FakeFile },
    );
    expect(how).toBe('canceled');
    expect(dl.created).toHaveLength(0);
  });

  it('se o share falhar por OUTRO motivo (ex.: gesto perdido), cai no download', async () => {
    const nav = {
      canShare: () => true,
      share: async () => { const e = new Error('NotAllowed'); e.name = 'NotAllowedError'; throw e; },
    };
    const dl = makeDownloadDeps();
    const how = await C.saveImagesToDevice(
      [{ name: 'a.png', blob: fakeBlob() }],
      'Cartaz',
      { nav, doc: dl.doc, urlApi: dl.urlApi, File: FakeFile },
    );
    expect(how).toBe('downloaded');
    expect(dl.created[0].clicked).toBe(true);
  });

  it('lista vazia é erro (nada para salvar)', async () => {
    await expect(C.saveImagesToDevice([], 'x', {})).rejects.toThrow(/nada para salvar/);
  });
});

describe('canvasToBlob', () => {
  it('resolve com o Blob produzido pelo canvas', async () => {
    const blob = fakeBlob();
    const canvas = { toBlob(cb, type) { this._type = type; cb(blob); } };
    const out = await C.canvasToBlob(canvas, 'image/png');
    expect(out).toBe(blob);
    expect(canvas._type).toBe('image/png');
  });

  it('rejeita quando toBlob devolve null', async () => {
    const canvas = { toBlob(cb) { cb(null); } };
    await expect(C.canvasToBlob(canvas)).rejects.toThrow(/toBlob/);
  });

  it('rejeita canvas inválido', async () => {
    await expect(C.canvasToBlob(null)).rejects.toThrow(/canvas inválido/);
  });
});
