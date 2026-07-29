// COERÊNCIA DE TOM — quando o texto de origem puxa para o lado contrário.
//
// O defeito: a fonte diz "sucesso extraordinário", o usuário pede tom
// pessimista, e a palavra atravessa para a matéria. O resultado elogia e
// critica o mesmo acontecimento em parágrafos diferentes.
//
// A regra: em conflito entre a fonte e a configuração, manda a configuração —
// mas só sobre a FORMA. O acontecimento é intocável, e citação entre aspas é
// reproduzida literalmente mesmo contrariando o tom.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  A = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js'],
    ['detectarConflitosDeTom', 'detectarRepeticoes', 'semCitacoes', 'toneValence', 'buildEditorPrompt',
      'runEditorAgent', 'buildWriterPrompt', 'buildInterpreterPrompt',
      'normalizeInterpretation', 'interpretationToBlock', 'buildPrompt', 'TONES']
  );
});

const materia = (lead, corpo) => ({
  titulo: 'Título', subtitulo: 'Sub', lead, corpo: corpo || [], resumo: '', hashtags: [],
});

describe('valência derivada do catálogo de tons', () => {
  it('tons positivos e negativos têm lado', () => {
    expect(A.toneValence('Otimista')).toBe(1);
    expect(A.toneValence('Inspirador')).toBe(1);
    expect(A.toneValence('Pessimista')).toBe(-1);
    expect(A.toneValence('Alarmista')).toBe(-1);
  });
  it('tons neutros e emocionais não têm lado a defender', () => {
    expect(A.toneValence('Neutro')).toBe(0);
    expect(A.toneValence('Formal')).toBe(0);
    expect(A.toneValence('Dramático')).toBe(0);
  });
  it('tom desconhecido não quebra', () => {
    expect(A.toneValence('NaoExiste')).toBe(0);
  });
  it('todo tom do catálogo é classificável', () => {
    A.TONES.forEach((g) => g.items.forEach((i) => {
      expect(typeof A.toneValence(i.id), i.id).toBe('number');
    }));
  });
});

describe('detecção do vazamento', () => {
  it('acha elogio da fonte em matéria pessimista', () => {
    const c = A.detectarConflitosDeTom(
      materia('A obra foi um sucesso e atendeu 500 famílias.'), 'Pessimista');
    expect(c).toContain('sucesso');
  });

  it('acha crítica da fonte em matéria otimista', () => {
    const c = A.detectarConflitosDeTom(
      materia('O caos no trânsito piorou com a obra.'), 'Otimista');
    expect(c).toContain('caos');
  });

  it('texto já coerente com o tom não acusa nada', () => {
    expect(A.detectarConflitosDeTom(
      materia('A obra atendeu 500 famílias e ampliou o atendimento.'), 'Otimista')).toEqual([]);
  });

  it('tom sem lado não é verificado', () => {
    expect(A.detectarConflitosDeTom(
      materia('A obra foi um sucesso e também um desastre.'), 'Neutro')).toEqual([]);
  });

  it('varre o corpo inteiro, não só o lead', () => {
    const c = A.detectarConflitosDeTom(
      materia('A obra atendeu 500 famílias.', ['O resultado foi exemplar.']), 'Pessimista');
    expect(c).toContain('exemplar');
  });
});

describe('citação é intocável', () => {
  it('juízo DENTRO de aspas não conta como conflito', () => {
    const c = A.detectarConflitosDeTom(
      materia('O secretário afirmou que a entrega foi "um sucesso extraordinário".'), 'Pessimista');
    expect(c).toEqual([]);
  });

  it('mas o mesmo juízo FORA das aspas conta', () => {
    const c = A.detectarConflitosDeTom(
      materia('A entrega foi um sucesso, disse o secretário: "os números falam".'), 'Pessimista');
    expect(c).toContain('sucesso');
  });

  it('semCitacoes remove só o trecho entre aspas', () => {
    expect(A.semCitacoes('Ele disse "foi ótimo" ontem')).not.toContain('ótimo');
    expect(A.semCitacoes('Ele disse "foi ótimo" ontem')).toContain('ontem');
  });
});

describe('o revisor recebe os trechos exatos a consertar', () => {
  it('o prompt lista o conflito e manda resolver primeiro', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Pessimista', ['sucesso', 'conquista']);
    expect(p).toContain('CONFLITO DE TOM DETECTADO');
    expect(p).toContain('sucesso, conquista');
    expect(p).toContain('preservando o ACONTECIMENTO');
  });

  it('sem conflito, o prompt não ganha a seção', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Pessimista', []);
    expect(p).not.toContain('CONFLITO DE TOM DETECTADO');
  });

  it('o prompt protege a citação de ser reescrita', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Otimista', ['caos']);
    expect(p).toContain('dentro de uma CITAÇÃO');
  });

  it('runEditorAgent detecta sozinho e registra o que achou', async () => {
    const call = async () => ({ content: JSON.stringify({
      titulo: 'Título', subtitulo: 'Sub',
      lead: 'A obra atendeu 500 famílias, número abaixo da fila de espera.',
      corpo: [], resumo: '',
    }), model: 'stub' });
    const r = await A.runEditorAgent(
      materia('A obra foi um sucesso e atendeu 500 famílias.'), {}, 'Jornalístico', 'Pessimista', call);
    expect(r.conflitos).toContain('sucesso');
    expect(r.conflitosRestantes).toEqual([]);   // a revisão resolveu
  });
});

describe('a separação entre fato e juízo na origem', () => {
  it('o interpretador é mandado registrar o fato em linguagem NEUTRA', () => {
    const p = A.buildInterpreterPrompt('pauta');
    expect(p).toContain('linguagem NEUTRA');
    expect(p).toContain('SEPARE O FATO DO JUÍZO');
  });

  it('a carga avaliativa da fonte vira campo próprio', () => {
    const p = A.buildInterpreterPrompt('pauta');
    expect(p).toContain('"carga_original"');
    expect(p).toContain('"viés_da_fonte"');
  });

  it('a citação é poupada da neutralização', () => {
    expect(A.buildInterpreterPrompt('pauta')).toContain('As CITAÇÕES são exceção');
  });

  it('normaliza os campos novos', () => {
    const i = A.normalizeInterpretation({
      assunto: 'x', carga_original: ['sucesso extraordinário'], 'viés_da_fonte': 'positivo',
    }, 'txt');
    expect(i.cargaOriginal).toEqual(['sucesso extraordinário']);
    expect(i.viesDaFonte).toBe('POSITIVO');
  });

  it('sem os campos, assume viés neutro', () => {
    expect(A.normalizeInterpretation({ assunto: 'x' }, 'txt').viesDaFonte).toBe('NEUTRO');
  });

  it('o redator vê o juízo da fonte marcado como coisa a NÃO herdar', () => {
    const bloco = A.interpretationToBlock({
      fatos: ['f'], cargaOriginal: ['sucesso extraordinário'], viesDaFonte: 'POSITIVO',
    });
    expect(bloco).toContain('NÃO herde estas expressões');
    expect(bloco).toContain('Viés do texto de origem: POSITIVO');
  });
});

describe('a regra de prioridade chega a quem escreve', () => {
  it('o redator sabe que o tom da fonte não manda', () => {
    const p = A.buildWriterPrompt({ fatos: ['f'] }, 'Jornalístico', 'Pessimista');
    expect(p).toContain('QUEM MANDA NO TOM É A ESCOLHA DO USUÁRIO');
    expect(p).toContain('UNIDADE');
  });

  it('o redator é lembrado de que o acontecimento não muda', () => {
    const p = A.buildWriterPrompt({ fatos: ['f'] }, 'Jornalístico', 'Otimista');
    expect(p).toContain('Mudou de quem é a avaliação');
  });

  it('o modo rápido recebe a mesma regra', () => {
    expect(A.buildPrompt('Jornalístico', 'Pessimista', 'conteúdo').prompt)
      .toContain('QUEM MANDA NO TOM É A ESCOLHA DO USUÁRIO');
  });
});

/* ==========================================================================
 * CASO REAL — saída reportada pelo usuário (estilo Noticioso, tom Pessimista).
 * Serve de piso: o que passou batido uma vez não pode voltar a passar.
 * ======================================================================== */
const CASO_REAL = {
  titulo: 'Corrida de Rua em Cajutiba: Expectativas Altas, mas Resultados Limitados',
  subtitulo: 'Apenas 2 mil atletas participam do evento, que faz parte do projeto Take 3 Room',
  lead: 'A corrida de rua em Cajutiba, que faz parte do projeto Take 3 Room, contou com a participação de apenas 2 mil atletas, um número que pode ser considerado limitado em comparação com outras corridas da região. O evento, que já passou por Aporá e vai passar por Esplanada e Iambupe, é visto como uma celebração da saúde e da superação, mas também levanta questionamentos sobre a eficácia do projeto em atrair participantes.',
  corpo: [
    'A corrida de rua em Cajutiba é um exemplo de como os eventos esportivos podem ser organizados de forma a promover a saúde e a qualidade de vida, mas também destaca a necessidade de uma melhor estrutura e divulgação para atrair mais participantes.',
    'O projeto Take 3 Room tem como objetivo promover a saúde e a superação em várias cidades da região, mas a corrida de rua em Cajutiba pode ser vista como um exemplo de como os resultados podem ser limitados.',
    'A corrida de rua em Cajutiba também levanta questionamentos sobre a eficácia do projeto em atrair participantes e promover a saúde e a superação.',
  ],
  resumo: '', hashtags: [],
};
const INTERP_REAL = {
  cargaOriginal: ['sucesso absoluto', 'celebra saúde, superação e qualidade de vida', 'grande festa do esporte'],
  viesDaFonte: 'POSITIVO',
};

describe('caso real reportado: elogios sobreviveram ao tom pessimista', () => {
  it('pega os elogios que o léxico antigo deixava passar', () => {
    const c = A.detectarConflitosDeTom(CASO_REAL, 'Pessimista', INTERP_REAL);
    expect(c).toContain('superação');
    expect(c).toContain('qualidade de vida');
    expect(c.length).toBeGreaterThanOrEqual(3);
  });

  it('a carga da própria fonte é conferida, não só o léxico fixo', () => {
    const artigo = Object.assign({}, CASO_REAL, {
      lead: 'O evento foi um sucesso absoluto, com 2 mil atletas.', corpo: [],
    });
    const c = A.detectarConflitosDeTom(artigo, 'Pessimista', INTERP_REAL);
    expect(c).toContain('sucesso absoluto');
  });

  it('sem interpretação, o léxico fixo ainda funciona', () => {
    expect(A.detectarConflitosDeTom(CASO_REAL, 'Pessimista')).toContain('superação');
  });

  it('expressão curta demais da fonte não vira ruído', () => {
    const c = A.detectarConflitosDeTom(
      { titulo: 'a', subtitulo: '', lead: 'A obra atendeu famílias.', corpo: [] },
      'Pessimista', { cargaOriginal: ['boa'], viesDaFonte: 'POSITIVO' });
    expect(c).toEqual([]);
  });
});

describe('caso real reportado: a mesma crítica em todos os parágrafos', () => {
  it('acusa os parágrafos que abrem igual', () => {
    const r = A.detectarRepeticoes(CASO_REAL);
    expect(r.some((x) => /3 parágrafos abrem/.test(x))).toBe(true);
  });

  it('acusa o argumento repetido entre parágrafos', () => {
    const r = A.detectarRepeticoes(CASO_REAL);
    expect(r.some((x) => x.includes('levanta questionamentos sobre a eficácia'))).toBe(true);
    expect(r.some((x) => x.includes('promover a saúde e a'))).toBe(true);
  });

  it('texto bem construído não acusa repetição', () => {
    const bom = {
      titulo: 'T', subtitulo: 'S',
      lead: 'Apenas 2 mil atletas correram em Cajutiba neste domingo.',
      corpo: [
        'O percurso passou pelo centro da cidade, com apoio médico e massagem.',
        'Segundo os organizadores, novas etapas estão previstas para Esplanada e Entre Rios.',
      ], resumo: '', hashtags: [],
    };
    expect(A.detectarRepeticoes(bom)).toEqual([]);
  });

  it('matéria de um parágrafo só não tem o que repetir', () => {
    expect(A.detectarRepeticoes({ lead: 'Uma frase.', corpo: [] })).toEqual([]);
  });

  it('o revisor recebe as repetições com a ordem de fundir parágrafos', () => {
    const p = A.buildEditorPrompt(CASO_REAL, INTERP_REAL, 'Noticioso', 'Pessimista', [], A.detectarRepeticoes(CASO_REAL));
    expect(p).toContain('REPETIÇÃO DETECTADA');
    expect(p).toContain('funda-os num só');
    expect(p).toContain('entregue menos parágrafos');
  });
});

describe('caso real reportado: o tom fabricou premissa', () => {
  it('o redator é proibido de inventar comparação para sustentar o tom', () => {
    const p = A.buildWriterPrompt({ fatos: ['f'] }, 'Noticioso', 'Pessimista');
    expect(p).toContain('NÃO FABRICA FATO NOVO');
    expect(p).toContain('criar COMPARAÇÃO que o material não faz');
  });

  it('avaliação sem dono é tratada como fato inventado', () => {
    const p = A.buildWriterPrompt({ fatos: ['f'] }, 'Noticioso', 'Pessimista');
    expect(p).toContain('Avaliação sem dono é fato inventado');
  });

  it('mas a palavra-pivô continua permitida', () => {
    const p = A.buildWriterPrompt({ fatos: ['f'] }, 'Noticioso', 'Pessimista');
    expect(p).toContain('apenas 2 mil atletas');
    expect(p).toContain('PODE (é enquadramento)');
  });

  it('o redator é mandado avançar um argumento por parágrafo', () => {
    const p = A.buildWriterPrompt({ fatos: ['f'] }, 'Noticioso', 'Pessimista');
    expect(p).toContain('CADA PARÁGRAFO AVANÇA');
    expect(p).toContain('entregue MENOS parágrafos');
  });

  it('o modo rápido recebe as duas regras', () => {
    const p = A.buildPrompt('Noticioso', 'Pessimista', 'conteúdo').prompt;
    expect(p).toContain('NÃO FABRICA FATO NOVO');
    expect(p).toContain('CADA PARÁGRAFO AVANÇA');
  });
});
