// Pipeline de agentes (agents.js) — cobre as funções PURAS: parsing tolerante
// de JSON, normalização de cada agente, validação do design contra os catálogos
// reais e a montagem do texto plano retrocompatível. As chamadas de rede
// (callLLM) NÃO são exercitadas aqui — só a lógica determinística.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  A = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js'],
    [
      'extractJSON', 'asList',
      'normalizeInterpretation', 'fallbackInterpretation',
      'normalizeArticle', 'articleFromPlainText',
      'normalizeDesign', 'fallbackDesign', 'DESIGN_DEFAULT',
      'articleToPlainText', 'artFromPipeline', 'interpretationToBlock',
      'POSTER_TEMPLATES', 'POSTER_PALETTES',
    ]
  );
});

describe('extractJSON', () => {
  it('faz parse de JSON puro', () => {
    expect(A.extractJSON('{"a":1}')).toEqual({ a: 1 });
  });
  it('remove cercas de código ```json', () => {
    expect(A.extractJSON('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it('recorta prosa ao redor do objeto', () => {
    expect(A.extractJSON('Claro! Aqui está: {"t":"x"} — espero que ajude.')).toEqual({ t: 'x' });
  });
  it('tolera vírgula final', () => {
    expect(A.extractJSON('{"a":1,"b":2,}')).toEqual({ a: 1, b: 2 });
  });
  it('devolve null quando não há JSON', () => {
    expect(A.extractJSON('só um texto qualquer')).toBeNull();
    expect(A.extractJSON('')).toBeNull();
    expect(A.extractJSON(null)).toBeNull();
  });
});

describe('asList', () => {
  it('mantém arrays limpando vazios', () => {
    expect(A.asList(['a', '', ' b '])).toEqual(['a', 'b']);
  });
  it('quebra string por separadores', () => {
    expect(A.asList('a; b\nc•d')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('devolve [] para valores inesperados', () => {
    expect(A.asList(null)).toEqual([]);
    expect(A.asList(42)).toEqual([]);
  });
});

describe('normalizeInterpretation', () => {
  it('normaliza categoria para maiúsculas e preenche defaults', () => {
    const i = A.normalizeInterpretation({ assunto: 'Obra entregue', categoria: 'cidade', fatos: ['fato 1'] }, 'texto');
    expect(i.categoria).toBe('CIDADE');
    expect(i.assunto).toBe('Obra entregue');
    expect(i.fatos).toEqual(['fato 1']);
    expect(i.datas).toEqual([]);
  });
  it('cai para o fallback quando data é inválida', () => {
    const i = A.normalizeInterpretation(null, 'Primeira linha\nsegunda');
    expect(i.categoria).toBe('GERAL');
    expect(i.fatos.length).toBeGreaterThan(0);
  });
});

describe('normalizeArticle', () => {
  const interp = { assunto: 'Assunto X', resumo_factual: 'Resumo factual.' };
  it('normaliza hashtags (prefixo #, sem espaço, sem duplicata, teto 8)', () => {
    const a = A.normalizeArticle({
      titulo: 'T', corpo: ['p1', 'p2'],
      hashtags: ['sem hash', '#ja', '#ja', 'a b c', '#1', '#2', '#3', '#4', '#5'],
    }, interp);
    expect(a.hashtags).toContain('#semhash');
    expect(a.hashtags).toContain('#ja');
    // sem duplicatas
    expect(a.hashtags.filter((h) => h === '#ja').length).toBe(1);
    // teto de 8
    expect(a.hashtags.length).toBeLessThanOrEqual(8);
  });
  it('usa o assunto/resumo da interpretação quando faltam campos', () => {
    const a = A.normalizeArticle({}, interp);
    expect(a.titulo).toBe('Assunto X');
    expect(a.resumo).toBe('Resumo factual.');
    expect(a.corpo).toEqual([]);
  });
});

describe('articleFromPlainText (fallback do redator)', () => {
  it('fatia título + corpo de um texto corrido', () => {
    const a = A.articleFromPlainText('Título aqui\nSubtítulo curto\nCorpo primeiro parágrafo.\nCorpo segundo.', { assunto: 'x', resumo_factual: '' });
    expect(a.titulo).toBe('Título aqui');
    expect(a._fallback).toBe(true);
    expect(a.corpo.length).toBeGreaterThan(0);
  });
});

describe('normalizeDesign (validação contra catálogos reais)', () => {
  it('aceita ids válidos e anexa rótulos', () => {
    const d = A.normalizeDesign({ template: 'quote-impact', format: '1:1', palette: 'azul-institucional', justificativa: 'porque sim' });
    expect(d.template).toBe('quote-impact');
    expect(d.format).toBe('1:1');
    expect(d.palette).toBe('azul-institucional');
    expect(d.templateLabel).toBe(A.POSTER_TEMPLATES['quote-impact'].label);
    expect(d.paletteLabel).toBe(A.POSTER_PALETTES['azul-institucional'].label);
    expect(d.justificativa).toBe('porque sim');
  });
  it('corrige ids inválidos para o default seguro', () => {
    const d = A.normalizeDesign({ template: 'modelo-inexistente', format: '99:1', palette: 'paleta-fake' });
    expect(d.template).toBe(A.DESIGN_DEFAULT.template);
    expect(d.format).toBe(A.DESIGN_DEFAULT.format);
    expect(d.palette).toBe(A.DESIGN_DEFAULT.palette);
  });
  it('data ausente → totalmente default', () => {
    const d = A.normalizeDesign(null);
    expect(d.template).toBe(A.DESIGN_DEFAULT.template);
    expect(A.POSTER_TEMPLATES[d.template]).toBeTruthy();
    expect(A.POSTER_PALETTES[d.palette]).toBeTruthy();
  });
});

describe('fallbackDesign (heurística sem rede)', () => {
  it('escolhe citação quando há citações', () => {
    const d = A.fallbackDesign({ categoria: 'GERAL', citacoes: ['"algo"'], numeros: [] }, { titulo: 'T' });
    expect(d.template).toBe('quote-impact');
  });
  it('escolhe números quando há 2+ números', () => {
    const d = A.fallbackDesign({ categoria: 'ECONOMIA', citacoes: [], numeros: ['10', '20'] }, { titulo: 'T' });
    expect(d.template).toBe('numbers-data');
    expect(d.palette).toBe('tons-corporativos');
  });
  it('mapeia paleta por categoria', () => {
    const d = A.fallbackDesign({ categoria: 'SAÚDE', citacoes: [], numeros: [] }, { titulo: 'T' });
    expect(d.palette).toBe('verde-editorial');
    // resultado sempre válido no catálogo
    expect(A.POSTER_PALETTES[d.palette]).toBeTruthy();
  });
});

describe('articleToPlainText (retrocompat)', () => {
  it('junta título/subtítulo/lead/corpo com linha em branco e deduplica', () => {
    const txt = A.articleToPlainText({
      titulo: 'Título', subtitulo: 'Subtítulo', lead: 'Lead frase.', corpo: ['Lead frase.', 'Segundo parágrafo.'],
    });
    expect(txt).toContain('Título');
    expect(txt).toContain('Subtítulo');
    expect(txt.split('\n\n').length).toBe(4); // título, subtítulo, lead, corpo2 (lead duplicado removido)
  });
});

describe('artFromPipeline (ponte para cartaz/carrossel)', () => {
  it('converte article estruturado no formato "art" dos cartazes', () => {
    const g = {
      article: { titulo: 'T', subtitulo: 'S', lead: 'Lead.', corpo: ['Lead.', 'Corpo 2.'], hashtags: [] },
      interpretation: { categoria: 'cidade', local: 'Salvador, BA' },
    };
    const art = A.artFromPipeline(g);
    expect(art.title).toBe('T');
    expect(art.subtitle).toBe('S');
    expect(art.category).toBe('CIDADE');
    expect(art.location).toBe('Salvador, BA');
    // lead não duplica dentro dos parágrafos do corpo
    expect(art.bodyParagraphs.filter((p) => p === 'Lead.').length).toBe(1);
    expect(art.body).toContain('Corpo 2.');
  });
  it('devolve null sem article (geração antiga)', () => {
    expect(A.artFromPipeline({ content: 'texto' })).toBeNull();
  });
});

describe('interpretationToBlock', () => {
  it('monta um bloco legível com os fatos rotulados', () => {
    const block = A.interpretationToBlock({
      assunto: 'Obra', categoria: 'CIDADE', local: 'Salvador', resumo_factual: 'X entregou Y.',
      fatos: ['fato 1'], entidades: ['Prefeitura'], numeros: ['50 cestas'], datas: [], citacoes: [], lacunas: [],
    });
    expect(block).toContain('Assunto: Obra');
    expect(block).toContain('- fato 1');
    expect(block).toContain('- 50 cestas');
    expect(block).not.toContain('Datas'); // arrays vazios não aparecem
  });
});
