// SEGURANÇA JURÍDICA da matéria gerada.
//
// Duas garantias, em tensão deliberada:
//  (a) o texto não pode condenar ninguém antes do juiz, acusar sem fonte nem
//      suprimir o outro lado;
//  (b) e NÃO pode virar um texto morno — cuidado jurídico se faz com precisão
//      e atribuição, não com "talvez".
//
// A auditoria é conservadora de propósito: aviso que aparece sempre é aviso
// que ninguém lê. Por isso metade dos testes cobre o que ela NÃO deve apontar.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  A = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js'],
    ['auditarRiscoJuridico', 'buildWriterPrompt', 'buildEditorPrompt',
      'buildInterpreterPrompt', 'normalizeInterpretation', 'interpretationToBlock',
      'EDITORIAL_SAFETY', 'buildPrompt']
  );
});

const base = {
  categoria: 'SEGURANÇA', local: 'Salvador, BA', assunto: 'a',
  fatos: ['f'], entidades: ['João Silva'], datas: [], numeros: [],
  citacoes: [], contexto: [], angulos: [], contraditorio: [], sensivel: [],
  statusProcessual: '', lacunas: [],
};
const materia = (corpo, extra) => Object.assign({
  titulo: 'Título', subtitulo: 'Sub', lead: corpo, corpo: [], resumo: '', hashtags: [],
}, extra || {});

describe('rótulo criminal antes de condenação', () => {
  it('aponta "o criminoso" quando não há condenação', () => {
    const r = A.auditarRiscoJuridico(
      materia('O criminoso foi levado à delegacia após o roubo, segundo a polícia.'),
      Object.assign({}, base, { sensivel: ['CRIMINAL'] })
    );
    expect(r.some((x) => x.tipo === 'rotulo-sem-condenacao')).toBe(true);
  });

  it('NÃO aponta quando o material registra condenação', () => {
    const r = A.auditarRiscoJuridico(
      materia('O criminoso foi condenado a oito anos, segundo a sentença.'),
      Object.assign({}, base, { statusProcessual: 'condenado em 1ª instância', sensivel: ['CRIMINAL'] })
    );
    expect(r.some((x) => x.tipo === 'rotulo-sem-condenacao')).toBe(false);
  });

  it('NÃO confunde o termo correto de fase processual com rótulo', () => {
    const r = A.auditarRiscoJuridico(
      materia('O suspeito foi ouvido, segundo a polícia, e negou a acusação.'),
      Object.assign({}, base, { sensivel: ['CRIMINAL'] })
    );
    expect(r.some((x) => x.tipo === 'rotulo-sem-condenacao')).toBe(false);
  });
});

describe('atribuição', () => {
  it('aponta matéria criminal sem nenhuma fonte visível', () => {
    const r = A.auditarRiscoJuridico(
      materia('Houve desvio de dinheiro na obra e a prisão aconteceu ontem.'),
      Object.assign({}, base, { entidades: [] })
    );
    expect(r.some((x) => x.tipo === 'sem-atribuicao')).toBe(true);
  });

  it('NÃO aponta quando a informação está atribuída', () => {
    const r = A.auditarRiscoJuridico(
      materia('Segundo o Ministério Público, houve desvio de recursos. A defesa negou.'),
      Object.assign({}, base, { entidades: [] })
    );
    expect(r.some((x) => x.tipo === 'sem-atribuicao')).toBe(false);
  });

  it('não incomoda matéria que não é criminal', () => {
    const r = A.auditarRiscoJuridico(
      materia('A Prefeitura entregou 50 cestas básicas no Calabar nesta semana.'),
      Object.assign({}, base, { categoria: 'CIDADE' })
    );
    expect(r).toEqual([]);
  });
});

describe('contraditório', () => {
  it('aponta acusação com pessoa nomeada e sem o outro lado', () => {
    const r = A.auditarRiscoJuridico(
      materia('Segundo a denúncia, houve fraude no contrato.'),
      Object.assign({}, base, { entidades: ['Construtora X'], sensivel: ['CRIMINAL'] })
    );
    expect(r.some((x) => x.tipo === 'sem-contraditorio')).toBe(true);
  });

  it('NÃO aponta quando a defesa aparece', () => {
    const r = A.auditarRiscoJuridico(
      materia('Segundo a denúncia, houve fraude no contrato. Procurada, a empresa não se manifestou.'),
      Object.assign({}, base, { entidades: ['Construtora X'], sensivel: ['CRIMINAL'] })
    );
    expect(r.some((x) => x.tipo === 'sem-contraditorio')).toBe(false);
  });

  it('registrar a AUSÊNCIA de resposta já satisfaz a checagem', () => {
    const r = A.auditarRiscoJuridico(
      materia('Segundo o MP, houve fraude. A defesa não foi localizada até a publicação.'),
      Object.assign({}, base, { entidades: ['X'], sensivel: ['CRIMINAL'] })
    );
    expect(r.some((x) => x.tipo === 'sem-contraditorio')).toBe(false);
  });
});

describe('menor de idade', () => {
  it('alerta quando há adolescente e nome próprio completo', () => {
    const r = A.auditarRiscoJuridico(
      materia('O adolescente Pedro Almeida foi apreendido, segundo a polícia. A defesa negou.'),
      Object.assign({}, base, { sensivel: ['MENOR_DE_IDADE'], entidades: ['Pedro Almeida'] })
    );
    expect(r.some((x) => x.tipo === 'menor-identificado')).toBe(true);
  });

  it('não alerta quando o adolescente não é nomeado', () => {
    const r = A.auditarRiscoJuridico(
      materia('Um adolescente de 16 anos foi apreendido, segundo a polícia. A defesa negou.'),
      Object.assign({}, base, { sensivel: ['MENOR_DE_IDADE'], entidades: [] })
    );
    expect(r.some((x) => x.tipo === 'menor-identificado')).toBe(false);
  });
});

describe('a auditoria não vira ruído', () => {
  it('matéria bem construída não gera nenhum aviso', () => {
    const r = A.auditarRiscoJuridico(
      materia('Segundo o Ministério Público, o investigado é suspeito de fraude no contrato. Procurada, a defesa não se manifestou.'),
      Object.assign({}, base, { entidades: ['João Silva'], sensivel: ['CRIMINAL'] })
    );
    expect(r).toEqual([]);
  });

  it('tolera matéria vazia sem quebrar', () => {
    expect(A.auditarRiscoJuridico(materia(''), null)).toEqual([]);
  });
});

describe('as práticas chegam a quem escreve', () => {
  it('o bloco cobre atribuição, presunção de inocência e contraditório', () => {
    expect(A.EDITORIAL_SAFETY).toContain('ATRIBUIÇÃO');
    expect(A.EDITORIAL_SAFETY).toContain('PRESUNÇÃO DE INOCÊNCIA');
    expect(A.EDITORIAL_SAFETY).toContain('CONTRADITÓRIO');
    expect(A.EDITORIAL_SAFETY).toContain('suspeito → investigado → indiciado → denunciado → réu → condenado');
  });

  it('o bloco proíbe explicitamente o texto covarde', () => {
    expect(A.EDITORIAL_SAFETY).toContain('ISTO NÃO É PEDIDO DE NEUTRALIDADE');
    expect(A.EDITORIAL_SAFETY).toContain('COVARDE');
    expect(A.EDITORIAL_SAFETY).toContain('FORTE E SEGURO');
  });

  it('o redator recebe as práticas', () => {
    expect(A.buildWriterPrompt(base, 'Jornalístico', 'Provocativo')).toContain('REDAÇÃO JURIDICAMENTE RESPONSÁVEL');
  });

  it('o revisor corrige risco SEM amolecer o texto', () => {
    const p = A.buildEditorPrompt(materia('x'), base, 'Jornalístico', 'Crítico');
    expect(p).toContain('RISCO JURÍDICO');
    expect(p).toContain('SEM amolecer o texto');
  });

  it('o modo rápido também recebe as práticas', () => {
    expect(A.buildPrompt('Jornalístico', 'Pessimista', 'conteúdo').prompt)
      .toContain('REDAÇÃO JURIDICAMENTE RESPONSÁVEL');
  });

  it('o interpretador isola fase processual e contraditório', () => {
    const p = A.buildInterpreterPrompt('pauta');
    expect(p).toContain('"status_processual"');
    expect(p).toContain('"contraditorio"');
    expect(p).toContain('"sensivel"');
  });

  it('a fase processual chega ao redator com a trava de não promover ninguém', () => {
    const bloco = A.interpretationToBlock(Object.assign({}, base, {
      statusProcessual: 'X é suspeito', contraditorio: ['A defesa negou'], sensivel: ['CRIMINAL'],
    }));
    expect(bloco).toContain('NÃO promova ninguém além dela');
    expect(bloco).toContain('Contraditório disponível');
    expect(bloco).toContain('Domínios sensíveis');
  });

  it('a normalização aceita os campos novos sem quebrar os antigos', () => {
    const i = A.normalizeInterpretation({
      assunto: 'x', status_processual: 'suspeito', contraditorio: ['negou'], sensivel: ['criminal'],
    }, 'txt');
    expect(i.statusProcessual).toBe('suspeito');
    expect(i.contraditorio).toEqual(['negou']);
    expect(i.sensivel).toEqual(['CRIMINAL']);
    expect(i.fatos).toEqual([]);
  });
});
