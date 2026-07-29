// Agente de OTIMIZAÇÃO — a camada de distribuição da matéria.
//
// A regra que este arquivo protege: hashtag não é palavra bonita tirada do
// texto, é DISTRIBUIÇÃO. Cada uma ocupa um nível de segmentação diferente
// (ampla · assunto · nicho · local · intenção), como no AutoPost IA. Se a
// estratificação se perder, o recurso volta a ser decorativo.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  A = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js'],
    ['sanitizeHashtag', 'normalizeOptimization', 'fallbackOptimization',
      'buildOptimizerPrompt', 'runOptimizerAgent', 'OPT_TIPOS', 'OPT_TIPO_LABEL',
      'optContextoTemporal', 'buildInterpreterPrompt', 'normalizeInterpretation',
      'interpretationToBlock', 'buildWriterPrompt']
  );
});

const interp = {
  assunto: 'Prefeitura entrega cestas no Calabar', categoria: 'CIDADE',
  local: 'Salvador, BA', resumo_factual: 'r',
  fatos: ['A Prefeitura entregou 50 cestas'], entidades: ['Prefeitura', 'Secretaria de Assistência'],
  datas: ['nesta semana'], numeros: ['50 cestas'], citacoes: [], contexto: [], angulos: [], lacunas: [],
};
const article = { titulo: 'Calabar recebe 50 cestas básicas', subtitulo: 'S', lead: 'L', corpo: ['C'], resumo: 'R' };

describe('sanitizeHashtag — a tag precisa ser digitável na busca', () => {
  it('remove acento, cerquilha e espaço', () => {
    expect(A.sanitizeHashtag('#São Paulo')).toBe('saopaulo');
    expect(A.sanitizeHashtag('Ação!')).toBe('acao');
  });
  it('descarta caracteres especiais', () => {
    expect(A.sanitizeHashtag('vida-clt/2026')).toBe('vidaclt2026');
  });
  it('tolera vazio', () => {
    expect(A.sanitizeHashtag(null)).toBe('');
  });
});

describe('normalizeOptimization', () => {
  it('mantém os estratos declarados pelo modelo', () => {
    const o = A.normalizeOptimization({
      hashtags: [{ tag: 'Cidades', tipo: 'ampla' }, { tag: '#Salvador', tipo: 'local' }],
      palavras_chave: ['Cestas Básicas', 'assistência social'],
    });
    expect(o.hashtags).toEqual([{ tag: 'cidades', tipo: 'ampla' }, { tag: 'salvador', tipo: 'local' }]);
    expect(o.palavrasChave).toEqual(['cestas básicas', 'assistência social']);
  });

  it('tipo inválido cai em "assunto" em vez de sumir', () => {
    const o = A.normalizeOptimization({ hashtags: [{ tag: 'x', tipo: 'inventado' }] });
    expect(o.hashtags[0].tipo).toBe('assunto');
  });

  it('não repete a mesma tag em dois estratos', () => {
    const o = A.normalizeOptimization({
      hashtags: [{ tag: 'salvador', tipo: 'local' }, { tag: '#Salvador', tipo: 'nicho' }],
    });
    expect(o.hashtags.length).toBe(1);
  });

  it('palavras-chave mantêm acento (são termos de busca, não hashtags)', () => {
    const o = A.normalizeOptimization({ hashtags: [], palavras_chave: ['saúde pública'] });
    expect(o.palavrasChave).toEqual(['saúde pública']);
  });

  it('aceita a chave em inglês e limpa "#" indevido', () => {
    const o = A.normalizeOptimization({ keywords: ['#obras', 'transporte'] });
    expect(o.palavrasChave).toEqual(['obras', 'transporte']);
  });

  it('tolera dados ausentes', () => {
    expect(A.normalizeOptimization(null)).toEqual({ hashtags: [], palavrasChave: [] });
  });
});

describe('fallbackOptimization — sem rede, a ESTRUTURA continua de pé', () => {
  it('monta a escada de segmentação a partir da interpretação', () => {
    const o = A.fallbackOptimization(interp, article);
    const tipos = o.hashtags.map((h) => h.tipo);
    expect(tipos).toContain('ampla');
    expect(tipos).toContain('local');
    expect(tipos).toContain('intencao');
    expect(o.hashtags.every((h) => /^[a-z0-9]+$/.test(h.tag))).toBe(true);
  });
  it('usa o local da matéria como estrato geográfico', () => {
    const o = A.fallbackOptimization(interp, article);
    expect(o.hashtags.find((h) => h.tipo === 'local').tag).toBe('salvador');
  });
  it('matéria sem local não inventa geografia', () => {
    const o = A.fallbackOptimization(Object.assign({}, interp, { local: '' }), article);
    expect(o.hashtags.some((h) => h.tipo === 'local')).toBe(false);
  });
  it('gera termos de busca combinando assunto e local', () => {
    const o = A.fallbackOptimization(interp, article);
    expect(o.palavrasChave.length).toBeGreaterThan(0);
  });
});

describe('prompt do otimizador carrega a estratégia, não só o pedido', () => {
  it('descreve cada estrato de segmentação', () => {
    const p = A.buildOptimizerPrompt(interp, article);
    A.OPT_TIPOS.forEach((t) => expect(p).toContain(`"${t}"`));
    expect(p).toContain('nível de segmentação');
  });
  it('com local, pede o estrato geográfico', () => {
    expect(A.buildOptimizerPrompt(interp, article)).toContain('hashtag LOCAL');
  });
  it('sem local, manda pular o estrato em vez de inventar', () => {
    const p = A.buildOptimizerPrompt(Object.assign({}, interp, { local: '' }), article);
    expect(p).toContain('pule este estrato');
  });
  it('inclui contexto temporal (hashtag envelhece)', () => {
    const p = A.buildOptimizerPrompt(interp, article, new Date('2026-03-15T12:00:00Z'));
    expect(p).toContain('março de 2026');
  });
  it('exige as ~10 palavras-chave como termos de BUSCA', () => {
    const p = A.buildOptimizerPrompt(interp, article);
    expect(p).toContain('TERMOS DE BUSCA');
    expect(p).toContain('8 a 12');
  });
});

describe('runOptimizerAgent', () => {
  const call = (resp) => async () => ({ content: resp, model: 'stub' });

  it('usa a resposta do modelo quando ela é válida', async () => {
    const r = await A.runOptimizerAgent(interp, article, call(JSON.stringify({
      hashtags: [{ tag: 'cidades', tipo: 'ampla' }, { tag: 'salvador', tipo: 'local' }],
      palavras_chave: ['cestas básicas'],
    })));
    expect(r.ok).toBe(true);
    expect(r.optimization.hashtags.length).toBe(2);
  });

  it('sem JSON, cai na estrutura de reserva', async () => {
    const r = await A.runOptimizerAgent(interp, article, call('não sei'));
    expect(r.ok).toBe(false);
    expect(r.optimization.hashtags.length).toBeGreaterThan(0);
  });

  it('JSON válido mas VAZIO não zera a distribuição', async () => {
    const r = await A.runOptimizerAgent(interp, article, call('{"hashtags":[],"palavras_chave":[]}'));
    expect(r.optimization.hashtags.length).toBeGreaterThan(0);
  });

  it('erro de rede não derruba a etapa', async () => {
    const r = await A.runOptimizerAgent(interp, article, async () => { throw new Error('rede'); });
    expect(r.ok).toBe(false);
    expect(r.optimization.hashtags.length).toBeGreaterThan(0);
  });
});

describe('estilo e tom com efeito real', () => {
  it('o redator recebe a fronteira entre inventar fato e argumentar', () => {
    const p = A.buildWriterPrompt(interp, 'Jornalístico', 'Pessimista');
    expect(p).toContain('INVENTAR FATO');
    expect(p).toContain('PERMITIDO E ESPERADO');
    expect(p).toContain('ARGUMENTAR');
  });

  it('o redator é cobrado por intensidade de tom, não só por verniz', () => {
    const p = A.buildWriterPrompt(interp, 'Jornalístico', 'Pessimista');
    expect(p).toContain('INEQUÍVOCO');
    expect(p).toContain('quantas frases precisaria reescrever');
  });

  it('o interpretador passa a isolar contexto e ângulos — matéria-prima do argumento', () => {
    const p = A.buildInterpreterPrompt('texto da pauta');
    expect(p).toContain('"contexto"');
    expect(p).toContain('"angulos"');
  });

  it('contexto e ângulos chegam ao redator no bloco de fatos', () => {
    const rico = Object.assign({}, interp, {
      contexto: ['a obra estava parada desde 2023'],
      angulos: ['o prazo foi cumprido'],
    });
    const bloco = A.interpretationToBlock(rico);
    expect(bloco).toContain('Contexto presente no material');
    expect(bloco).toContain('Ângulos editoriais');
  });

  it('a interpretação normalizada aceita os campos novos sem quebrar os antigos', () => {
    const i = A.normalizeInterpretation({ assunto: 'x', contexto: ['c'], angulos: ['a'] }, 'txt');
    expect(i.contexto).toEqual(['c']);
    expect(i.angulos).toEqual(['a']);
    expect(i.fatos).toEqual([]);
  });
});
