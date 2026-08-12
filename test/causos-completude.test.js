// CAUSOS — a história não pode terminar cortada (r236)
//
// Relato, depois do r235 (que trouxe o limite de tamanho): "em alguns casos,
// parece que a ferramenta está simplesmente cortando a história no meio para
// conseguir atender ao limite de duração… não deve acontecer de a história
// simplesmente parar depois do clímax, deixando a sensação de que faltou
// alguma coisa." E, sobre onde resolver isso: "antes de desenvolver a
// história, a IA deve saber que está criando um conteúdo destinado a um vídeo
// curto e estruturar os acontecimentos… tudo isso dentro da duração
// pretendida" — ou seja, no PLANO, não como corte depois de pronta.
//
// PRIORIDADE EXPLÍCITA DO PEDIDO: "Se uma determinada história precisar de um
// pouco menos ou um pouco mais de tempo para ser concluída naturalmente, isso
// é preferível a cortar ou mutilar a narrativa." Completude vem antes de
// tamanho. Por isso metade destes testes é sobre o REESCRITOR NÃO PODER
// TROCAR uma completa por uma do tamanho certo.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let C;
beforeAll(() => {
  clearStorage();
  C = loadModules(
    ['catalogs.js', 'core.js', 'poster-templates.js', 'agents.js', 'causos-motor.js'],
    ['causoTerminaAbrupto', 'causoRevisaoPiorou', 'conferirCausoLocal', 'buildDossiePrompt',
      'buildContarPrompt', 'buildReescreverCausoPrompt', 'runCausoPipeline', 'CAUSO_SEG_TETO']);
});

const dublar = (respostas) => {
  const prompts = [];
  let i = 0;
  const call = async (prompt) => {
    prompts.push(prompt);
    const r = respostas[Math.min(i, respostas.length - 1)];
    i++;
    if (r instanceof Error) throw r;
    return { content: typeof r === 'string' ? r : JSON.stringify(r), model: 'dublado' };
  };
  call.prompts = prompts;
  return call;
};

const notasBoas = (dims) => ({ notas: dims.map((d) => ({ dimensao: d, nota: 9 })) });

const CONCEITOS = {
  conceitos: [
    { titulo: 'O peixe que sabia o nome', genero: 'pescador', premissa: 'Um pescador diz que o peixe o chamou pelo nome.', quem: 'Zé', quer: 'ser acreditado', virada: 'ninguém ri', estrutura: 'a mentira sustentada', porqueFunciona: 'a dúvida é do ouvinte', risco: 'virar piada' },
  ],
};
const DOSSIE = {
  titulo: 'O peixe que sabia o nome', genero: 'pescador', estrutura: 'a mentira sustentada',
  personagens: [{ nome: 'Zé Macambira', fama: 'mentiroso', quer: 'ser acreditado', jeito: 'fala pouco' }],
  mundo: { lugar: 'beira do rio', pontos: ['a venda do Tonho'], costume: 'esperar a canoa', detalhes: ['o cachorro'] },
  voz: { quem: 'um sobrinho', relacao: 'estava lá', porqueConta: 'ninguém lembra' },
  beats: ['a canoa torta', 'o silêncio', 'a frase'], curvaExagero: ['canoa torta', 'peixe grande', 'peixe entortou o motor'],
  obrigatorio: ['o cachorro'], proibido: ['moral'], final: 'ninguém ri',
};

const comPalavras = (n) => Array.from({ length: n }, (_, i) => `palavra${i % 40}`).join(' ') + '.';

describe('causoTerminaAbrupto — o sintoma mais grosseiro do corte', () => {
  it('sem pontuação nenhuma no fim é corte', () => {
    const r = C.causoTerminaAbrupto('Ele voltou pra casa e nunca mais falou do peixe');
    expect(r.problemas.length).toBe(1);
    expect(r.problemas[0]).toMatch(/sem terminar a frase/);
  });

  it('termina numa conjunção ou preposição, mesmo com ponto, é corte', () => {
    // Simula o sintoma real: um ponto colado onde a IA parou de gerar.
    expect(C.causoTerminaAbrupto('Ele voltou pra casa e.').problemas.length).toBe(1);
    expect(C.causoTerminaAbrupto('Ele disse que.').problemas.length).toBe(1);
    expect(C.causoTerminaAbrupto('Foi direto para.').problemas.length).toBe(1);
  });

  it('ponto, exclamação ou reticências no fim de uma frase de verdade passam limpos', () => {
    expect(C.causoTerminaAbrupto('Ele nunca mais quis voltar a pescar.').problemas).toEqual([]);
    expect(C.causoTerminaAbrupto('E o motor ficou entortado pra sempre!').problemas).toEqual([]);
    // Reticências são doutrina, não corte: "deixe alguma coisa sem explicação".
    expect(C.causoTerminaAbrupto('Ninguém sabe se foi verdade…').problemas).toEqual([]);
  });

  it('fechar em aspas ou parênteses depois do ponto não é falso positivo', () => {
    expect(C.causoTerminaAbrupto('Ele disse: "nunca mais volto lá."').problemas).toEqual([]);
    expect(C.causoTerminaAbrupto('O motor ficou torto (do jeito que já tinha ficado antes).').problemas).toEqual([]);
  });

  it('terminar numa palavra comum, num nome ou num verbo não é falso positivo', () => {
    // A lista de palavras-de-meio é pequena e específica; não é "qualquer
    // palavra curta". Um substantivo, um nome próprio e um infinitivo comum
    // são o jeito normal de uma frase em português terminar.
    expect(C.causoTerminaAbrupto('Ele guardou tudo dentro da canoa.').problemas).toEqual([]);
    expect(C.causoTerminaAbrupto('Quem contou essa história foi o Zé Macambira.').problemas).toEqual([]);
  });

  it('texto vazio não inventa problema', () => {
    expect(C.causoTerminaAbrupto('').problemas).toEqual([]);
    expect(C.causoTerminaAbrupto('   ').problemas).toEqual([]);
  });
});

describe('a conta entra no juízo pela dimensão `final`', () => {
  it('um texto cortado vira achado de `final`, não de `ritmo`', () => {
    // Dimensão importa: `final` já existe e já tem crítico próprio
    // (narrativa). Cair em `ritmo` por engano juntaria um problema de
    // completude com um problema de tamanho, que são coisas diferentes.
    const local = C.conferirCausoLocal('Ele voltou pra casa e', {}, {});
    const doFinal = local.achados.filter((a) => a.dimensao === 'final');
    expect(doFinal.length).toBe(1);
  });

  it('um texto que termina direito não acrescenta achado nenhum', () => {
    const texto = 'Ele voltou pra casa e nunca mais quis saber de pescaria.';
    const local = C.conferirCausoLocal(texto, {}, {});
    expect(local.achados.filter((a) => a.dimensao === 'final')).toEqual([]);
    expect(local.fim.problemas).toEqual([]);
  });
});

describe('o plano já resolve o tamanho — não é a hora de contar que decide', () => {
  it('o dossiê recebe a janela de tempo e o limite de acontecimentos', () => {
    const p = C.buildDossiePrompt({ genero: 'pescador' }, 'uma ideia', {});
    expect(p).toMatch(/1 minuto e 1min30/);
    expect(p).toMatch(/3 a 5 beats/);
  });

  it('e o dossiê exige que o ÚLTIMO beat seja o desfecho', () => {
    const p = C.buildDossiePrompt({ genero: 'pescador' }, 'uma ideia', {});
    expect(p).toMatch(/o desfecho/);
    expect(p).toMatch(/não é opcional/);
  });
});

describe('contar prioriza completude sobre tamanho', () => {
  it('a ordem de prioridade é explícita, e completude vem primeiro', () => {
    const p = C.buildContarPrompt({ genero: 'pescador' }, {});
    expect(p).toMatch(/a história TEM de estar completa/);
    expect(p).toMatch(/ÚLTIMA das cinco prioridades/);
  });

  it('nunca pare logo depois do ponto alto', () => {
    const p = C.buildContarPrompt({ genero: 'pescador' }, {});
    expect(p).toMatch(/COMEÇO, MEIO E FIM/);
    expect(p).toMatch(/Nunca pare logo depois do ponto alto/);
  });

  it('as instruções do r235 continuam de pé — isto é reforço, não substituição', () => {
    const p = C.buildContarPrompt({ genero: 'pescador' }, {});
    expect(p).toMatch(/NÃO escreva uma história longa e corte no fim/);
    expect(p).toMatch(/CADA FRASE TEM DE FAZER A HISTÓRIA ANDAR/);
    expect(p).toMatch(/TERMINE QUANDO ACABOU/);
  });
});

describe('o reescritor sabe que completude vale mais que tamanho', () => {
  it('completude vem antes do tamanho, com todas as letras', () => {
    const p = C.buildReescreverCausoPrompt('texto', [{ dimensao: 'ritmo', ordem: 'encurte' }], {});
    expect(p).toMatch(/COMPLETUDE VEM ANTES DO TAMANHO/);
    expect(p).toMatch(/encolha menos — ou não encolha/);
  });

  it('pede uma conferência explícita antes de responder', () => {
    const p = C.buildReescreverCausoPrompt('texto', [{ dimensao: 'ritmo', ordem: 'encurte' }], {});
    expect(p).toMatch(/tem começo, meio e fim/);
  });
});

describe('causoRevisaoPiorou — a régua que decide se a reescrita fica', () => {
  const com = (...dims) => ({ achados: dims.map((d) => ({ dimensao: d, texto: 'x' })) });

  it('mais achados no total é sempre pior', () => {
    expect(C.causoRevisaoPiorou(com('ritmo'), com('ritmo', 'oralidade'))).toBe(true);
  });

  it('menos achados no total, sem corte novo, é melhora', () => {
    expect(C.causoRevisaoPiorou(com('ritmo', 'oralidade'), com('ritmo'))).toBe(false);
  });

  it('MESMA contagem, mas um corte novo entrou no lugar de outro problema: é pior', () => {
    // O caso que a trava antiga (só contagem) não pegava: 1 achado antes,
    // 1 depois — só que o depois é um corte que não existia.
    expect(C.causoRevisaoPiorou(com('ritmo'), com('final'))).toBe(true);
  });

  it('um corte que JÁ EXISTIA não é penalizado de novo — não é regressão desta reescrita', () => {
    /* Faltava exatamente este teste: sem ele, uma mutação que descartasse
     * TODA reescrita com `final` presente — mesmo quando o corte já vinha de
     * antes e não mudou — sobrevivia. A diferença importa na prática: se o
     * rascunho original já saía cortado, uma reescrita que arruma OUTRA coisa
     * sem piorar o corte tem de poder ficar; é a próxima volta do juiz que
     * continua livre para cobrar o `final` que ainda está lá. */
    expect(C.causoRevisaoPiorou(com('ritmo', 'final'), com('final'))).toBe(false);
  });

  it('sem achado nenhum nos dois lados, não há o que piorar', () => {
    expect(C.causoRevisaoPiorou(com(), com())).toBe(false);
  });
});

describe('o pipeline nunca troca completude por tamanho', () => {
  /* As duas histórias abaixo mencionam Zé Macambira e a beira do rio (o
   * dossiê exige os dois) para que `coerencia` fique zerada nas duas
   * versões — sobra só a variável que este teste quer isolar. Medido:
   *   longo     → 1 achado (ritmo: 3min42, muito além do teto)
   *   curto     → 0 achados (dentro da janela, termina limpo)
   *   truncado  → 1 achado (final: é o `curto` sem o ponto final) */
  const longo = `Zé Macambira voltou pra casa vindo lá da beira do rio depois de mais uma pescaria qualquer. ${comPalavras(560)}.`;
  const curtoEInteiro = 'Zé Macambira voltou pra casa vindo lá da beira do rio depois de mais uma pescaria qualquer. Contou pro Tonho que dessa vez foi diferente. O peixe puxou a linha com uma força que ele nunca tinha sentido, arrastando a canoa rio abaixo por um bom pedaço, e ele quase caiu duas vezes tentando segurar o pé. Ninguém na venda acreditou de cara. Mas o jeito calado dele de contar deixou todo mundo em dúvida, olhando um pro outro sem saber o que dizer. Voltou com o motor entortado e um sorriso largo. O cachorro do Tonho ficou latindo pro rio a noite inteira.';

  it('reescrita que acerta a duração mas corta o fim é descartada — mesmo com a MESMA contagem de achados', async () => {
    /* O corte é o `curtoEInteiro` de cima sem o ponto final — mesmo conteúdo,
     * só falta a pontuação. `longo` tem 1 achado (ritmo); este truncado
     * TAMBÉM tem 1 (final). A CONTAGEM não muda — a trava antiga (só conta)
     * deixaria passar. É a trava nova (`introduziuCorte`) que tem de pegar
     * isto, porque o defeito TROCOU de dimensão, não desapareceu. */
    const truncado = curtoEInteiro.replace(/\.$/, '');
    const call = dublar([
      CONCEITOS, DOSSIE, longo,
      notasBoas(['coerencia', 'causalidade', 'personagens', 'final']),
      notasBoas(['oralidade', 'ritmo', 'brasilidade', 'autenticidade']),
      notasBoas(['originalidade']),
      notasBoas(['humor', 'absurdo', 'ritmo']),
      notasBoas(['exagero', 'absurdo']),
      truncado,
    ]);
    const r = await C.runCausoPipeline({ ideia: 'pescador', call });
    expect(r.conteudo).toBe(longo);
    expect(r.etapas).toContain('reescrita-descartada');
  });

  it('mas uma reescrita que acerta a duração SEM cortar o fim é aceita normalmente', async () => {
    // Guarda contra falso positivo: a trava nova não pode rejeitar toda
    // reescrita de tamanho — só a que introduz um corte. Aqui a versão
    // curta fica com ZERO achados locais, então a mesa aprova de primeira
    // e nem chega a pedir uma segunda reescrita.
    const call = dublar([
      CONCEITOS, DOSSIE, longo,
      notasBoas(['coerencia', 'causalidade', 'personagens', 'final']),
      notasBoas(['oralidade', 'ritmo', 'brasilidade', 'autenticidade']),
      notasBoas(['originalidade']),
      notasBoas(['humor', 'absurdo', 'ritmo']),
      notasBoas(['exagero', 'absurdo']),
      curtoEInteiro,
      notasBoas(['coerencia', 'causalidade', 'personagens', 'final']),
      notasBoas(['oralidade', 'ritmo', 'brasilidade', 'autenticidade']),
      notasBoas(['originalidade']),
      notasBoas(['humor', 'absurdo', 'ritmo']),
      notasBoas(['exagero', 'absurdo']),
    ]);
    const r = await C.runCausoPipeline({ ideia: 'pescador', call });
    expect(r.conteudo).toBe(curtoEInteiro);
    expect(r.etapas).not.toContain('reescrita-descartada');
  });
});
