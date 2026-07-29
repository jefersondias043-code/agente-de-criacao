// Orquestração do pipeline (runContentPipeline) com callLLM STUBADO — exercita
// a linha de montagem real: interpretação → redação → revisão, incluindo as
// etapas de progresso (onStage) e os caminhos de FALLBACK quando um agente não
// devolve JSON. Nenhuma rede é tocada: substituímos o callLLM global.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  A = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js'],
    ['runContentPipeline', 'POSTER_TEMPLATES', 'POSTER_PALETTES']
  );
});

// Injeta um callLLM stubado via a costura `call` do pipeline (sem rede). O stub
// devolve { content } cru, então o extractJSON REAL ainda roda (cobre fallbacks).
let _responder = null;
const stubCall = async (prompt) => _responder(prompt);
function installLLM(responder) { _responder = responder; }
function role(prompt) {
  if (prompt.includes('AGENTE DE INTERPRETAÇÃO')) return 'interpret';
  if (prompt.includes('AGENTE REDATOR')) return 'write';
  if (prompt.includes('AGENTE EDITOR')) return 'edit';
  if (prompt.includes('AGENTE DE OTIMIZAÇÃO')) return 'optimize';
  return 'unknown';
}

const goodOpt = JSON.stringify({
  hashtags: [
    { tag: 'cidades', tipo: 'ampla' }, { tag: 'cestasbasicas', tipo: 'assunto' },
    { tag: 'assistenciasocial', tipo: 'nicho' }, { tag: 'prefeitura', tipo: 'nicho' },
    { tag: 'salvador', tipo: 'local' }, { tag: 'utilidadepublica', tipo: 'intencao' },
  ],
  palavras_chave: ['cestas básicas salvador', 'assistência social', 'calabar'],
});

const goodInterp = JSON.stringify({
  assunto: 'Prefeitura entrega cestas no Calabar',
  categoria: 'cidade',
  local: 'Salvador, BA',
  resumo_factual: 'A Prefeitura entregou 50 cestas básicas no Calabar.',
  fatos: ['A Prefeitura entregou 50 cestas básicas', 'A entrega ocorreu no bairro do Calabar'],
  entidades: ['Prefeitura'], datas: ['nesta semana'], numeros: ['50 cestas'], citacoes: [], lacunas: [],
});
const goodArticle = JSON.stringify({
  titulo: 'Calabar recebe 50 cestas básicas da Prefeitura',
  subtitulo: 'Ação da Prefeitura atende famílias do bairro nesta semana',
  lead: 'A Prefeitura entregou 50 cestas básicas a moradores do Calabar nesta semana.',
  corpo: ['A ação faz parte da assistência social do município.', 'As cestas foram distribuídas às famílias do bairro.'],
  resumo: 'Prefeitura entrega 50 cestas no Calabar.',
  hashtags: ['#calabar', '#salvador', '#assistencia'],
});
const goodEdit = JSON.stringify({
  titulo: 'Calabar recebe 50 cestas básicas da Prefeitura',
  subtitulo: 'Entrega atendeu famílias do bairro nesta semana',
  lead: 'A Prefeitura entregou 50 cestas básicas a moradores do Calabar nesta semana.',
  corpo: ['A distribuição integra a assistência social do município.', 'As cestas chegaram às famílias do bairro.'],
  resumo: 'Prefeitura entrega 50 cestas no Calabar.',
});

describe('runContentPipeline — caminho feliz', () => {
  let result; let stages;
  beforeEach(async () => {
    stages = [];
    installLLM((p) => {
      const r = role(p);
      const body = { interpret: goodInterp, write: goodArticle, edit: goodEdit, optimize: goodOpt }[r] || '{}';
      return { content: body, model: 'stub-model', promptTokens: 10, completionTokens: 20 };
    });
    result = await A.runContentPipeline({
      call: stubCall,
      content: 'A Prefeitura entregou 50 cestas básicas a moradores do Calabar nesta semana.',
      style: 'Jornalístico', tone: 'Neutro',
      onStage: (k) => stages.push(k),
    });
  });

  it('chama os 4 agentes em ordem (progresso)', () => {
    expect(stages).toEqual(['interpret', 'write', 'edit', 'optimize']);
  });
  it('produz interpretação estruturada com categoria em maiúsculas', () => {
    expect(result.interpretation.categoria).toBe('CIDADE');
    expect(result.interpretation.fatos.length).toBe(2);
  });
  it('produz artigo com título, corpo e hashtags normalizadas', () => {
    expect(result.article.titulo).toContain('Calabar');
    expect(result.article.corpo.length).toBe(2);
    expect(result.article.hashtags).toContain('#salvador');
  });
  it('monta content em texto plano retrocompatível', () => {
    expect(typeof result.content).toBe('string');
    expect(result.content).toContain('Calabar');
    // título + subtítulo + lead + 2 corpos, deduplicado
    expect(result.content.split('\n\n').length).toBeGreaterThanOrEqual(4);
  });
  it('soma tokens dos agentes', () => {
    expect(result.promptTokens).toBe(40);       // interp + write + edit + optimize
    expect(result.completionTokens).toBe(80);
  });
  it('entrega a camada de distribuição com estratos', () => {
    const tipos = result.optimization.hashtags.map((h) => h.tipo);
    expect(tipos).toContain('ampla');
    expect(tipos).toContain('local');
    expect(tipos).toContain('intencao');
    expect(result.optimization.palavrasChave.length).toBeGreaterThan(0);
    // as tags também chegam no article, para os consumidores antigos
    expect(result.article.hashtags).toContain('#salvador');
  });
  it('a revisão entra no resultado e o rascunho fica guardado', () => {
    expect(result.agents.editor.ok).toBe(true);
    expect(result.article.subtitulo).toBe('Entrega atendeu famílias do bairro nesta semana');
    expect(result.articleDraft.subtitulo).toBe('Ação da Prefeitura atende famílias do bairro nesta semana');
  });

  // O pipeline REPUBLICA `conflitos` sob outro nome (`conflitosDeTom`) e mantém
  // `repeticoes`. Quem ler a chave errada recebe [] — zero achados, nenhum erro.
  // Já custou um relatório de auditoria que dizia "limpo" sobre texto sujo.
  it('publica o diagnóstico do revisor com nomes estáveis', () => {
    const ed = result.agents.editor;
    ['conflitosDeTom', 'conflitosRestantes', 'repeticoes', 'repeticoesRestantes']
      .forEach((k) => expect(Array.isArray(ed[k]), k).toBe(true));
    expect(ed.conflitos).toBeUndefined();
  });
});

describe('runContentPipeline — fallbacks resilientes', () => {
  it('redator sem JSON: usa texto corrido como matéria', async () => {
    installLLM((p) => {
      const r = role(p);
      if (r === 'interpret') return { content: goodInterp, model: 'm' };
      if (r === 'write') return { content: 'Título solto\nPrimeiro parágrafo do corpo.\nSegundo parágrafo.', model: 'm' };
      return { content: 'sem json', model: 'm' };
    });
    const res = await A.runContentPipeline({ call: stubCall, content: 'texto', style: 'Jornalístico', tone: 'Neutro' });
    expect(res.article.titulo).toBe('Título solto');
    expect(res.article._fallback).toBe(true);
    expect(res.content).toContain('parágrafo');
  });


  it('interpretador sem JSON: embrulha o texto bruto e o pipeline segue', async () => {
    installLLM((p) => {
      const r = role(p);
      if (r === 'interpret') return { content: 'não consigo', model: 'm' };
      if (r === 'write') return { content: goodArticle, model: 'm' };
      return { content: goodEdit, model: 'm' };
    });
    const res = await A.runContentPipeline({ call: stubCall, content: 'Conteúdo bruto da pauta.', style: 'Jornalístico', tone: 'Neutro' });
    expect(res.interpretation.categoria).toBe('GERAL');
    expect(res.article.titulo).toBeTruthy();
  });

});
