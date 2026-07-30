// CORTE DE ACENTO/DESCENDENTE em título de cartaz.
//
// O defeito, medido com Chromium real (fonte de verdade, screenshot + varredura
// de pixel — ver PR): título em CAIXA ALTA (font-family:${PT.cond}) tinha
// line-height tão apertado (0.86–1.13) que o acento (Á Ã Ç É Í Ó...) ultrapassa
// o topo da própria caixa — e overflow:hidden + -webkit-line-clamp cortam
// exatamente essa sobra. Título em caixa NORMAL (font-family:${PT.serif}, tem
// g/j/p/q/y) sofre o inverso: o RISCO é a base (descendente), não o topo.
//
// A fonte que a maioria dos usuários vê por padrão é Poppins — PT.cond e
// PT.serif só viram Oswald/Fraunces se o usuário trocar a "voz tipográfica"
// nas configurações avançadas (ver POSTER_FONTS). A medição cobriu as duas.
//
// Duas técnicas, DIFERENTES por medição (não por gosto):
//  - topo: padding-top é seguro num elemento com -webkit-line-clamp — cria
//    espaço em branco de verdade, sem mexer no ponto de truncamento (não
//    existe "linha -1" acima da 1ª pra vazar).
//  - base: padding-bottom foi TESTADO E REJEITADO — num elemento clampado ele
//    não cria espaço em branco, ele empurra o limite de corte pra baixo e
//    deixa vazar um pedaço da linha SEGUINTE (a que devia ter sido truncada).
//    Por isso a base se resolve aumentando o próprio line-height (piso 1.22,
//    com folga sobre o mínimo medido de ~1.2 nas duas fontes).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const fonte = readFileSync(join(raiz, 'src/poster-templates.js'), 'utf8');

/** Cada style="..." que tem -webkit-line-clamp — todo o texto sujeito a corte. */
function clampStyles(src) {
  const re = /style="([^"]*-webkit-line-clamp:[^"]*)"/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    const linha = src.slice(0, m.index).split('\n').length;
    out.push({ style: m[1], linha });
  }
  return out;
}

describe('título em caixa alta (Oswald/Poppins) não corta o acento no topo', () => {
  const alvos = clampStyles(fonte).filter(
    ({ style }) => /font-family:\$\{PT\.cond\}/.test(style) && /text-transform:uppercase/.test(style)
  );

  it('a varredura encontrou o grupo de risco (não ficou vazia por engano)', () => {
    expect(alvos.length).toBeGreaterThan(20);
  });

  it('todo título caixa-alta clampado tem padding-top — sem exceção', () => {
    const semPad = alvos.filter(({ style }) => !/padding-top/.test(style));
    const linhas = semPad.map((a) => `linha ~${a.linha}`);
    expect(linhas, `sem padding-top:\n${linhas.join('\n')}`).toEqual([]);
  });
});

describe('título em caixa normal (Fraunces/Poppins, tem descendente) não corta a base', () => {
  const alvos = clampStyles(fonte).filter(
    ({ style }) =>
      /font-family:\$\{PT\.serif\}/.test(style) &&
      !/font-style:italic/.test(style) &&
      !/text-transform:uppercase/.test(style)
  );

  it('a varredura encontrou o grupo de risco (não ficou vazia por engano)', () => {
    expect(alvos.length).toBeGreaterThan(10);
  });

  it('nenhum título caixa-normal fica abaixo do piso seguro (line-height 1.22)', () => {
    const baixos = alvos
      .map((a) => ({ ...a, lh: parseFloat((a.style.match(/line-height:([\d.]+)/) || [])[1]) }))
      .filter((a) => isFinite(a.lh) && a.lh < 1.22);
    const linhas = baixos.map((a) => `linha ~${a.linha} (line-height:${a.lh})`);
    expect(linhas, `abaixo do piso:\n${linhas.join('\n')}`).toEqual([]);
  });
});

describe('subtítulo/citação em itálico (Fraunces/Poppins sintetizado) não corta a base', () => {
  // O Poppins itálico NÃO é carregado (só o peso normal) — o navegador
  // SINTETIZA o itálico (oblíquo), e a síntese precisou de mais respiro que o
  // itálico de verdade da Fraunces (piso medido ~1.2, não ~1.13).
  const alvos = clampStyles(fonte).filter(
    ({ style }) => /font-family:\$\{PT\.serif\}/.test(style) && /font-style:italic/.test(style)
  );

  it('a varredura encontrou o grupo de risco (não ficou vazia por engano)', () => {
    expect(alvos.length).toBeGreaterThan(10);
  });

  it('nenhum subtítulo/citação em itálico fica abaixo do piso seguro (line-height 1.22)', () => {
    const baixos = alvos
      .map((a) => ({ ...a, lh: parseFloat((a.style.match(/line-height:([\d.]+)/) || [])[1]) }))
      .filter((a) => isFinite(a.lh) && a.lh < 1.22);
    const linhas = baixos.map((a) => `linha ~${a.linha} (line-height:${a.lh})`);
    expect(linhas, `abaixo do piso:\n${linhas.join('\n')}`).toEqual([]);
  });
});

describe('padding-bottom continua fora de elementos clampados (a técnica rejeitada)', () => {
  // Medido: padding-bottom num elemento com -webkit-line-clamp não abre
  // espaço — vaza um pedaço da linha seguinte (a que o clamp devia truncar).
  // Se isto aparecer um dia, alguém reintroduziu a técnica errada.
  it('nenhum título/subtítulo/citação clampado usa padding-bottom', () => {
    const comPadBottom = clampStyles(fonte).filter(
      ({ style }) =>
        /padding-bottom/.test(style) &&
        (/font-family:\$\{PT\.cond\}/.test(style) || /font-family:\$\{PT\.serif\}/.test(style))
    );
    const linhas = comPadBottom.map((a) => `linha ~${a.linha}`);
    expect(linhas, `usa padding-bottom (técnica rejeitada):\n${linhas.join('\n')}`).toEqual([]);
  });
});
