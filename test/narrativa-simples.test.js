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
  N = loadModules(['catalogs.js', 'core.js', 'poster-templates.js', 'narrativa.js', 'narrativa-motor.js'],
    ['diagnosticarNarrativa', 'NARR_PERGUNTAS', 'buildExtracaoNarrativaPrompt', 'buildRoteiroPrompt',
      'narrFormato', 'narrTom']);
});

/** Um controle está "à vista" quando não está escondido nem é o seletor de
 *  arquivo (que vive `hidden` por trás do botão "Anexar", como nas outras
 *  ferramentas). */
const aVista = () => [...doc.querySelectorAll('input, textarea, select')]
  .filter((el) => !el.closest('[hidden]') && !el.hasAttribute('hidden') && el.type !== 'file')
  .map((el) => el.id);

describe('a tela pede uma decisão, não onze', () => {
  it('só a ideia fica à vista', () => {
    expect(aVista()).toEqual(['n-ideia']);
  });

  it('não sobrou nenhuma seção de configuração na tela', () => {
    // Recolher já não bastava: uma tela com três sanfonas ao lado do campo
    // continua sendo uma tela de configuração.
    expect(doc.querySelectorAll('details').length).toBe(0);
  });

  it('os campos da história continuam existindo, fora da vista', () => {
    // Eles são o ESTADO que a IA preenche e que o prompt lê — sumir com eles
    // quebraria a qualidade; mostrá-los é a complexidade que saiu.
    const interno = doc.getElementById('n-interno');
    expect(interno, 'o porta-estado precisa existir').toBeTruthy();
    expect(interno.hasAttribute('hidden')).toBe(true);
    ['n-protagonista', 'n-desejo', 'n-obstaculo', 'n-risco', 'n-formatoId',
      'n-tomId', 'n-tamanhoId', 'n-perfil', 'n-publico', 'n-cta']
      .forEach((id) => expect(interno.querySelector('#' + id), id).toBeTruthy());
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

describe('o campo tem anexo, como nas outras ferramentas', () => {
  // A Narrativa era a única que só aceitava texto digitado.
  it('tem o botão e o seletor de arquivo', () => {
    expect(doc.getElementById('n-attach-btn'), 'sem botão de anexar').toBeTruthy();
    const inp = doc.getElementById('n-attach-input');
    expect(inp, 'sem seletor de arquivo').toBeTruthy();
    expect(inp.hasAttribute('hidden'), 'o seletor fica atrás do botão').toBe(true);
  });

  it('aceita os MESMOS tipos das outras ferramentas', () => {
    // Sem reusar INGEST_ACCEPT, a Narrativa aceitaria uma lista própria que
    // envelheceria sozinha.
    expect(js).toMatch(/nAttachInput\.accept = INGEST_ACCEPT/);
  });

  it('usa o mesmo pipeline de ingestão (PDF, OCR, áudio, vídeo)', () => {
    expect(js).toMatch(/ingestFileNative\(f, entregar\)/);
  });

  it('mídia grande espera um toque — é o gesto que destrava o áudio no iPhone', () => {
    expect(js).toMatch(/_genEhMidiaGrande/);
    expect(js).toMatch(/data-attach-go/);
    expect(doc.getElementById('n-attach-pending'), 'sem área do cartão pendente').toBeTruthy();
  });

  it('o texto extraído entra na ideia, sem apagar o que já estava', () => {
    expect(js).toMatch(/cur \? \(cur \+ '\\n\\n' \+ text\) : text/);
  });
});

describe('um clique basta', () => {
  it('o gerar lê o material com IA antes de cobrar qualquer coisa', () => {
    // A leitura virou a primeira etapa do motor — e continua vindo ANTES de
    // qualquer cobrança ao usuário.
    expect(js).toMatch(/await runNarrativaPipeline\(/);
    expect(js).toMatch(/aposLeitura/);
  });

  it('a leitura roda ANTES da cobrança, não depois', () => {
    const iLe = js.indexOf('const aposLeitura = (plano)');
    const iCobra = js.indexOf('Falta uma resposta para a história existir');
    expect(iLe).toBeGreaterThan(0);
    expect(iLe).toBeLessThan(iCobra);
  });

  it('falha no meio do caminho não some com o que já havia', () => {
    // A crítica é melhoria, não requisito; a reescrita que falha deixa o
    // rascunho de pé. O usuário nunca fica sem nada por causa de uma etapa.
    const motor = readFileSync(join(raiz, 'src/narrativa-motor.js'), 'utf8');
    expect(motor).toMatch(/catch \(_\) \{ novo = ''; \}/);
    expect(motor).toMatch(/if \(!novo\) break;/);
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
    // Quem escreve agora é o motor; a garantia é a mesma.
    const p = N.buildRoteiroPrompt(base, { formato: N.narrFormato('reels'), tom: N.narrTom('direto') });
    expect(p).toContain('reabrir a barraca da feira');
    expect(p).toContain('a licença foi cassada');
    expect(p).toContain('a aposentadoria de dez anos');
  });

  it('o extrator continua proibido de inventar', () => {
    const p = N.buildExtracaoNarrativaPrompt('uma ideia qualquer');
    expect(p).toMatch(/NÃO invente desejo, obstáculo, risco/);
    expect(p).toMatch(/Um campo vazio é uma resposta útil/);
  });
});
