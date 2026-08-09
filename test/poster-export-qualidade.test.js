// QUALIDADE DA EXPORTAÇÃO — o arquivo salvo tem que ter a definição do preview.
//
// Relato de uso real: mesmo na resolução mais alta o PNG saía com texto menos
// nítido, contorno "suavizado demais" e cara de imagem comprimida.
//
// Medindo o pipeline num Chromium real, a perda não estava na exportação em si
// — estava ANTES dela, em três lugares que rasterizavam num tamanho e depois
// eram AMPLIADOS para o tamanho do arquivo:
//
//   1. a FOTO do usuário, reduzida a 1200px e reencodada em JPEG 0.85 já na
//      importação (regra herdada de quando as imagens iam para o localStorage —
//      hoje vão para o IndexedDB como Blob). Sozinha, custava 16,7 dB de PSNR e
//      derrubava a energia de contorno de 1705 para 633 num slot 9:16 em 2×;
//   2. o PADRÃO de fundo, traçado no tamanho do cartaz (1080) e esticado no 2×;
//   3. o SÍMBOLO da marca, num bitmap de 220px para até ~400px de uso.
//
// Mais dois pontos depois dela: o JPG saía em 0.92, e as reduções de imagem
// rodavam com a suavização padrão do Chrome ('low'), que serrilha contorno.
//
// Estes testes trancam cada um desses pontos. O que eles NÃO cobrem é a
// travessia pelo html2canvas: a biblioteca vem de CDN, indisponível no
// ambiente de teste. Por isso as checagens abaixo são de código-fonte e de
// funções puras, e a verificação do desenho em si foi feita em navegador.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const fonte = (f) => readFileSync(join(raiz, 'src', f), 'utf8');

let P;
beforeAll(() => {
  clearStorage();
  P = loadModules(['catalogs.js', 'core.js', 'posters.js', 'poster-templates.js'], [
    'POSTER_FORMATS', 'POSTER_EXPORT_SCALES', 'POSTER_EXPORT_SCALE_DEFAULT',
    'POSTER_JPG_QUALITY', 'posterMaiorLadoExportavel', 'ptEscalaMaximaExport', 'posterExportLabel',
    'fileToBase64Compressed',
  ]);
});

describe('as resoluções oferecidas', () => {
  it('continuam sendo duas — o usuário pediu para manter a escolha', () => {
    expect(P.POSTER_EXPORT_SCALES).toHaveLength(2);
    expect(P.POSTER_EXPORT_SCALES.map((e) => e.v)).toEqual([1, 2]);
    P.POSTER_EXPORT_SCALES.forEach((e) => expect(e.hint).toBeTruthy());
  });

  it('o rótulo diz a largura REAL do formato escolhido', () => {
    // Era fixo ("1080px"/"2160px"). Com o 16:9 (1920 de largura) isso passaria a
    // mentir — a tela prometeria 1080 e o arquivo sairia com 1920.
    const retrato = P.POSTER_FORMATS['4:5'], deitado = P.POSTER_FORMATS['16:9'];
    expect(P.posterExportLabel(1, retrato)).toBe('1080px');
    expect(P.posterExportLabel(2, retrato)).toBe('2160px');
    expect(P.posterExportLabel(1, deitado)).toBe('1920px');
    expect(P.posterExportLabel(2, deitado)).toBe('3840px');
  });

  it('cada opção continua dizendo quantos pixels entrega', () => {
    Object.values(P.POSTER_FORMATS).forEach((f) => {
      P.POSTER_EXPORT_SCALES.forEach((e) => {
        expect(P.posterExportLabel(e.v, f)).toMatch(/^\d+px$/);
      });
    });
  });

  it('o padrão é a MAIOR — qualidade primeiro', () => {
    const maior = Math.max(...P.POSTER_EXPORT_SCALES.map((e) => e.v));
    expect(P.POSTER_EXPORT_SCALE_DEFAULT).toBe(maior);
    expect(P.ptEscalaMaximaExport()).toBe(maior);
  });

  it('a tela de exportação monta as opções a partir dessa lista', () => {
    // Rótulo fixo no HTML voltaria a divergir da lista na primeira mudança.
    const js = fonte('posters.js');
    expect(js).toMatch(/POSTER_EXPORT_SCALES\.map/);
    expect(js).not.toMatch(/data-v="1" class="sel">1080px/);
  });
});

describe('o teto de entrada das fotos', () => {
  it('é exatamente a maior exportação possível — nem mais, nem menos', () => {
    const maiorLado = Math.max(...Object.values(P.POSTER_FORMATS).flatMap((f) => [f.w, f.h]));
    const maiorEscala = Math.max(...P.POSTER_EXPORT_SCALES.map((e) => e.v));
    expect(P.posterMaiorLadoExportavel()).toBe(maiorLado * maiorEscala);
  });

  it('acompanha o catálogo em vez de ser um número fixo', () => {
    // 3840 hoje (1920 × 2). Se entrar um formato maior, o teto sobe sozinho.
    expect(P.posterMaiorLadoExportavel()).toBe(3840);
    expect(fonte('posters.js')).not.toMatch(/maxDimension\s*=\s*1200/);
  });

  it('guardar menos que o teto obrigaria a AMPLIAR — é o defeito relatado', () => {
    const noveDezesseis = P.POSTER_FORMATS['9:16'];
    expect(P.posterMaiorLadoExportavel()).toBeGreaterThanOrEqual(noveDezesseis.h * 2);
  });
});

describe('a importação não degrada mais a foto', () => {
  it('a assinatura antiga (1200px, JPEG 0.85) não existe mais', () => {
    const js = fonte('posters.js');
    expect(js).not.toMatch(/function fileToBase64Compressed\([^)]*1200/);
    expect(js).not.toMatch(/quality\s*=\s*0\.85/);
  });

  it('imagem dentro do teto passa direto, sem reencodar', () => {
    // A passagem direta é o que garante perda ZERO; sem ela toda foto pagaria
    // um JPEG a mais só por ter sido importada.
    const js = fonte('posters.js');
    expect(js).toMatch(/if \(Math\.max\(iw, ih\) <= teto\)/);
    expect(js).toMatch(/resolve\(bruto\)/);
  });

  it('a logo do portal também deixou de ser presa a 400px', () => {
    const js = fonte('posters.js');
    expect(js).not.toMatch(/fileToBase64Compressed\(file, 400/);
    const m = /fileToBase64Compressed\(file, (\d+)/.exec(js);
    expect(m, 'a logo passa um teto próprio').toBeTruthy();
    expect(Number(m[1])).toBeGreaterThanOrEqual(1200);
  });

  it('continua sendo uma promessa de dataURL', async () => {
    expect(typeof P.fileToBase64Compressed).toBe('function');
    expect(P.fileToBase64Compressed.length).toBeLessThanOrEqual(3);
  });
});

describe('nenhuma redução roda com a suavização padrão do Chrome', () => {
  // 'low' é o padrão e serrilha contorno fino ao reduzir — é metade da
  // "suavização excessiva" que aparecia só no arquivo salvo.
  const sitios = [
    ['posters.js', 4],   // entrada de foto, achatamento da foto, da logo e o composto do vazado
  ];
  sitios.forEach(([arq, minimo]) => {
    it(`${arq} pede qualidade alta em toda redução (≥ ${minimo})`, () => {
      const n = (fonte(arq).match(/imageSmoothingQuality\s*=\s*'high'/g) || []).length;
      expect(n).toBeGreaterThanOrEqual(minimo);
    });
  });

  it('cada canvas que ativa a suavização também a liga explicitamente', () => {
    const js = fonte('posters.js');
    const alta = (js.match(/imageSmoothingQuality\s*=\s*'high'/g) || []).length;
    const ligado = (js.match(/imageSmoothingEnabled\s*=\s*true/g) || []).length;
    expect(ligado).toBe(alta);
  });
});

describe('o que é desenhado por nós sai denso o bastante para o 2×', () => {
  it('o padrão de fundo é superamostrado, mantendo as coordenadas do cartaz', () => {
    const js = fonte('poster-templates.js');
    // canvas maior…
    expect(js).toMatch(/cv\.width = w \* F; cv\.height = hh \* F/);
    // …mas o desenho continua em unidades do cartaz, senão o padrão mudaria de
    // escala (ponto e listra virariam o dobro do tamanho) em vez de ganhar
    // definição.
    expect(js).toMatch(/ctx\.scale\(F, F\)/);
    expect(js).toMatch(/const F = ptEscalaMaximaExport\(\)/);
  });

  it('a densidade entra na chave do cache do padrão', () => {
    // Sem isso, mudar a resolução máxima devolveria o bitmap antigo.
    expect(fonte('poster-templates.js')).toMatch(/const key = \[[^\]]*ptEscalaMaximaExport\(\)\]/);
  });

  it('o símbolo da marca não é mais um bitmap de 220px', () => {
    const js = fonte('poster-templates.js');
    expect(js).not.toMatch(/const N = 220/);
    const m = /const N = (\d+), c = document\.createElement\('canvas'\)/.exec(js);
    expect(m).toBeTruthy();
    // Usado com até ~200px de CSS; o 2× pede ~400.
    expect(Number(m[1])).toBeGreaterThanOrEqual(512);
  });
});

describe('a compressão do arquivo final é a menor possível', () => {
  it('o PNG segue sem perda — nenhuma qualidade é passada para ele', () => {
    expect(fonte('posters.js')).toMatch(/jpg \? POSTER_JPG_QUALITY : undefined/);
  });

  it('o JPG subiu de 0.92 para o topo prático da escala', () => {
    expect(P.POSTER_JPG_QUALITY).toBeGreaterThanOrEqual(0.95);
    expect(P.POSTER_JPG_QUALITY).toBeLessThanOrEqual(1);
    ['posters.js', 'carousels.js'].forEach((f) => {
      expect(fonte(f), `${f} ainda tem 0.92 cravado`).not.toMatch(/jpg \? 0\.92/);
    });
  });

  it('cartaz e carrossel usam a MESMA qualidade', () => {
    // Eram dois 0.92 soltos; um só ficaria para trás na próxima mudança.
    expect(fonte('carousels.js')).toMatch(/POSTER_JPG_QUALITY/);
  });
});
