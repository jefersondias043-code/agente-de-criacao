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
    ['COMENTARIOS', 'COMENTARIO_PROMPTS', 'COMENTARIO_MARCADORES', 'comentarioAtivo',
      'COMENTARIO_MARCADORES_RECONHECIMENTO', 'COMENTARIO_MARCADORES_COBRANCA',
      'comentarioDirecaoAplicada', 'comentarioDirecaoCurta',
      'comentarioLabel', 'comentarioValencias', 'comentarioBloco', 'comentarioAplicado',
      'buildPrompt', 'buildWriterPrompt', 'buildEditorPrompt', 'detectarConflitosDeTom',
      'toneValence', 'assembleFastGeneration', 'assembleAgentsGeneration', 'avisoComentarios']
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
    // A redação mudou junto com a correção do "zero comentário": as frases
    // antigas ("não force", "melhor faltar") eram justamente os tetos que
    // faziam o modelo pular tudo. A proibição de elogio inventado continua —
    // agora sem servir de desculpa para não comentar.
    const b = A.comentarioBloco('positivos', 'Neutro');
    expect(b).toMatch(/DIREÇÃO DO COMENTÁRIO: POSITIVA/);
    expect(b).toMatch(/nunca elogio inventado/);
    expect(b).toMatch(/Entusiasmo não autoriza superlativo sem base/);
    expect(b).toMatch(/ancore cada elogio num fato/i);
  });

  it('negativo critica mesmo material elogioso — mas o ato, não a pessoa', () => {
    const b = A.comentarioBloco('negativos', 'Otimista');
    expect(b).toMatch(/principalmente quando o material de origem é elogioso/i);
    expect(b).toMatch(/não o caráter da pessoa/i);
    expect(b).toMatch(/Não impute crime, fraude ou má-fé/);
    expect(b).toMatch(/Não transforme suspeita em conclusão/);
  });

  it('ambos combina os dois lados sem virar alternância mecânica', () => {
    const b = A.comentarioBloco('ambos', 'Neutro');
    expect(b).toMatch(/OS DOIS LADOS/);
    expect(b).toMatch(/Não é alternância mecânica/);
    expect(b).toMatch(/Equilibrar NÃO é amornar/);
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
    expect(p).toMatch(/12\. DIREÇÃO: releia UM A UM/);
    expect(p).toMatch(/15\. Algum comentário desqualifica uma PESSOA/);
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
    expect(p).toMatch(/CRÍTICO \(cobrança — nunca elogio\)/);   // a direção vai nomeada
    expect(p).toMatch(/nunca o contrário/);                     // e não pode ser invertida
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

describe('o defeito relatado: instrução só de teto produzia zero comentário', () => {
  // O controle aparecia, era escolhido, chegava ao prompt — e a matéria saía
  // idêntica. A causa não era encanamento: o bloco era feito quase só de
  // limites ("no máximo um", "melhor faltar do que forçar", "não force"), e
  // cercado dos avisos anti-invenção do resto do prompt o caminho seguro para
  // o modelo era não comentar nada. Estes testes travam o piso.
  it('manda comentar CADA parágrafo do corpo', () => {
    ['positivos', 'negativos', 'ambos'].forEach((id) => {
      const b = A.comentarioBloco(id, 'Neutro');
      expect(b, id).toMatch(/CADA parágrafo do corpo leva UM comentário/);
      expect(b, id).toMatch(/nem zero, nem dois/);
    });
  });

  it('não deixa mais escapatória para pular o parágrafo', () => {
    const b = A.comentarioBloco('negativos', 'Neutro');
    expect(b).not.toMatch(/melhor faltar do que forçar/);
    expect(b).not.toMatch(/deixe o parágrafo sem comentário/);
    expect(b).toMatch(/NÃO é resposta aceitável/);
    expect(b).toMatch(/não existe parágrafo sem comentário/);
  });

  it('a lacuna é a saída sempre disponível quando falta base', () => {
    const b = A.comentarioBloco('negativos', 'Neutro');
    expect(b).toMatch(/COMENTÁRIO DE LACUNA/);
    expect(b).toMatch(/sempre disponível/);
  });

  it('exige frase inteira, não oração escondida no meio do fato', () => {
    const b = A.comentarioBloco('positivos', 'Neutro');
    expect(b).toMatch(/FRASE INTEIRA/);
    expect(b).toMatch(/oração subordinada escondida/);
  });

  it('cada direção traz exemplo contrastando o fraco com o incisivo', () => {
    ['positivos', 'negativos'].forEach((id) => {
      const b = A.comentarioBloco(id, 'Neutro');
      expect(b, id).toContain('FATO: ');
      expect(b, id).toContain('FRACO (não faça): ');
      expect(b, id).toContain('FORTE (faça): ');
    });
    const ambos = A.comentarioBloco('ambos', 'Neutro');
    expect(ambos).toMatch(/P1: /);
    expect(ambos).toMatch(/P2: /);
  });

  it('o requisito entra no CONTRATO DE SAÍDA dos dois modos', () => {
    // É a linha que o modelo relê ao montar a resposta — a que ele menos ignora.
    const w = A.buildWriterPrompt({ fatos: ['f'], citacoes: [] }, 'Jornalístico', 'Neutro', 'negativos');
    expect(w).toMatch(/"corpo".*CADA UM termina com uma frase de comentário CRÍTICO/);
    const f = A.buildPrompt('Jornalístico', 'Neutro', 'pauta', 'negativos').prompt;
    expect(f).toMatch(/\*Corpo:.*CADA parágrafo termina com uma frase de comentário CRÍTICO/);
    // A direção acompanha a escolha — não é rótulo genérico colado em tudo.
    expect(A.buildWriterPrompt({ fatos: ['f'], citacoes: [] }, 'Jornalístico', 'Neutro', 'positivos'))
      .toMatch(/"corpo".*frase de comentário POSITIVO/);
    expect(A.buildWriterPrompt({ fatos: ['f'], citacoes: [] }, 'Jornalístico', 'Neutro', 'ambos'))
      .toMatch(/"corpo".*alternando reconhecimento e cobrança/);
  });

  it('sem a camada, o contrato de saída fica como era', () => {
    const w = A.buildWriterPrompt({ fatos: ['f'], citacoes: [] }, 'Jornalístico', 'Neutro');
    expect(w).toMatch(/"corpo".*conforme o material comporta/);
    expect(w).not.toMatch(/frase de comentário opinativo/);
  });
});

describe('falha silenciosa vira aviso', () => {
  const marcado = 'A obra foi entregue. O material não informa o custo.';
  const seco = 'A obra foi entregue nesta semana pela Prefeitura do município.';

  it('reconhece as marcas que o próprio prompt ensina', () => {
    expect(A.comentarioAplicado(marcado)).toBe(true);
    expect(A.comentarioAplicado(seco)).toBe(false);
    expect(A.comentarioAplicado('')).toBe(false);
    expect(A.comentarioAplicado(null)).toBe(false);
  });

  it('cada marca ensinada no bloco é reconhecida na saída', () => {
    // Fonte única: se alguém acrescentar uma construção ao prompt sem pôr na
    // lista, a conferência passa a acusar quem cumpriu a instrução.
    A.COMENTARIO_MARCADORES.forEach((m) => {
      expect(A.comentarioAplicado('Texto qualquer. ' + m + ' algo.'), m).toBe(true);
    });
  });

  it('as construções citadas em cada direção estão na lista daquela direção', () => {
    // Fonte única por direção: o prompt cita as primeiras da lista, e é a mesma
    // lista que confere a saída. Se uma sair de sincronia, a conferência passa
    // a acusar quem cumpriu a instrução.
    const neg = A.comentarioBloco('negativos', 'Neutro');
    A.COMENTARIO_MARCADORES_COBRANCA.slice(0, 8).forEach((m) => expect(neg, m).toContain(m));
    const pos = A.comentarioBloco('positivos', 'Neutro');
    A.COMENTARIO_MARCADORES_RECONHECIMENTO.slice(0, 8).forEach((m) => expect(pos, m).toContain(m));
  });

  it('avisa quando pediu comentário e o texto voltou sem marca nenhuma', () => {
    const av = A.avisoComentarios('negativos', seco);
    expect(av.length).toBe(1);
    expect(av[0]).toMatch(/não aplicou os comentários/i);
    expect(av[0]).toMatch(/modelo maior/);   // o aviso diz o que fazer
  });

  it('não avisa quando o comentário apareceu', () => {
    expect(A.avisoComentarios('negativos', marcado)).toEqual([]);
  });

  it('não avisa quando o usuário não pediu comentário', () => {
    expect(A.avisoComentarios('nenhum', seco)).toEqual([]);
    expect(A.avisoComentarios(undefined, seco)).toEqual([]);
  });

  it('o aviso chega na matéria montada, junto dos avisos que já existiam', () => {
    const g = A.assembleFastGeneration({
      style: 'Jornalístico', tone: 'Neutro', comentarios: 'negativos',
      manualText: 'pauta', extractionId: null, createdAt: '2026-01-01T00:00:00.000Z',
      built: { originalCharCount: 5, finalCharCount: 5, wasTruncated: false },
      result: { content: seco, model: 'm' },
    });
    expect(g.warnings.length).toBe(1);
    expect(g.warnings[0]).toMatch(/não aplicou os comentários/i);

    const ok = A.assembleAgentsGeneration({
      style: 'Jornalístico', tone: 'Neutro', comentarios: 'negativos',
      manualText: 'pauta', extractionId: null, combinedText: 'pauta',
      createdAt: '2026-01-01T00:00:00.000Z',
      result: { content: marcado, model: 'm', interpretation: {}, article: {}, optimization: {}, agents: {} },
    });
    expect(ok.warnings).toEqual([]);
  });
});

describe('o defeito relatado: sempre saía comentário positivo', () => {
  // A causa não era encanamento nem falta de instrução: em lugar nenhum se
  // PROIBIA a direção contrária. O prompt descrevia o que fazer sem excluir o
  // oposto — e a direção crítica ainda carregava cinco proibições próprias,
  // somadas a catorze do bloco jurídico, enquanto o elogio corria solto.
  // Diante de pauta institucional, elogiar era o caminho de menor resistência
  // e não violava regra nenhuma.

  it('cada direção proíbe explicitamente a contrária', () => {
    const pos = A.comentarioBloco('positivos', 'Neutro');
    expect(pos).toMatch(/EXCLUSIVIDADE/);
    expect(pos).toMatch(/nenhum comentário crítico/i);
    expect(pos).toMatch(/direção ERRADA/);

    const neg = A.comentarioBloco('negativos', 'Neutro');
    expect(neg).toMatch(/EXCLUSIVIDADE/);
    expect(neg).toMatch(/nenhum comentário elogioso/i);
    expect(neg).toMatch(/direção ERRADA/);
  });

  it('fecha a brecha do meio-termo: ressalva e elogio-com-ressalva', () => {
    expect(A.comentarioBloco('positivos', 'Neutro')).toMatch(/Ressalva também é crítica/);
    expect(A.comentarioBloco('negativos', 'Neutro')).toMatch(/elogio com ressalva/i);
  });

  it('diz que o material de origem NÃO decide a direção', () => {
    const b = A.comentarioBloco('negativos', 'Neutro');
    expect(b).toMatch(/material de origem NÃO decide a direção/i);
    expect(b).toMatch(/Pauta institucional e elogiosa recebe a direção pedida/);
    // Nem os "Ângulos editoriais" que o interpretador extrai da pauta.
    expect(b).toMatch(/Ângulos editoriais.*insumo neutro/s);
  });

  it('a direção crítica deixou de ser só lista de vetos', () => {
    // O reequilíbrio é o que tira o elogio do caminho de menor resistência:
    // a crítica passa a ter um menu concreto de movimentos permitidos.
    const neg = A.COMENTARIO_PROMPTS.negativos;
    expect(neg).toMatch(/O QUE FAZER/);
    ['O QUE FICOU DE FORA', 'O TAMANHO DIANTE DO PROBLEMA', 'O TEMPO',
      'O QUE SEGUE EM ABERTO', 'ANÚNCIO × ENTREGA', 'O SILÊNCIO']
      .forEach((ang) => expect(neg, ang).toContain(ang));
    expect(neg).toMatch(/NUNCA é motivo para elogiar/);
  });

  it('"ambos" exige que os dois lados apareçam de fato', () => {
    const b = A.comentarioBloco('ambos', 'Neutro');
    expect(b).toMatch(/pelo menos UM comentário de reconhecimento E pelo menos UM de cobrança/);
    expect(b).toMatch(/Matéria só elogiosa é o erro mais comum aqui/);
  });

  it('a direção é repetida no contrato de saída e na verificação final', () => {
    const w = A.buildWriterPrompt({ fatos: ['f'], citacoes: [] }, 'Jornalístico', 'Otimista', 'negativos');
    expect(w).toMatch(/"corpo".*CRÍTICO \(cobrança — nunca elogio\)/);
    expect(w).toMatch(/12\. DIREÇÃO: releia UM A UM os comentários/);
    expect(w).toMatch(/erro de execução/i);
  });

  it('o editor não pode inverter a direção ao "melhorar"', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Otimista', [], [], 'negativos');
    expect(p).toMatch(/CRÍTICO \(cobrança — nunca elogio\)/);
    expect(p).toMatch(/nem INVERTER a direção/);
    expect(p).toMatch(/nunca o contrário/);
  });

  it('o rótulo curto da direção acompanha a escolha', () => {
    expect(A.comentarioDirecaoCurta('positivos')).toMatch(/POSITIVO/);
    expect(A.comentarioDirecaoCurta('negativos')).toMatch(/CRÍTICO/);
    expect(A.comentarioDirecaoCurta('ambos')).toMatch(/alternando/);
    expect(A.comentarioDirecaoCurta('nenhum')).toBe('');
  });
});

describe('conferência de DIREÇÃO na saída', () => {
  const soElogio = 'A praça saiu. Cinquenta famílias em uma semana é entrega concreta.';
  const soCobranca = 'A praça saiu. Dois anos depois do prazo, a Prefeitura não informa o custo.';
  const osDois = 'A praça saiu. Cinquenta famílias em uma semana é entrega concreta. Sobre o custo, a Prefeitura não informa nada.';
  const seco = 'A Prefeitura entregou a obra da praça nesta semana.';

  it('separa reconhecimento de cobrança', () => {
    expect(A.comentarioDirecaoAplicada(soElogio, 'positivos')).toMatchObject({ reconhecimento: true, cobranca: false, ok: true });
    expect(A.comentarioDirecaoAplicada(soCobranca, 'negativos')).toMatchObject({ reconhecimento: false, cobranca: true, ok: true });
    expect(A.comentarioDirecaoAplicada(osDois, 'ambos')).toMatchObject({ reconhecimento: true, cobranca: true, ok: true });
  });

  it('acusa exatamente o defeito relatado: pediu crítica, veio elogio', () => {
    const d = A.comentarioDirecaoAplicada(soElogio, 'negativos');
    expect(d.ok).toBe(false);
    const av = A.avisoComentarios('negativos', soElogio);
    expect(av.length).toBe(1);
    expect(av[0]).toMatch(/pediu comentários NEGATIVOS/);
    expect(av[0]).toMatch(/sem nenhuma cobrança/);
  });

  it('acusa o inverso também', () => {
    const av = A.avisoComentarios('positivos', soCobranca);
    expect(av[0]).toMatch(/pediu comentários POSITIVOS/);
    expect(av[0]).toMatch(/sem nenhum reconhecimento/);
  });

  it('em "ambos", acusa o lado que faltou — nomeando qual', () => {
    expect(A.avisoComentarios('ambos', soElogio)[0]).toMatch(/falta a cobrança/);
    expect(A.avisoComentarios('ambos', soCobranca)[0]).toMatch(/falta o reconhecimento/);
    expect(A.avisoComentarios('ambos', osDois)).toEqual([]);
  });

  it('texto sem marca nenhuma continua com o aviso de "não aplicou"', () => {
    expect(A.avisoComentarios('negativos', seco)[0]).toMatch(/não aplicou os comentários/i);
  });

  it('só acusa a AUSÊNCIA do pedido, nunca a presença do outro lado', () => {
    // Um comentário crítico pode legitimamente conter marca de reconhecimento.
    // Reprovar quem cumpriu seria o erro caro; por isso a conferência é
    // lenient nessa direção.
    expect(A.avisoComentarios('negativos', osDois)).toEqual([]);
    expect(A.avisoComentarios('positivos', osDois)).toEqual([]);
  });

  it('sem pedido, não confere nada', () => {
    expect(A.comentarioDirecaoAplicada(seco, 'nenhum').ok).toBe(true);
    expect(A.avisoComentarios('nenhum', seco)).toEqual([]);
  });

  it('todo marcador de cada grupo é reconhecido no seu grupo', () => {
    A.COMENTARIO_MARCADORES_RECONHECIMENTO.forEach((m) => {
      expect(A.comentarioDirecaoAplicada('Fato. ' + m + ' algo.', 'positivos').ok, m).toBe(true);
    });
    A.COMENTARIO_MARCADORES_COBRANCA.forEach((m) => {
      expect(A.comentarioDirecaoAplicada('Fato. ' + m + ' algo.', 'negativos').ok, m).toBe(true);
    });
  });

  it('o aviso de direção chega na matéria montada nos dois modos', () => {
    const base = {
      style: 'Jornalístico', tone: 'Neutro', manualText: 'p', extractionId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const rapido = A.assembleFastGeneration({
      ...base, comentarios: 'negativos',
      built: { originalCharCount: 5, finalCharCount: 5, wasTruncated: false },
      result: { content: soElogio, model: 'm' },
    });
    expect(rapido.warnings[0]).toMatch(/pediu comentários NEGATIVOS/);

    const agentes = A.assembleAgentsGeneration({
      ...base, comentarios: 'negativos', combinedText: 'p',
      result: { content: soElogio, model: 'm', interpretation: {}, article: {}, optimization: {}, agents: {} },
    });
    expect(agentes.warnings[0]).toMatch(/pediu comentários NEGATIVOS/);
  });
});

describe('intensidade: o comentário é veredito, não anotação', () => {
  // Terceiro relato de uso real sobre a mesma funcionalidade: os comentários
  // apareciam e respeitavam a direção, mas saíam discretos demais para o
  // usuário sentir que escolheu alguma coisa. A culpa era dos EXEMPLOS — eu
  // ensinava brandura ("o material não informa o custo") e o modelo copiava o
  // registro do exemplo, não a instrução.

  it('proíbe explicitamente o hedge e a muleta de abertura', () => {
    const b = A.comentarioBloco('negativos', 'Neutro');
    expect(b).toMatch(/INTENSIDADE/);
    ['talvez', 'de certa forma', 'pode-se dizer', 'cabe questionar se',
      'é importante ressaltar', 'vale destacar'].forEach((m) => expect(b, m).toContain(m));
    expect(b).toMatch(/Não peça licença para opinar/);
  });

  it('exige veredito e dá um teste para o modelo se conferir', () => {
    const b = A.comentarioBloco('positivos', 'Neutro');
    expect(b).toMatch(/VEREDITO/);
    expect(b).toMatch(/TESTE FINAL/);
    expect(b).toMatch(/legenda de foto/);
    expect(b).toMatch(/assinadas por qualquer lado da discussão/);
  });

  it('os exemplos contrastam o fraco com o forte em cada direção', () => {
    // É o item que mais move o resultado: o modelo copia o registro do exemplo.
    const neg = A.comentarioBloco('negativos', 'Neutro');
    expect(neg).toMatch(/FRACO \(não faça\): "O material não informa o custo da obra\."/);
    expect(neg).toMatch(/FORTE \(faça\): .*silêncio sobre o valor é a informação mais eloquente/);
    const pos = A.comentarioBloco('positivos', 'Neutro');
    expect(pos).toMatch(/FRACO \(não faça\)/);
    expect(pos).toMatch(/FORTE \(faça\): .*entrega concreta/);
  });

  it('libera a força contra ato, dado, prazo, omissão e INSTITUIÇÃO', () => {
    const b = A.comentarioBloco('negativos', 'Neutro');
    expect(b).toMatch(/Instituição não é blindada/);
    expect(b).toMatch(/A Prefeitura não explica/);
    expect(b).toMatch(/Cobre a conduta pública de quem tem cargo/);
    expect(b).toMatch(/Conduta é alvo legítimo; caráter não é/);
  });

  it('a única linha que segura é o ataque ao caráter — e justificada pela força, não por pudor', () => {
    const b = A.comentarioBloco('negativos', 'Neutro');
    expect(b).toMatch(/único trecho que um advogado consegue derrubar/);
    expect(b).toMatch(/é frágil, atacável e diz pouco/);
    expect(b).toMatch(/devastador, verificável/);
  });

  it('o lado positivo recebe a mesma carga, não só o negativo', () => {
    const pos = A.comentarioBloco('positivos', 'Neutro');
    expect(pos).toMatch(/ENFÁTICA/);
    expect(pos).toMatch(/elogio morno não serve/i);
    expect(pos).toMatch(/sem pedir licença/);
    const amb = A.comentarioBloco('ambos', 'Neutro');
    expect(amb).toMatch(/os dois lados entram com a mesma convicção/i);
    expect(amb).toMatch(/dois comentários mornos que se anulam/);
  });

  it('a crítica dura não afrouxou nenhuma trava de fidelidade', () => {
    const b = A.comentarioBloco('negativos', 'Neutro');
    expect(b).toMatch(/COMENTÁRIO COMENTA, NÃO INFORMA/);
    expect(b).toMatch(/Não impute crime, fraude ou má-fé/);
    expect(b).toMatch(/presunção de inocência/i);
    expect(b).toMatch(/Não transforme suspeita em conclusão/);
  });
});

describe('as listas de marcação não podem colidir', () => {
  it('nenhum marcador de um lado é substring de um marcador do outro', () => {
    // Invariante descoberta na prática: eu havia posto 'é pouco' na cobrança,
    // e ele é substring de 'não é pouco' (reconhecimento) — todo elogio
    // passaria a contar como crítica, e "ambos" ficaria satisfeito só com
    // elogio. Mesmo problema com 'entregou' × 'não entregou'.
    const colisoes = [];
    for (const r of A.COMENTARIO_MARCADORES_RECONHECIMENTO) {
      for (const c of A.COMENTARIO_MARCADORES_COBRANCA) {
        if (c.includes(r)) colisoes.push(`${r} ⊂ ${c}`);
        if (r.includes(c)) colisoes.push(`${c} ⊂ ${r}`);
      }
    }
    expect(colisoes).toEqual([]);
  });

  it('nenhum marcador vira o oposto com um "não" na frente', () => {
    const perigosos = A.COMENTARIO_MARCADORES_RECONHECIMENTO
      .filter((r) => A.COMENTARIO_MARCADORES_COBRANCA.some((c) => c === 'não ' + r || c === 'nao ' + r));
    expect(perigosos).toEqual([]);
  });

  it('elogio incisivo não é lido como cobrança, e vice-versa', () => {
    const elogio = 'Cinquenta famílias em uma semana é entrega concreta.';
    const critica = 'Dois anos depois do prazo, a Prefeitura não informa o custo.';
    expect(A.comentarioDirecaoAplicada(elogio, 'ambos')).toMatchObject({ reconhecimento: true, cobranca: false });
    expect(A.comentarioDirecaoAplicada(critica, 'ambos')).toMatchObject({ reconhecimento: false, cobranca: true });
    // E "ambos" só passa quando os dois estão mesmo lá.
    expect(A.avisoComentarios('ambos', elogio).length).toBe(1);
    expect(A.avisoComentarios('ambos', elogio + ' ' + critica)).toEqual([]);
  });
});
