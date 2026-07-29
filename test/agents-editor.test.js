// Agente EDITOR — a passada de revisão que eleva a qualidade da redação, e a
// trava que impede essa liberdade de virar invenção.
//
// A regra do produto é assimétrica: perder o polimento é um aborrecimento,
// publicar um número inventado é um defeito grave. Por isso a trava pode ser
// rigorosa — quando ela dispara, o rascunho é mantido e nada se perde além do
// refino.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  A = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js'],
    [
      'editorIntroduziuFato', 'numericTokens', 'quotedTokens', 'articleAllText',
      'mergeEditedArticle', 'runEditorAgent', 'buildEditorPrompt',
      'suggestBodyLength', 'buildWriterPrompt', 'stylePrompt', 'STYLE_PROMPTS',
    ]
  );
});

const interp = {
  assunto: 'Prefeitura entrega cestas no Calabar',
  categoria: 'CIDADE', local: 'Salvador, BA',
  resumo_factual: 'A Prefeitura entregou 50 cestas básicas no Calabar.',
  fatos: ['A Prefeitura entregou 50 cestas básicas', 'A entrega ocorreu no Calabar'],
  entidades: ['Prefeitura'], datas: ['nesta semana'], numeros: ['50 cestas'],
  citacoes: ['A ação vai continuar'], lacunas: [],
};
const rascunho = {
  titulo: 'Calabar recebe 50 cestas básicas',
  subtitulo: 'Entrega ocorreu nesta semana',
  lead: 'A Prefeitura entregou 50 cestas básicas a moradores do Calabar nesta semana.',
  corpo: ['A distribuição integra a assistência social do município.'],
  resumo: 'Prefeitura entrega 50 cestas no Calabar.',
  hashtags: ['#calabar'],
};

describe('extração determinística para a trava', () => {
  it('reduz números aos dígitos, para 1.500 ≡ 1500', () => {
    expect(A.numericTokens('R$ 1.500,00 e 50 itens')).toEqual(['150000', '50']);
  });
  it('ignora texto sem número', () => {
    expect(A.numericTokens('sem cifras aqui')).toEqual([]);
  });
  it('captura falas entre aspas retas e tipográficas', () => {
    const q = A.quotedTokens('Ele disse "a obra segue no prazo" ontem.');
    expect(q).toEqual(['a obra segue no prazo']);
  });
});

describe('trava de fidelidade da revisão', () => {
  it('aprova revisão que só melhora a forma', () => {
    const revisado = Object.assign({}, rascunho, {
      lead: 'Moradores do Calabar receberam 50 cestas básicas da Prefeitura nesta semana.',
      corpo: ['A distribuição faz parte da assistência social do município.'],
    });
    expect(A.editorIntroduziuFato(rascunho, revisado, interp)).toEqual([]);
  });

  it('reprova número que não existia', () => {
    const revisado = Object.assign({}, rascunho, {
      corpo: ['A distribuição atendeu 320 famílias do bairro.'],
    });
    const achados = A.editorIntroduziuFato(rascunho, revisado, interp);
    expect(achados.length).toBe(1);
    expect(achados[0]).toContain('320');
  });

  it('reprova citação inventada', () => {
    const revisado = Object.assign({}, rascunho, {
      corpo: ['O prefeito afirmou que "vamos dobrar a meta no ano que vem".'],
    });
    const achados = A.editorIntroduziuFato(rascunho, revisado, interp);
    expect(achados.some((x) => x.startsWith('citação'))).toBe(true);
  });

  it('aceita citação que já estava nos fatos isolados', () => {
    const revisado = Object.assign({}, rascunho, {
      corpo: ['Segundo a Prefeitura, "A ação vai continuar".'],
    });
    expect(A.editorIntroduziuFato(rascunho, revisado, interp)).toEqual([]);
  });

  it('aceita número que veio dos fatos, mesmo ausente do rascunho', () => {
    const comNumero = Object.assign({}, interp, { numeros: ['50 cestas', '12 toneladas'] });
    const revisado = Object.assign({}, rascunho, { corpo: ['Foram 12 toneladas de alimentos.'] });
    expect(A.editorIntroduziuFato(rascunho, revisado, comNumero)).toEqual([]);
  });
});

describe('runEditorAgent', () => {
  const call = (resp) => async () => ({ content: resp, model: 'stub' });

  it('aplica a revisão quando ela é fiel', async () => {
    const r = await A.runEditorAgent(rascunho, interp, 'Jornalístico', 'Neutro', call(JSON.stringify({
      titulo: 'Calabar recebe 50 cestas básicas',
      subtitulo: 'Ação atendeu famílias do bairro',
      lead: 'Moradores do Calabar receberam 50 cestas básicas da Prefeitura nesta semana.',
      corpo: ['A distribuição integra a assistência social do município.'],
      resumo: 'Prefeitura entrega 50 cestas no Calabar.',
    })));
    expect(r.ok).toBe(true);
    expect(r.article.subtitulo).toBe('Ação atendeu famílias do bairro');
    expect(r.article.hashtags).toEqual(['#calabar']);   // revisão não mexe em hashtag
  });

  it('DESCARTA a revisão inteira se ela inventar um número', async () => {
    const r = await A.runEditorAgent(rascunho, interp, 'Jornalístico', 'Neutro', call(JSON.stringify({
      titulo: 'Calabar recebe 50 cestas básicas',
      subtitulo: 'Ação atendeu 320 famílias',
      lead: rascunho.lead, corpo: rascunho.corpo, resumo: rascunho.resumo,
    })));
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('introduziu-fato');
    expect(r.article).toEqual(rascunho);              // rascunho preservado
  });

  it('mantém o rascunho quando o modelo não devolve JSON', async () => {
    const r = await A.runEditorAgent(rascunho, interp, 'Jornalístico', 'Neutro', call('não sei responder'));
    expect(r.ok).toBe(false);
    expect(r.article).toEqual(rascunho);
  });

  it('mantém o rascunho quando a chamada lança', async () => {
    const r = await A.runEditorAgent(rascunho, interp, 'Jornalístico', 'Neutro', async () => { throw new Error('rede'); });
    expect(r.ok).toBe(false);
    expect(r.article).toEqual(rascunho);
  });

  it('preserva a marca de procedência _fallback', async () => {
    const bruto = Object.assign({}, rascunho, { _fallback: true });
    const r = await A.runEditorAgent(bruto, interp, 'Jornalístico', 'Neutro', call(JSON.stringify({
      titulo: bruto.titulo, subtitulo: 'Outro ângulo', lead: bruto.lead,
      corpo: bruto.corpo, resumo: bruto.resumo,
    })));
    expect(r.article._fallback).toBe(true);
  });
});

describe('extensão do corpo acompanha o material', () => {
  const comFatos = (n) => ({ fatos: Array.from({ length: n }, (_, i) => 'f' + i), citacoes: [], numeros: [], datas: [] });
  it('pauta magra rende 2 parágrafos', () => {
    expect(A.suggestBodyLength(comFatos(2))).toEqual({ min: 2, max: 2 });
  });
  it('pauta média abre faixa', () => {
    expect(A.suggestBodyLength(comFatos(6)).max).toBe(3);
  });
  it('pauta rica rende mais', () => {
    expect(A.suggestBodyLength(comFatos(14)).min).toBeGreaterThanOrEqual(4);
  });
  it('citações e números pesam na conta', () => {
    const base = A.suggestBodyLength({ fatos: ['a', 'b'], citacoes: [], numeros: [], datas: [] });
    const rico = A.suggestBodyLength({ fatos: ['a', 'b'], citacoes: ['c1', 'c2'], numeros: ['1', '2'], datas: ['d'] });
    expect(rico.max).toBeGreaterThan(base.max);
  });
});

describe('estilo deixa de chegar ao redator como rótulo nu', () => {
  it('estilos jornalísticos têm arquitetura dedicada', () => {
    expect(A.stylePrompt('Jornalístico')).toContain('pirâmide invertida');
    expect(A.stylePrompt('Reportagem')).toContain('ARQUITETURA');
  });
  it('estilo sem prompt dedicado herda o guia do grupo + a própria descrição', () => {
    const p = A.stylePrompt('Copywriting');
    expect(p).toContain('ARQUITETURA');
    expect(p).toContain('CARÁTER DO ESTILO');
  });
  it('estilo desconhecido ainda recebe orientação', () => {
    expect(A.stylePrompt('EstiloQueNaoExiste')).toContain('ARQUITETURA');
  });
  it('o prompt do redator carrega a arquitetura do estilo escolhido', () => {
    const p = A.buildWriterPrompt(interp, 'Reportagem', 'Neutro');
    expect(p).toContain('ESTILO "Reportagem"');
    expect(p).toContain('ARQUITETURA');
    expect(p).toContain('OFÍCIO EDITORIAL');
  });
  it('sem citações no material, o redator é proibido de criar falas', () => {
    const semFala = Object.assign({}, interp, { citacoes: [] });
    expect(A.buildWriterPrompt(semFala, 'Jornalístico', 'Neutro')).toContain('não crie nenhuma');
  });
});
