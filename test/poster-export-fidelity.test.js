// O cartaz salvo tem que ser igual ao preview. Quem desenha o PNG é o
// html2canvas 1.4.1, que NÃO pinta uma parte do CSS: o preview fica bonito e o
// arquivo final sai diferente — o usuário só descobre depois de exportar.
//
// Este teste tranca a regra que antes era folclore espalhado em comentários:
// modelo nenhum pode usar propriedade que não sobreviva à exportação.
// (Auditado com o próprio html2canvas 1.4.1: box-shadow vira mancha cinza
// sólida, filter/blend/clip-path em bloco sólido são ignorados.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const fonte = readFileSync(join(raiz, 'src/poster-templates.js'), 'utf8');

// Só o CSS que os modelos emitem: comentários explicam a regra e não valem.
const semComentarios = fonte
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const PROIBIDAS = [
  ['box-shadow', /box-shadow\s*:/g, 'não é pintada — vira retângulo cinza sólido no PNG'],
  ['text-shadow', /text-shadow\s*:/g, 'vira laje cinza atrás do texto em vez de halo suave'],
  ['filter', /[^-\w]filter\s*:/g, 'ignorada na exportação'],
  ['backdrop-filter', /backdrop-filter\s*:/g, 'ignorada na exportação'],
  ['mix-blend-mode', /mix-blend-mode\s*:/g, 'ignorada na exportação'],
  ['background-blend-mode', /background-blend-mode\s*:/g, 'ignorada na exportação'],
  ['background-clip:text', /background-clip\s*:\s*text/g, 'ignorada na exportação'],
  ['conic-gradient', /conic-gradient\s*\(/g, 'não suportada pelo html2canvas 1.4.1'],
];

describe('fidelidade preview ≡ exportação', () => {
  PROIBIDAS.forEach(([nome, re, porque]) => {
    it(`nenhum modelo usa ${nome} (${porque})`, () => {
      const achados = [...semComentarios.matchAll(re)].map((m) => {
        const linha = semComentarios.slice(0, m.index).split('\n').length;
        return `linha ~${linha}`;
      });
      expect(achados).toEqual([]);
    });
  });

  // clip-path é permitido SÓ com o par data-clip, que o achatamento do export
  // reproduz no canvas. Sozinho, o recorte existe no preview e some no PNG.
  it('todo clip-path vem acompanhado de data-clip (que o export reproduz)', () => {
    const semPar = [];
    semComentarios.split('\n').forEach((linha, i) => {
      if (!/clip-path\s*:/.test(linha)) return;
      if (!/data-clip=/.test(linha)) semPar.push(`linha ${i + 1}: ${linha.trim().slice(0, 90)}`);
    });
    expect(semPar).toEqual([]);
  });
});

describe('elementos do cartaz montados fora do catálogo', () => {
  // O avatar é desenhado em posters.js, não nos modelos — a mesma regra vale:
  // ele aparece em cima da foto e a sombra saía como mancha cinza no PNG.
  it('o avatar não usa sombra', () => {
    const posters = readFileSync(join(raiz, 'src/posters.js'), 'utf8');
    const bloco = posters.match(/const avatarOverlayHtml =[\s\S]*?\n\n/);
    expect(bloco).toBeTruthy();
    expect(bloco[0]).not.toMatch(/box-shadow|text-shadow/);
  });
});

describe('achatamento do recorte diagonal no export', () => {
  // Regressão: o callback do forEach se chamava `s` e sombreava a escala da
  // exportação, então `W * s` virava `W * "0 0"` = NaN. O polígono degenerava,
  // ctx.clip() descartava tudo e a FOTO SUMIA do PNG (o preview ficava certo).
  it('a escala não é sombreada ao montar o polígono de recorte', () => {
    const posters = readFileSync(join(raiz, 'src/posters.js'), 'utf8');
    const bloco = posters.match(/clipPts\.split\(','\)\.forEach\(\(([^,)]+)/);
    expect(bloco).toBeTruthy();
    expect(bloco[1].trim()).not.toBe('s');
  });

  it('o polígono produz coordenadas finitas', () => {
    // Reproduz a conta do export com a mesma forma do modelo "Corte diagonal".
    const s = 2, W = 1080, H = 1440;
    const pts = '0 0, 100 0, 100 50, 0 72';
    const coords = pts.split(',').map((pt) => {
      const xy = pt.trim().split(/\s+/).map(Number);
      return [(xy[0] / 100) * W * s, (xy[1] / 100) * H * s];
    });
    expect(coords.flat().every(Number.isFinite)).toBe(true);
    expect(coords[2]).toEqual([2160, 1440]);
  });
});
