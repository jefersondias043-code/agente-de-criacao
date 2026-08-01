// COMENTÁRIOS OPINATIVOS — a camada de leitura sobre os fatos.
//
// Estilo e tom mudam COMO o fato é contado. Este controle acrescenta uma
// opinião assumida sobre o que cada parágrafo apresenta — e por ser um eixo
// independente, ele colide de frente com duas regras que já existiam:
//
//   1. A varredura de coerência de tom manda o revisor apagar juízo do lado
//      contrário ao tom. Com comentário crítico + tom otimista, esse juízo é
//      justamente o que o usuário pediu.
//   2. O agente editor é treinado para cortar o que "não é fato". Sem aviso,
//      ele devolveria a matéria neutralizada e o controle não faria efeito.
//
// Estes testes existem sobretudo para travar essas duas colisões, e para
// garantir que quem NÃO pediu comentário continua recebendo o prompt de antes.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  A = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js', 'generate.js'],
    ['COMENTARIOS', 'COMENTARIO_PROMPTS', 'comentarioAtivo', 'comentarioLabel',
      'comentarioValencias', 'comentarioBloco', 'buildPrompt', 'buildWriterPrompt',
      'buildEditorPrompt', 'detectarConflitosDeTom', 'toneValence',
      'assembleFastGeneration', 'assembleAgentsGeneration']
  );
});

const materia = (lead, corpo) => ({
  titulo: 'Título', subtitulo: 'Sub', lead, corpo: corpo || [], resumo: '', hashtags: [],
});

describe('catálogo', () => {
  it('oferece desligado, positivo, negativo e os dois', () => {
    expect(A.COMENTARIOS.map((c) => c.id)).toEqual(['nenhum', 'positivos', 'negativos', 'ambos']);
    A.COMENTARIOS.forEach((c) => {
      expect(c.label, c.id).toBeTruthy();
      expect(c.desc, c.id).toBeTruthy();
    });
  });

  it('só considera ativo o que existe e não é "nenhum"', () => {
    expect(A.comentarioAtivo('nenhum')).toBe(false);
    expect(A.comentarioAtivo('')).toBe(false);
    expect(A.comentarioAtivo(undefined)).toBe(false);
    expect(A.comentarioAtivo('inexistente')).toBe(false);
    ['positivos', 'negativos', 'ambos'].forEach((id) => expect(A.comentarioAtivo(id), id).toBe(true));
  });

  it('cada direção ativa tem bloco de instrução próprio', () => {
    ['positivos', 'negativos', 'ambos'].forEach((id) => {
      expect(A.COMENTARIO_PROMPTS[id], id).toBeTruthy();
    });
    expect(A.COMENTARIO_PROMPTS.nenhum).toBeUndefined();
  });
});

describe('o bloco de comentário', () => {
  it('some por completo quando o modo está desligado', () => {
    expect(A.comentarioBloco('nenhum', 'Otimista')).toBe('');
    expect(A.comentarioBloco(undefined, 'Otimista')).toBe('');
  });

  it('carrega as travas de fidelidade e de fronteira jurídica', () => {
    const b = A.comentarioBloco('negativos', 'Neutro');
    expect(b).toMatch(/COMENTÁRIO COMENTA, NÃO INFORMA/);
    expect(b).toMatch(/de onde você tirou isso/i);
    expect(b).toMatch(/MARCADO como leitura/);
    expect(b).toMatch(/Sem adjetivo que desqualifique PESSOA/);
    expect(b).toMatch(/presunção de inocência/i);
  });

  it('proíbe o formato de bloco separado — o comentário entra no fluxo', () => {
    const b = A.comentarioBloco('positivos', 'Neutro');
    expect(b).toMatch(/NUNCA em bloco separado/);
    expect(b).toMatch(/"Comentário:"/);
    expect(b).toMatch(/DEPOIS do fato que ele comenta/);
  });

  it('positivo não autoriza elogiar o que não existe', () => {
    const b = A.comentarioBloco('positivos', 'Neutro');
    expect(b).toMatch(/DIREÇÃO DO COMENTÁRIO: POSITIVA/);
    expect(b).toMatch(/NÃO force/);
    expect(b).toMatch(/Elogiar o que não existe é invenção/);
  });

  it('negativo critica mesmo material elogioso — mas o ato, não a pessoa', () => {
    const b = A.comentarioBloco('negativos', 'Otimista');
    expect(b).toMatch(/INCLUSIVE quando o material for elogioso/);
    expect(b).toMatch(/nunca sobre a pessoa/i);
    expect(b).toMatch(/Crítica não é acusação/);
    expect(b).toMatch(/NÃO invente o defeito/);
  });

  it('ambos combina os dois lados sem virar alternância mecânica', () => {
    const b = A.comentarioBloco('ambos', 'Neutro');
    expect(b).toMatch(/OS DOIS LADOS/);
    expect(b).toMatch(/Não é alternância mecânica/);
    expect(b).toMatch(/Equilibrar não é amornar/);
  });

  it('explica que comentário e tom são eixos diferentes', () => {
    const b = A.comentarioBloco('negativos', 'Otimista');
    expect(b).toContain('COMENTÁRIO × TOM');
    expect(b).toContain('Otimista');            // o tom entra nomeado no bloco
    expect(b).toMatch(/NÃO é contradição/);
    expect(b).toMatch(/camada À PARTE/);
  });
});

describe('modo rápido (1 chamada)', () => {
  it('sem comentários, o prompt não ganha nada', () => {
    const p = A.buildPrompt('Jornalístico', 'Neutro', 'conteúdo').prompt;
    expect(p).not.toContain('CAMADA DE COMENTÁRIO');
    expect(p).not.toContain('DIREÇÃO DO COMENTÁRIO');
  });

  it('com comentários, o prompt ganha o bloco e as verificações extras', () => {
    const p = A.buildPrompt('Jornalístico', 'Neutro', 'conteúdo', 'negativos').prompt;
    expect(p).toContain('CAMADA DE COMENTÁRIO');
    expect(p).toMatch(/DIREÇÃO DO COMENTÁRIO: CRÍTICA/);
    expect(p).toMatch(/12\. Cada comentário se apoia/);
    expect(p).toMatch(/14\. Algum comentário desqualifica uma PESSOA/);
  });

  it('não mexe no resto do prompt — fidelidade e segurança jurídica seguem lá', () => {
    const p = A.buildPrompt('Jornalístico', 'Otimista', 'conteúdo', 'negativos').prompt;
    expect(p).toContain('REDAÇÃO JURIDICAMENTE RESPONSÁVEL');
    expect(p).toContain('MICROINTERVENÇÕES INTERPRETATIVAS');
    expect(p).toContain('Conteúdo:');
  });

  it('valor inválido é tratado como desligado', () => {
    const p = A.buildPrompt('Jornalístico', 'Neutro', 'conteúdo', 'qualquer-coisa').prompt;
    expect(p).not.toContain('CAMADA DE COMENTÁRIO');
  });
});

describe('desligado = exatamente o comportamento anterior', () => {
  // O pedido foi ampliar, não alterar. Quem não mexer no controle novo tem de
  // receber o MESMO prompt de antes — nem uma linha em branco a mais, porque
  // qualquer byte extra é uma variável nova na saída do modelo. Este teste
  // pegou duas linhas em branco que a primeira versão introduzia sem querer.
  const CASOS = [
    ['Jornalístico', 'Neutro'], ['Reportagem', 'Otimista'],
    ['Editorial', 'Pessimista'], ['Crônica', 'Dramático'],
  ];
  const interp = { fatos: ['f'], citacoes: [], numeros: [], datas: [], entidades: [], lacunas: [] };
  const art = { titulo: 'T', subtitulo: 'S', lead: 'L', corpo: ['a', 'b'], resumo: 'R' };

  for (const [estilo, tom] of CASOS) {
    it(`${estilo}/${tom}: omitir o parâmetro e passar "nenhum" dão o mesmo prompt`, () => {
      expect(A.buildPrompt(estilo, tom, 'PAUTA', 'nenhum').prompt)
        .toBe(A.buildPrompt(estilo, tom, 'PAUTA').prompt);
      expect(A.buildWriterPrompt(interp, estilo, tom, 'nenhum'))
        .toBe(A.buildWriterPrompt(interp, estilo, tom));
      expect(A.buildEditorPrompt(art, interp, estilo, tom, [], [], 'nenhum'))
        .toBe(A.buildEditorPrompt(art, interp, estilo, tom, [], []));
      expect(A.buildEditorPrompt(art, interp, estilo, tom, ['sucesso'], ['rep'], 'nenhum'))
        .toBe(A.buildEditorPrompt(art, interp, estilo, tom, ['sucesso'], ['rep']));
    });
  }

  it('não sobra linha em branco dupla no prompt com comentário ligado', () => {
    expect(A.buildPrompt('Jornalístico', 'Neutro', 'PAUTA', 'ambos').prompt).not.toMatch(/\n\n\n/);
    expect(A.buildWriterPrompt(interp, 'Jornalístico', 'Neutro', 'ambos')).not.toMatch(/\n\n\n/);
  });
});

describe('modo agentes — redator', () => {
  const interp = { fatos: ['f'], citacoes: [] };

  it('sem comentários, o prompt do redator é o de antes', () => {
    const p = A.buildWriterPrompt(interp, 'Jornalístico', 'Neutro');
    expect(p).not.toContain('CAMADA DE COMENTÁRIO');
    expect(p).toMatch(/UNIDADE: ao terminar, a matéria inteira precisa soar como UMA voz\. Nenhum parágrafo/);
  });

  it('com comentários, a regra de UNIDADE abre exceção para a camada opinativa', () => {
    const p = A.buildWriterPrompt(interp, 'Jornalístico', 'Otimista', 'negativos');
    expect(p).toContain('CAMADA DE COMENTÁRIO');
    expect(p).toMatch(/O RELATO não pode puxar para o lado contrário/);
    expect(p).toMatch(/não conta como quebra de unidade/);
  });

  it('as travas de invenção de fato continuam valendo', () => {
    const p = A.buildWriterPrompt(interp, 'Jornalístico', 'Otimista', 'negativos');
    expect(p).toContain('PROIBIDO (é invenção de fato)');
    expect(p).toContain('REDAÇÃO JURIDICAMENTE RESPONSÁVEL');
  });
});

describe('modo agentes — editor não pode neutralizar o que foi pedido', () => {
  it('sem comentários, o editor não recebe aviso nenhum', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Neutro', [], []);
    expect(p).not.toContain('COMENTÁRIO OPINATIVO');
  });

  it('com comentários, é instruído a preservar a opinião', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Otimista', [], [], 'negativos');
    expect(p).toContain('ESTA MATÉRIA LEVA COMENTÁRIO OPINATIVO');
    expect(p).toMatch(/NÃO as neutralize/);
    expect(p).toMatch(/não as corte por "não serem fato"/);
    expect(p).toContain('Negativos');   // a direção escolhida vai nomeada
  });

  it('ainda assim corrige comentário sem base, veredito e ofensa', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Otimista', [], [], 'ambos');
    expect(p).toMatch(/comentário sem nenhum fato que o sustente/);
    expect(p).toMatch(/escrito como fato provado/);
    expect(p).toMatch(/desqualifica uma pessoa/i);
  });

  it('a checagem final de tom passa a mirar só o relato', () => {
    const com = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Otimista', [], [], 'negativos');
    expect(com).toMatch(/Restou expressão de juízo puxando o RELATO/);
    const sem = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Otimista', [], []);
    expect(sem).toMatch(/A matéria tem que soar como UMA voz do início ao fim/);
  });
});

describe('a colisão com a varredura de coerência de tom', () => {
  // Sem esta regra, pedir "tom otimista + comentários negativos" faria o
  // revisor apagar exatamente o que o usuário contratou.
  const artNegativo = materia('A obra virou um fracasso e gerou prejuízo.');
  const artPositivo = materia('A obra foi um sucesso e trouxe melhoria.');

  it('sem comentários, o comportamento antigo é intacto', () => {
    expect(A.detectarConflitosDeTom(artNegativo, 'Otimista', {})).toContain('fracasso');
    expect(A.detectarConflitosDeTom(artPositivo, 'Pessimista', {})).toContain('sucesso');
  });

  it('comentário negativo + tom positivo: juízo negativo deixa de ser vazamento', () => {
    const c = A.detectarConflitosDeTom(artNegativo, 'Otimista', {}, 'negativos');
    expect(c).toEqual([]);
  });

  it('comentário positivo + tom negativo: juízo positivo deixa de ser vazamento', () => {
    const c = A.detectarConflitosDeTom(artPositivo, 'Pessimista', {}, 'positivos');
    expect(c).toEqual([]);
  });

  it('"ambos" libera as duas direções', () => {
    expect(A.detectarConflitosDeTom(artNegativo, 'Otimista', {}, 'ambos')).toEqual([]);
    expect(A.detectarConflitosDeTom(artPositivo, 'Pessimista', {}, 'ambos')).toEqual([]);
  });

  it('a liberação é só da direção pedida, não de todas', () => {
    // Comentário POSITIVO não autoriza juízo negativo a vazar num tom otimista.
    const c = A.detectarConflitosDeTom(artNegativo, 'Otimista', {}, 'positivos');
    expect(c).toContain('fracasso');
  });

  it('a valência intencional é derivada só do modo escolhido', () => {
    expect(A.comentarioValencias('nenhum')).toEqual({ positivo: false, negativo: false });
    expect(A.comentarioValencias('positivos')).toEqual({ positivo: true, negativo: false });
    expect(A.comentarioValencias('negativos')).toEqual({ positivo: false, negativo: true });
    expect(A.comentarioValencias('ambos')).toEqual({ positivo: true, negativo: true });
    expect(A.comentarioValencias('lixo')).toEqual({ positivo: false, negativo: false });
  });

  it('tom sem lado definido não é afetado pela escolha de comentário', () => {
    expect(A.toneValence('Neutro')).toBe(0);
    expect(A.detectarConflitosDeTom(artNegativo, 'Neutro', {}, 'negativos')).toEqual([]);
  });
});

describe('o pipeline inteiro carrega a escolha até os dois agentes', () => {
  // A opção passa por runContentPipeline → runWriterAgent → runEditorAgent.
  // Um elo solto nessa corrente é invisível na tela: a matéria sai sem
  // comentário e nada avisa que o controle foi ignorado.
  let P;
  beforeAll(() => {
    P = loadModules(
      ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js'],
      ['runContentPipeline']
    );
  });

  const interpJSON = JSON.stringify({
    assunto: 'Entrega de cestas', categoria: 'cidade', local: 'Salvador, BA',
    resumo_factual: 'A Prefeitura entregou 50 cestas.', fatos: ['A Prefeitura entregou 50 cestas'],
    entidades: ['Prefeitura'], datas: [], numeros: ['50'], citacoes: [], lacunas: [],
  });
  const artigoJSON = JSON.stringify({
    titulo: 'T', subtitulo: 'S', lead: 'A Prefeitura entregou 50 cestas.',
    corpo: ['Parágrafo um.', 'Parágrafo dois.'], resumo: 'R',
  });
  const otimJSON = JSON.stringify({ hashtags: [{ tag: 'a', tipo: 'ampla' }], palavras_chave: ['a'] });

  async function rodar(comentarios) {
    const prompts = [];
    await P.runContentPipeline({
      call: async (p) => {
        prompts.push(p);
        if (p.includes('AGENTE DE INTERPRETAÇÃO')) return { content: interpJSON, model: 'stub' };
        if (p.includes('AGENTE DE OTIMIZAÇÃO')) return { content: otimJSON, model: 'stub' };
        return { content: artigoJSON, model: 'stub' };
      },
      content: 'A Prefeitura entregou 50 cestas.',
      style: 'Jornalístico', tone: 'Otimista', comentarios,
    });
    return {
      redator: prompts.find((p) => p.includes('AGENTE REDATOR')) || '',
      editor: prompts.find((p) => p.includes('AGENTE EDITOR')) || '',
    };
  }

  it('entrega o bloco ao redator e o aviso ao editor', async () => {
    const { redator, editor } = await rodar('negativos');
    expect(redator).toContain('CAMADA DE COMENTÁRIO');
    expect(redator).toMatch(/DIREÇÃO DO COMENTÁRIO: CRÍTICA/);
    expect(editor).toContain('ESTA MATÉRIA LEVA COMENTÁRIO OPINATIVO');
  });

  it('sem a escolha, nenhum dos dois agentes é alterado', async () => {
    const { redator, editor } = await rodar(undefined);
    expect(redator).not.toContain('CAMADA DE COMENTÁRIO');
    expect(editor).not.toContain('COMENTÁRIO OPINATIVO');
  });
});

describe('a escolha fica gravada na matéria', () => {
  const base = {
    style: 'Jornalístico', tone: 'Neutro', manualText: 'pauta', extractionId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    result: { content: 'texto', model: 'm' },
  };

  it('modo rápido guarda a direção escolhida', () => {
    const g = A.assembleFastGeneration({
      ...base, comentarios: 'ambos',
      built: { originalCharCount: 5, finalCharCount: 5, wasTruncated: false },
    });
    expect(g.comentarios).toBe('ambos');
  });

  it('modo agentes guarda a direção escolhida', () => {
    const g = A.assembleAgentsGeneration({
      ...base, comentarios: 'negativos', combinedText: 'pauta',
      result: { ...base.result, interpretation: {}, article: {}, optimization: {}, agents: {} },
    });
    expect(g.comentarios).toBe('negativos');
  });

  it('matéria gerada sem o controle fica marcada como "nenhum"', () => {
    // Retrocompatibilidade: matérias antigas não têm o campo; o histórico não
    // pode mostrar selo de comentário onde nunca houve comentário.
    const g = A.assembleFastGeneration({
      ...base, built: { originalCharCount: 5, finalCharCount: 5, wasTruncated: false },
    });
    expect(g.comentarios).toBe('nenhum');
    expect(A.comentarioAtivo(g.comentarios)).toBe(false);
    expect(A.comentarioAtivo(undefined)).toBe(false);
  });
});
