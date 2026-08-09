// ORDEM DA TELA DE RESULTADO — o pacote primeiro, a transcrição por último.
//
// A transcrição vinha antes do pacote, e isso invertia a razão de o usuário
// estar nesta tela: depois de processar, o que ele veio buscar é o pacote — a
// transcrição é o insumo, não o resultado.
//
// O teste monta o HTML de verdade e mede a ordem no DOM, em vez de conferir a
// expressão de retorno: assim ele continua valendo se o render for reescrito.
import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lerAuto = (rel) => fs.readFileSync(path.join(raiz, 'autopost-ia', rel), 'utf8');

let R;
beforeAll(() => {
  const arquivos = ['js/core.js', 'js/package.js', 'js/render.js'].map(lerAuto).join('\n;\n');
  (0, eval)(arquivos + '\n;globalThis.__R__ = { renderItemDetail };');
  R = globalThis.__R__;
});

const item = {
  id: 'x1', data: '2026-08-09T12:00:00.000Z', nome: 'video.mp4', fonte: 'midia',
  transcricao: 'Cheguei na cozinha e resolvi testar a receita de bolo de fubá da minha avó.',
  nota: 87, aprovado: true, veredito: 'Pacote coerente.',
  avaliacoes: [{ id: 'titulo', score: 9, feedback: 'Gancho forte.' }],
  pacote: {
    titulo: 'O segredo do bolo de fubá que minha avó nunca escreveu',
    legenda: 'Ela nunca anotou a receita. Testei do jeito dela. Qual receita da sua família você não sabe fazer igual?',
    hashtags: [{ tag: 'receita', tipo: 'ampla' }, { tag: 'bolodefuba', tipo: 'assunto' }],
    palavras_chave: ['bolo de fubá cremoso', 'receita da vovó'],
  },
  editado: false,
};

/** Posição de cada bloco no documento montado. */
function posicoes(html) {
  const doc = new JSDOM(`<body><div id="host">${html}</div></body>`).window.document;
  const filhos = [...doc.querySelector('#host').children];
  const acha = (sel) => filhos.findIndex((el) => el.matches(sel) || el.querySelector(sel));
  return {
    doc,
    avaliacao: acha('.final-banner'),
    pacote: acha('.pkgcard'),
    transcricao: acha('.transc-wrap'),
  };
}

describe('a ordem dos blocos no resultado', () => {
  it('o pacote vem ANTES da transcrição', () => {
    const p = posicoes(R.renderItemDetail(item, { context: 'result' }));
    expect(p.pacote).toBeGreaterThanOrEqual(0);
    expect(p.transcricao).toBeGreaterThanOrEqual(0);
    expect(p.pacote, 'a transcrição voltou para cima do pacote').toBeLessThan(p.transcricao);
  });

  it('a avaliação acompanha o pacote — é o placar dele, não da transcrição', () => {
    const p = posicoes(R.renderItemDetail(item, { context: 'result' }));
    expect(p.avaliacao).toBeLessThan(p.transcricao);
  });

  it('vale igual no histórico e na tela de resultado', () => {
    ['result', 'history'].forEach((ctx) => {
      const p = posicoes(R.renderItemDetail(item, { context: ctx }));
      expect(p.pacote, ctx).toBeLessThan(p.transcricao);
    });
  });

  it('a transcrição é o ÚLTIMO conteúdo — só os botões vêm depois', () => {
    const html = R.renderItemDetail(item, { context: 'result' });
    const { doc, transcricao } = posicoes(html);
    const filhos = [...doc.querySelector('#host').children];
    filhos.slice(transcricao + 1).forEach((el) => {
      const texto = (el.textContent || '').trim();
      const soBotoes = !texto || /^[↺←🗑]/.test(texto) || el.matches('button') || !!el.querySelector('button');
      expect(soBotoes, `sobrou conteúdo depois da transcrição: "${texto.slice(0, 40)}"`).toBe(true);
    });
  });
});

describe('a transcrição continua inteira', () => {
  // Mover não pode virar esconder: ela segue disponível, com as mesmas ações.
  const html = () => R.renderItemDetail(item, { context: 'result' });

  it('o texto está lá', () => {
    expect(html()).toContain('bolo de fubá da minha avó');
  });

  it('copiar e avaliar potencial continuam no cabeçalho dela', () => {
    const { doc } = posicoes(html());
    const wrap = doc.querySelector('.transc-wrap');
    expect(wrap.querySelector('[data-copy-id]'), 'sumiu o Copiar').toBeTruthy();
    expect(wrap.querySelector('[data-analyze-id]'), 'sumiu o Avaliar potencial').toBeTruthy();
  });

  it('a análise de potencial continua agrupada com ela', () => {
    // O botão que dispara a análise vive no cabeçalho da transcrição; separar
    // os dois deixaria o resultado longe do gatilho.
    const { doc } = posicoes(html());
    expect(doc.querySelector('.transc-wrap .analisecard')).toBeTruthy();
  });

  it('o rótulo muda para texto colado, como antes', () => {
    const colado = R.renderItemDetail({ ...item, fonte: 'texto' }, { context: 'result' });
    expect(colado).toContain('Texto enviado');
    expect(colado).not.toContain('Transcrição');
  });
});

describe('a virada entre resultado e insumo fica visível', () => {
  it('a transcrição ganha separação do pacote no CSS', () => {
    // Sem isso ela encostaria no card: .iteration só tem margem inferior.
    const css = lerAuto('css/app.css');
    const bloco = /\.transc-wrap\s*\{[^}]*\}/.exec(css);
    expect(bloco, 'faltou a regra de .transc-wrap').toBeTruthy();
    expect(bloco[0]).toMatch(/margin-top/);
    expect(bloco[0]).toMatch(/border-top/);
  });

  it('e um rótulo que nomeia o que vem abaixo', () => {
    expect(lerAuto('css/app.css')).toMatch(/\.transc-wrap::before[\s\S]{0,200}content:\s*'Conteúdo de origem'/);
  });

  it('a versão embutida na plataforma acompanha', () => {
    const assado = fs.readFileSync(path.join(raiz, 'autopost-ia.html'), 'utf8');
    expect(assado).toContain("content: 'Conteúdo de origem'");
    expect(assado).toMatch(/return avalBox \+ card \+ blocoTransc \+ footer/);
  });
});
