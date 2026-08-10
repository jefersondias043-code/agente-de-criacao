// NARRATIVA SIMPLES — um campo, um botão.
//
// A ferramenta funcionava, mas cobrava caro para começar: 11 controles à vista
// e o botão de gerar TRAVADO até o usuário responder três perguntas à mão.
// Medido no navegador, antes e depois:
//
//   controles à vista        11 → 1
//   botão travado ao abrir   sim → não
//
// O que NÃO mudou é o que dá qualidade: as três perguntas do lema continuam
// decidindo se existe história. Mudou quem as responde primeiro — a IA lê a
// ideia e responde; o usuário só é chamado se ainda faltar algo, e para UMA
// pergunta, não para um formulário.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const js = readFileSync(join(raiz, 'src/narrativa.js'), 'utf8');
const vista = html.slice(html.indexOf('id="view-narrativa"'), html.indexOf('id="n-history-backdrop"'));
const doc = new JSDOM(`<body><section>${vista.slice(vista.indexOf('>') + 1)}</section></body>`).window.document;

let N;
beforeAll(() => {
  clearStorage();
  N = loadModules(['catalogs.js', 'core.js', 'poster-templates.js', 'narrativa.js'],
    ['diagnosticarNarrativa', 'NARR_PERGUNTAS', 'buildExtracaoNarrativaPrompt', 'buildNarrativaPrompt']);
});

/** Um controle está "à vista" quando não vive dentro de um <details>. */
const aVista = () => [...doc.querySelectorAll('input, textarea, select')]
  .filter((el) => !el.closest('details'))
  .map((el) => el.id);

describe('a tela pede uma decisão, não onze', () => {
  it('só a ideia fica à vista', () => {
    expect(aVista()).toEqual(['n-ideia']);
  });

  it('tudo o mais continua existindo, recolhido', () => {
    // Simplificar não é remover: quem quiser ajustar formato, tom, elenco ou as
    // três respostas continua podendo — só não é obrigado a passar por ali.
    const todos = [...doc.querySelectorAll('input, textarea, select')].map((el) => el.id);
    ['n-protagonista', 'n-desejo', 'n-obstaculo', 'n-risco',
      'n-formatoId', 'n-tomId', 'n-tamanhoId', 'n-perfil', 'n-publico', 'n-cta']
      .forEach((id) => expect(todos, id).toContain(id));
  });

  it('as seções avançadas começam FECHADAS', () => {
    ['n-detalhe', 'n-ajustes', 'n-lema'].forEach((id) => {
      const d = doc.getElementById(id);
      expect(d, id).toBeTruthy();
      expect(d.hasAttribute('open'), `${id} não pode abrir por padrão`).toBe(false);
    });
  });

  it('o botão não nasce travado', () => {
    const b = doc.getElementById('n-submit');
    expect(b).toBeTruthy();
    expect(b.hasAttribute('disabled'), 'o botão travado era o que emperrava tudo').toBe(false);
  });

  it('e o código não volta a travá-lo', () => {
    expect(js).not.toMatch(/btn\.disabled = !diag\.pronto/);
    expect(js).toMatch(/btn\.disabled = false; btn\.title = ''/);
  });

  it('a tela vazia não recebe veredito nem X vermelho', () => {
    // Abrir a ferramenta e levar "SITUAÇÃO" com três falhas era a mesma
    // intimidação dos cinco campos em branco: ainda não há o que diagnosticar.
    expect(js).toMatch(/const vazia = !String\(d\.ideia \|\| ''\)\.trim\(\)/);
    expect(js).toMatch(/if \(vazia\) \{[\s\S]{0,40}host\.innerHTML = '';/);
  });

  it('as abas História/Conteúdo sumiram — era navegação a mais', () => {
    expect(vista).not.toContain('n-mtabs');
  });
});

describe('um clique basta', () => {
  it('o gerar lê a ideia com IA antes de cobrar qualquer coisa', () => {
    expect(js).toMatch(/buildExtracaoNarrativaPrompt\(d\.ideia\)/);
    expect(js).toMatch(/Lendo a sua ideia…/);
  });

  it('a extração roda ANTES da cobrança, não depois', () => {
    const iExtrai = js.indexOf('buildExtracaoNarrativaPrompt(d.ideia)');
    const iCobra = js.indexOf('Falta uma resposta para a história existir');
    expect(iExtrai).toBeGreaterThan(0);
    expect(iExtrai).toBeLessThan(iCobra);
  });

  it('falha da IA não trava o usuário — ele ainda pode responder à mão', () => {
    expect(js).toMatch(/catch \(err\) \{ \/\* segue: o usuário responde à mão \*\/ \}/);
  });
});

describe('quando ainda falta algo, pergunta UMA coisa', () => {
  it('existe a pergunta focada', () => {
    expect(js).toMatch(/function renderNarrPerguntaFoco/);
    expect(doc.getElementById('n-pergunta-foco')).toBeTruthy();
  });

  it('mostra só a PRIMEIRA pergunta que falta', () => {
    expect(js).toMatch(/\.find\(\(q\) => q\.status === 'faltando'\)/);
  });

  it('não aparece na tela vazia — seria o formulário de volta', () => {
    expect(js).toMatch(/if \(!falta \|\| !temIdeia\)/);
  });

  it('responder ali grava no rascunho e no campo detalhado', () => {
    expect(js).toMatch(/d\[campo\] = v;/);
    expect(js).toMatch(/saveNarrativaDraft\(\);\s*\n\s*renderNarrDiagnostico\(\);/);
  });
});

describe('a qualidade do resultado não foi afrouxada', () => {
  // Simplificar a porta de entrada não pode virar aceitar situação como
  // história — é o ponto inteiro da ferramenta.
  const base = { protagonista: 'Marlene', desejo: 'reabrir a barraca da feira',
    obstaculo: 'a licença foi cassada', risco: 'a aposentadoria de dez anos' };

  it('as três perguntas continuam decidindo se existe história', () => {
    expect(N.diagnosticarNarrativa(base).pronto).toBe(true);
    ['desejo', 'obstaculo', 'risco'].forEach((c) => {
      const sem = Object.assign({}, base); sem[c] = '';
      expect(N.diagnosticarNarrativa(sem).pronto, c).toBe(false);
      expect(N.diagnosticarNarrativa(sem).veredito, c).toBe('situacao');
    });
  });

  it('resposta de fuga continua sendo recusada', () => {
    const fuga = Object.assign({}, base, { obstaculo: 'nada, é só querer' });
    expect(N.diagnosticarNarrativa(fuga).pronto).toBe(false);
  });

  it('o prompt de escrita continua levando a história inteira', () => {
    const built = N.buildNarrativaPrompt({ narrativa: base, formatoId: null, tomId: null, tamanhoId: null });
    expect(built.prompt).toContain('reabrir a barraca da feira');
    expect(built.prompt).toContain('a licença foi cassada');
    expect(built.prompt).toContain('a aposentadoria de dez anos');
  });

  it('o extrator continua proibido de inventar', () => {
    const p = N.buildExtracaoNarrativaPrompt('uma ideia qualquer');
    expect(p).toMatch(/NÃO invente desejo, obstáculo, risco/);
    expect(p).toMatch(/Um campo vazio é uma resposta útil/);
  });
});
