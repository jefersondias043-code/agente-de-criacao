// CAUSOS — A MESA DE CONTADORES
//
// Ferramenta nova: causo brasileiro a partir de uma ideia de uma linha.
//
// A ressalva que governa o desenho: autoavaliação de LLM tem limite conhecido —
// ela aprova o próprio texto com facilidade e produz falso positivo na
// verificação. Escrever e depois perguntar "ficou bom?" para o mesmo modelo é
// o que NÃO se quis fazer aqui. Então:
//
//   • os críticos são chamadas separadas, cada uma com uma lente própria, e
//     nenhum vê a opinião do outro (crítica que lê crítica vira eco);
//   • o JUIZ é código: recebe as notas, aplica a regra, manda reescrever;
//   • parte da conferência é MEDIDA — uniformidade das frases, repetição contra
//     o que a mesa já contou, continuidade de nomes, curva do exagero, clichê.
//     Isso não depende de a IA ser honesta.
//
// E a regra acima de todas: nota baixa não se esconde na média.
// 95+95+95+95+40 não é 84.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');

let C;
beforeAll(() => {
  clearStorage();
  C = loadModules(['catalogs.js', 'core.js', 'poster-templates.js', 'agents.js', 'causos-motor.js'],
    ['CAUSO_GENEROS', 'CAUSO_DIMENSOES', 'CAUSO_CRITICOS', 'causoGenero', 'causoDimensao',
      'causoCriticosDe', 'causoCliches', 'causoOralidade', 'causoContinuidade',
      'causoOriginalidade', 'causoAssinatura', 'causoCurvaDoExagero', 'conferirCausoLocal',
      'julgarCauso', 'escolherConceito', 'causoMemoriaDe', 'normalizarConceitos',
      'normalizarDossie', 'normalizarCritica', 'buildConceitosPrompt', 'buildDossiePrompt',
      'buildContarPrompt', 'buildCriticoPrompt', 'buildReescreverCausoPrompt',
      'runCausoPipeline', 'avaliarCauso', 'revisarCausoExistente']);
});

/* Um causo que soa contado: frases de fôlego irregular, emendas de fala,
 * gente com nome, lugar com nome. */
const CAUSO_BOM = `Zé Macambira voltou do rio com a canoa quase de lado.
Ninguém perguntou nada, porque perguntar era o que ele queria.
Aí ele largou o remo na areia, sentou no degrau da venda do Tonho, pediu uma pinga e ficou calado um tempo bom, olhando a ponte.
Foi só quando o Tonho encostou o copo no balcão que ele disse que o peixe sabia o nome dele.
O cachorro do Tonho levantou a orelha.
Ninguém riu na hora, e é isso que eu acho mais estranho até hoje, porque a gente ria de tudo que o Zé dizia, sempre, todo santo dia daquele verão inteiro.`;

const DOSSIE = {
  titulo: 'O peixe que sabia o nome',
  genero: 'pescador',
  estrutura: 'a mentira sustentada até virar dúvida',
  personagens: [
    { nome: 'Zé Macambira', fama: 'mentiroso que ninguém pega', quer: 'ser acreditado uma vez', jeito: 'fala pouco e espera', mania: 'olha a ponte antes de mentir' },
    { nome: 'Tonho', fama: 'dono da venda', quer: 'ouvir o fim', jeito: 'pergunta rindo', mania: 'bate o copo no balcão' },
  ],
  mundo: { lugar: 'beira do rio', pontos: ['a venda do Tonho', 'a ponte velha'], costume: 'todo mundo espera a canoa', detalhes: ['o cachorro'] },
  voz: { quem: 'um sobrinho do Zé, já velho', relacao: 'estava lá', porqueConta: 'ninguém mais lembra' },
  beats: ['a canoa chega torta', 'o silêncio na venda', 'a frase do peixe'],
  curvaExagero: ['a canoa torta', 'o peixe grande', 'o peixe falando'],
  obrigatorio: ['o cachorro'], proibido: ['moral no fim'],
  final: 'ninguém ri, e fica assim',
};

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
  call.chamadas = () => i;
  return call;
};

const CONCEITOS = {
  conceitos: [
    { titulo: 'O peixe que sabia o nome', genero: 'pescador', premissa: 'Um pescador diz que o peixe o chamou pelo nome e a vila inteira decide se acredita ou não nele.', quem: 'Zé Macambira', quer: 'ser acreditado uma vez', virada: 'ninguém ri', estrutura: 'a mentira sustentada até virar dúvida', porqueFunciona: 'a dúvida é do ouvinte', risco: 'virar piada pronta' },
    { titulo: 'A rede vazia', genero: 'vida', premissa: 'Um homem volta sem peixe todo dia e a mulher descobre por quê.', quem: 'o marido', quer: 'esconder', virada: 'a mulher já sabia', estrutura: 'segredo às avessas', porqueFunciona: 'dói', risco: 'melodrama' },
  ],
};

describe('a mesa e quem ela convoca', () => {
  it('cada gênero traz um contexto próprio e um especialista', () => {
    C.CAUSO_GENEROS.forEach((g) => {
      expect(g.id, JSON.stringify(g)).toMatch(/^[a-z]+$/);
      expect(g.label, g.id).toBeTruthy();
      expect(g.ctx.length, `${g.id}: contexto raso`).toBeGreaterThan(60);
      expect(C.CAUSO_CRITICOS[g.especialista], `${g.id}: especialista inexistente`).toBeTruthy();
    });
  });

  it('não existe cadeia fixa — o gênero decide quem lê', () => {
    // Uma história de pescador não precisa do mesmo caminho de uma assombração.
    expect(C.causoCriticosDe('pescador')).toContain('exagero');
    expect(C.causoCriticosDe('pescador')).not.toContain('misterio');
    expect(C.causoCriticosDe('assombracao')).toContain('misterio');
    expect(C.causoCriticosDe('engracado')).toContain('humor');
  });

  it('narrativa, oralidade e originalidade leem sempre', () => {
    C.CAUSO_GENEROS.forEach((g) => {
      const cs = C.causoCriticosDe(g.id);
      ['narrativa', 'oralidade', 'originalidade'].forEach((f) => expect(cs, g.id).toContain(f));
    });
  });

  it('cada crítico tem uma CABEÇA diferente, não o mesmo prompt com outro nome', () => {
    const ids = Object.keys(C.CAUSO_CRITICOS);
    const personas = ids.map((id) => C.CAUSO_CRITICOS[id].persona);
    expect(new Set(personas).size, 'dois críticos com a mesma persona').toBe(ids.length);
    ids.forEach((id) => {
      const c = C.CAUSO_CRITICOS[id];
      expect(c.olhar.length, `${id}: pouca coisa para olhar`).toBeGreaterThanOrEqual(4);
      expect(c.dimensoes.length, `${id}: sem dimensão`).toBeGreaterThan(0);
      c.dimensoes.forEach((d) => expect(C.causoDimensao(d), `${id} → ${d}`).toBeTruthy());
    });
  });

  it('nenhum crítico vê a opinião dos outros', () => {
    // Crítica que lê crítica vira eco: some a independência que justifica ter
    // vários. O prompt de um crítico só carrega a história e a medição.
    const motor = ler('src/causos-motor.js');
    expect(motor).toMatch(/nenhum vê a opinião do outro|não vê a opinião dos outros/);
    const p = C.buildCriticoPrompt('oralidade', CAUSO_BOM, DOSSIE, []);
    expect(p).not.toMatch(/outro crítico|os outros disseram/i);
  });
});

describe('a conferência que é medida, não julgada', () => {
  describe('oralidade', () => {
    it('frases todas do mesmo fôlego denunciam texto escrito', () => {
      // Quem conta solta uma de três palavras e emenda uma de trinta. Quem
      // escreve bem tende ao contrário — e é isso que dá para medir.
      const uniforme = [
        'O homem saiu de casa muito cedo naquela manhã fria',
        'Ele caminhou até a beira do rio com passos lentos',
        'A canoa estava amarrada no tronco da árvore antiga',
        'O sol ainda não tinha nascido por trás das montanhas',
        'Ele soltou a corda e empurrou a canoa para a água',
        'A correnteza levou o barco lentamente rio abaixo agora',
      ].join('. ') + '.';
      const r = C.causoOralidade(uniforme);
      expect(r.variacao).toBeLessThan(0.45);
      expect(r.problemas.join(' ')).toMatch(/mesmo fôlego/);
    });

    it('causo contado de verdade passa', () => {
      const r = C.causoOralidade(CAUSO_BOM);
      expect(r.variacao).toBeGreaterThan(0.45);
      expect(r.problemas, r.problemas.join(' | ')).toEqual([]);
    });

    it('palavra de escrivaninha é apontada', () => {
      const r = C.causoOralidade(CAUSO_BOM + ' Outrossim, subitamente o peixe desapareceu.');
      expect(r.problemas.join(' ')).toMatch(/escrivaninha/);
    });

    it('texto curto demais não é julgado', () => {
      // Duas frases não dizem nada sobre fôlego; reprovar ali seria ruído.
      expect(C.causoOralidade('Ele foi. Voltou.').problemas).toEqual([]);
    });
  });

  describe('clichê de causo', () => {
    it('reconhece o que todo gerador produz sozinho', () => {
      ['Era uma noite escura e chuvosa.', 'Ninguém acreditou nele.', 'E nunca mais foi visto.',
        'Até hoje se conta essa história.'].forEach((t) => {
        expect(C.causoCliches(t).length, t).toBeGreaterThan(0);
      });
    });
    it('causo concreto passa limpo', () => {
      expect(C.causoCliches(CAUSO_BOM)).toEqual([]);
    });
  });

  describe('continuidade com o dossiê', () => {
    it('personagem combinado que sumiu é apontado', () => {
      const r = C.causoContinuidade('O rio estava cheio e a ponte tremia.', DOSSIE);
      expect(r.problemas.join(' ')).toMatch(/nenhum dos personagens/);
    });
    it('quando todos estão lá, não reclama de gente', () => {
      const r = C.causoContinuidade(CAUSO_BOM, DOSSIE);
      expect(r.problemas.join(' ')).not.toMatch(/personagens/);
    });
  });

  describe('curva do exagero', () => {
    it('absurdo que chega pronto no começo é apontado', () => {
      // O erro clássico da IA: entregar o impossível na primeira frase, e o
      // resto da história não ter para onde subir.
      const invertida = 'O peixe era gigante, nunca visto, monstruoso, não cabia na canoa. '
        + 'Ele remou de volta. O sol estava alto. Chegou na venda. Sentou no degrau. '
        + 'Pediu uma pinga. Ficou quieto. Foi para casa. Dormiu cedo. Acordou tarde.';
      expect(C.causoCurvaDoExagero(invertida).problemas.join(' ')).toMatch(/absurdo chega pronto|mais forte no começo/);
    });
    it('curva que sobe passa', () => {
      const subindo = 'A canoa voltou torta. O Zé não disse nada. Sentou na venda. '
        + 'Falou que a rede pesou. Depois que quase virou. Depois que o peixe era maior que a canoa. '
        + 'No fim jurou que a coisa nunca vista chamou ele pelo nome, gigante, do tamanho de um boi.';
      expect(C.causoCurvaDoExagero(subindo).problemas).toEqual([]);
    });
  });
});

describe('a memória da mesa', () => {
  const historico = [
    { conteudo: 'Zé Macambira voltou do rio. E ninguém disse nada naquele dia.', dossie: { estrutura: 'a mentira sustentada', genero: 'pescador', personagens: [{ nome: 'Zé Macambira' }] } },
    { conteudo: 'A ponte caiu na cheia. O povo mudou de lugar.', dossie: { estrutura: 'segredo às avessas', genero: 'vida', personagens: [{ nome: 'Tonho' }] } },
  ];

  it('guarda FORMA — abertura, fecho, nome, desenho — e não assunto', () => {
    const m = C.causoMemoriaDe(historico);
    expect(m.nomes).toContain('ze macambira');
    expect(m.estruturas).toContain('a mentira sustentada');
    expect(m.aberturas.length).toBe(2);
    expect(m.fechos.length).toBe(2);
  });

  it('a mesma abertura duas vezes é apontada', () => {
    const m = C.causoMemoriaDe(historico);
    const r = C.causoOriginalidade('Zé Macambira voltou do rio. Outro dia qualquer.', m, {});
    expect(r.problemas.join(' ')).toMatch(/mesma fórmula/);
  });

  it('nome já usado é apontado', () => {
    const m = C.causoMemoriaDe(historico);
    const r = C.causoOriginalidade('História nova aqui.', m, { personagens: [{ nome: 'Zé Macambira' }] });
    expect(r.problemas.join(' ')).toMatch(/nome já usado/i);
  });

  it('a memória não proíbe VOCABULÁRIO — só forma', () => {
    // Ressalva aprendida na marra noutra ferramenta desta plataforma: proibir
    // as palavras do assunto faz a IA trocar a certa pela errada e o resultado
    // piora. Aqui o que se compara é abertura, fecho, nome e desenho — coisas
    // de que existe suprimento infinito.
    const motor = ler('src/causos-motor.js');
    expect(motor).toMatch(/não se proíbe palavra nenhuma|Compara-se FORMA/);
    const m = C.causoMemoriaDe(historico);
    // Mesmo assunto (rio, peixe, canoa), forma diferente: passa.
    const r = C.causoOriginalidade('A canoa do rio trouxe o peixe. Fim de tarde na beira.', m, {});
    expect(r.problemas, r.problemas.join(' | ')).toEqual([]);
  });

  it('o bloco de memória no prompt diz que não é proibição de assunto', () => {
    const m = C.causoMemoriaDe(historico);
    const p = C.buildConceitosPrompt('uma história de pescador', m);
    expect(p).toMatch(/Não repita FORMA/);
    expect(p).toMatch(/não é proibição de assunto nem de palavra/);
  });
});

describe('o juiz é código', () => {
  const criticas = [
    { critico: 'narrativa', notas: [
      { dimensao: 'coerencia', nota: 9 }, { dimensao: 'causalidade', nota: 10 },
      { dimensao: 'personagens', nota: 9 }, { dimensao: 'final', nota: 10 }] },
    { critico: 'oralidade', notas: [
      { dimensao: 'oralidade', nota: 10 }, { dimensao: 'ritmo', nota: 9 },
      { dimensao: 'brasilidade', nota: 10 }, { dimensao: 'autenticidade', nota: 4, problema: 'não parece causo de verdade', correcao: 'refazer a voz' }] },
  ];

  it('NOTA BAIXA NÃO SE ESCONDE NA MÉDIA', () => {
    // 9,9,10,9,10,9,10 e um 4: a média passaria fácil. A história não passa.
    const j = C.julgarCauso(criticas, []);
    expect(j.media).toBeGreaterThan(80);
    expect(j.aprovado, 'a média não pode aprovar por cima de um 4').toBe(false);
    expect(j.reprovadas.map((r) => r.dimensao)).toEqual(['autenticidade']);
  });

  it('a ordem de reescrita vem da pior para a menos grave', () => {
    const j = C.julgarCauso([
      { critico: 'x', notas: [
        { dimensao: 'ritmo', nota: 3, correcao: 'apertar o meio' },
        { dimensao: 'final', nota: 6, correcao: 'entregar algo' },
        { dimensao: 'oralidade', nota: 1, correcao: 'soa escrito' }] },
    ], []);
    expect(j.ordens.map((o) => o.dimensao)).toEqual(['oralidade', 'ritmo', 'final']);
  });

  it('tudo acima do mínimo aprova', () => {
    const j = C.julgarCauso([{ critico: 'x', notas: C.CAUSO_DIMENSOES.map((d) => ({ dimensao: d.id, nota: 9 })) }], []);
    expect(j.aprovado).toBe(true);
    expect(j.ordens).toEqual([]);
  });

  it('entre dois críticos, vale quem VIU o defeito', () => {
    // Um crítico que não viu o problema não pode absolver o que outro viu.
    const j = C.julgarCauso([
      { critico: 'a', notas: [{ dimensao: 'ritmo', nota: 10 }] },
      { critico: 'b', notas: [{ dimensao: 'ritmo', nota: 3, problema: 'arrasta no meio' }] },
    ], []);
    expect(j.avaliadas.find((x) => x.dimensao === 'ritmo').nota).toBe(3);
    expect(j.aprovado).toBe(false);
  });

  it('a medição do código derruba a nota alta do crítico', () => {
    // É exatamente o falso positivo que a autoavaliação produz: a IA diz que a
    // oralidade está ótima, e a conta mostra que as frases são todas iguais.
    const j = C.julgarCauso(
      [{ critico: 'oralidade', notas: [{ dimensao: 'oralidade', nota: 10 }] }],
      [{ dimensao: 'oralidade', texto: 'as frases têm todas o mesmo fôlego' }]);
    expect(j.avaliadas.find((x) => x.dimensao === 'oralidade').nota).toBeLessThan(7);
    expect(j.aprovado).toBe(false);
    expect(j.ordens[0].problema).toMatch(/mesmo fôlego/);
  });

  it('nota fora da faixa ou inventada não entra', () => {
    const j = C.julgarCauso([{ critico: 'x', notas: [
      { dimensao: 'dimensao-que-nao-existe', nota: 1 },
      { dimensao: 'ritmo', nota: 'muito bom' }] }], []);
    expect(j.avaliadas).toEqual([]);
  });
});

describe('a concorrência de conceitos', () => {
  it('a escolha é feita no código, não perguntada à IA', () => {
    // Perguntar "qual destes quatro é o melhor?" costuma devolver o primeiro.
    const motor = ler('src/causos-motor.js');
    expect(motor).toMatch(/A escolha é FEITA NO CÓDIGO/);
    expect(motor).toMatch(/costuma devolver o primeiro/);
  });

  it('conceito com desenho já usado perde para um desenho novo', () => {
    const memoria = { estruturas: ['a mentira sustentada até virar dúvida'], generos: [], nomes: [], aberturas: [], fechos: [] };
    const conceitos = C.normalizarConceitos(CONCEITOS);
    const r = C.escolherConceito(conceitos, memoria);
    expect(r.escolhido.estrutura).toBe('segredo às avessas');
  });

  it('sem memória, ganha o mais desenvolvido', () => {
    const conceitos = C.normalizarConceitos(CONCEITOS);
    const r = C.escolherConceito(conceitos, {});
    expect(r.escolhido.titulo).toBe('O peixe que sabia o nome');
    expect(r.ranking.length).toBe(2);
  });

  it('lista vazia não quebra', () => {
    expect(C.escolherConceito([], {})).toBeNull();
  });

  it('o prompt pede caminhos diferentes de verdade, e o risco de cada um', () => {
    const p = C.buildConceitosPrompt('uma história de pescador', {});
    expect(p).toMatch(/QUATRO histórias possíveis/);
    expect(p).toMatch(/não quatro versões da mesma coisa/);
    expect(p).toMatch(/RISCO dela/);
  });
});

describe('a doutrina da mesa', () => {
  it('não tentar parecer folclórico é a regra acima de todas', () => {
    [C.buildConceitosPrompt('x', {}), C.buildDossiePrompt({ genero: 'pescador' }, 'x', {}),
      C.buildContarPrompt(DOSSIE, {})].forEach((p, i) => {
      expect(p, `prompt ${i}`).toMatch(/NÃO tente parecer folclórico/);
      expect(p, `prompt ${i}`).toMatch(/caminho mais curto para a caricatura/);
    });
  });

  it('a tradição entra como DNA, não como texto para copiar', () => {
    expect(C.buildContarPrompt(DOSSIE, {})).toMatch(/DNA, não como texto para copiar/);
    expect(C.buildContarPrompt(DOSSIE, {})).toMatch(/Nunca reproduza uma lenda conhecida/);
  });

  it('o impossível entra como se fosse normal', () => {
    expect(C.buildContarPrompt(DOSSIE, {})).toMatch(/coisa mais normal do mundo/);
  });

  it('o dossiê pede gente, não ficha de cadastro', () => {
    const p = C.buildDossiePrompt({ genero: 'pescador' }, 'x', {});
    expect(p).toMatch(/não ficha de cadastro/);
    expect(p).toMatch(/Zé Macambira/);   // o exemplo do que serve
    expect(p).toMatch(/precisa QUERER alguma coisa/);
  });

  it('o mundo tem nome próprio nas coisas', () => {
    const p = C.buildDossiePrompt({ genero: 'pescador' }, 'x', {});
    expect(p).toMatch(/a venda e o dono dela/);
    expect(p).toMatch(/lembrança de um lugar que existiu/);
  });

  it('quem conta recebe instrução de fôlego variado — o que a conta mede', () => {
    const p = C.buildContarPrompt(DOSSIE, {});
    expect(p).toMatch(/Varie o fôlego das frases/);
    expect(p).toMatch(/palavra de escrivaninha/);
    expect(p).toMatch(/Deixe alguma coisa sem explicação/);
  });

  it('a curva do exagero vai junto quando existe', () => {
    const p = C.buildContarPrompt(DOSSIE, {});
    DOSSIE.curvaExagero.forEach((x) => expect(p).toContain(x));
    expect(p).toMatch(/absurdo inteiro na primeira frase/);
  });

  it('o reescritor recebe só os problemas e é mandado preservar o resto', () => {
    const p = C.buildReescreverCausoPrompt(CAUSO_BOM, [{ dimensao: 'ritmo', problema: 'arrasta', ordem: 'apertar' }], DOSSIE);
    expect(p).toMatch(/lista fechada de problemas/);
    expect(p).toMatch(/O que não está na lista, você não toca/);
    expect(p).toMatch(/Preserve o que funcionou/);
    expect(p).toContain('arrasta');
  });
});

describe('a mesa inteira', () => {
  const notasBoas = (dims) => ({ notas: dims.map((d) => ({ dimensao: d, nota: 9 })) });

  const respostasAprovando = () => [
    CONCEITOS,
    DOSSIE,
    CAUSO_BOM,
    notasBoas(['coerencia', 'causalidade', 'personagens', 'final']),
    notasBoas(['oralidade', 'ritmo', 'brasilidade', 'autenticidade']),
    notasBoas(['originalidade']),
    notasBoas(['exagero', 'humor']),
  ];

  it('roda concepção → dossiê → contar → críticos e entrega', async () => {
    const call = dublar(respostasAprovando());
    const r = await C.runCausoPipeline({ ideia: 'uma história de pescador sobre um peixe impossível', call });
    expect(r.conteudo).toBe(CAUSO_BOM);
    expect(r.etapas).toEqual(['conceitos', 'dossie', 'contar', 'criticos']);
    expect(r.juizo.aprovado).toBe(true);
    // 3 sequenciais + 4 críticos em paralelo.
    expect(call.chamadas()).toBe(7);
  });

  it('convoca o especialista do gênero, e só ele', async () => {
    const call = dublar(respostasAprovando());
    await C.runCausoPipeline({ ideia: 'pescador', call });
    const juntos = call.prompts.join('\n');
    expect(juntos).toContain(C.CAUSO_CRITICOS.exagero.persona);
    expect(juntos, 'mistério não tem o que fazer numa pescaria').not.toContain(C.CAUSO_CRITICOS.misterio.persona);
  });

  it('reprovado, reescreve — e o reescritor recebe só as ordens', async () => {
    const call = dublar([
      CONCEITOS, DOSSIE, 'Era uma noite escura. Ninguém acreditou.',
      { notas: [{ dimensao: 'coerencia', nota: 3, problema: 'não se sustenta', correcao: 'amarrar o meio' }] },
      { notas: [{ dimensao: 'oralidade', nota: 4, problema: 'soa escrito', correcao: 'variar as frases' }] },
      { notas: [{ dimensao: 'originalidade', nota: 2, problema: 'clichê', correcao: 'outra abertura' }] },
      { notas: [{ dimensao: 'exagero', nota: 8 }] },
      CAUSO_BOM,
      notasBoas(['coerencia', 'causalidade', 'personagens', 'final']),
      notasBoas(['oralidade', 'ritmo', 'brasilidade', 'autenticidade']),
      notasBoas(['originalidade']),
      notasBoas(['exagero', 'humor']),
    ]);
    const r = await C.runCausoPipeline({ ideia: 'pescador', call });
    expect(r.etapas).toContain('reescrita');
    expect(r.conteudo).toBe(CAUSO_BOM);
    const reescrita = call.prompts.find((p) => /lista fechada de problemas/.test(p));
    expect(reescrita).toContain('outra abertura');
    expect(reescrita).toMatch(/originalidade/);
  });

  it('a reescrita que sai pior é descartada e fica a anterior', async () => {
    const bom = CAUSO_BOM;
    const call = dublar([
      CONCEITOS, DOSSIE, bom,
      { notas: [{ dimensao: 'coerencia', nota: 3, correcao: 'x' }] },
      { notas: [] }, { notas: [] }, { notas: [] },
      'Era uma noite escura. Ninguém acreditou. E nunca mais foi visto.',   // pior
    ]);
    const r = await C.runCausoPipeline({ ideia: 'pescador', call });
    expect(r.conteudo).toBe(bom);
    expect(r.etapas).toContain('reescrita-descartada');
  });

  it('um crítico que falha não derruba a mesa', async () => {
    const call = dublar([
      CONCEITOS, DOSSIE, CAUSO_BOM,
      new Error('sem quota'),
      notasBoas(['oralidade', 'ritmo', 'brasilidade', 'autenticidade']),
      notasBoas(['originalidade']),
      notasBoas(['exagero', 'humor']),
    ]);
    const r = await C.runCausoPipeline({ ideia: 'pescador', call });
    expect(r.conteudo).toBeTruthy();
    expect(r.criticas.find((c) => c.critico === 'narrativa').notas).toEqual([]);
  });

  it('sem conceito não inventa história', async () => {
    const call = dublar(['isto não é json']);
    await expect(C.runCausoPipeline({ ideia: 'x', call })).rejects.toThrow(/história nessa ideia/i);
  });

  it('não reescreve para sempre', async () => {
    const call = dublar([
      CONCEITOS, DOSSIE, 'Era uma noite escura.',
      { notas: [{ dimensao: 'coerencia', nota: 2, correcao: 'x' }] },
      { notas: [] }, { notas: [] }, { notas: [] },
      'Era uma noite escura de novo.',
    ]);
    const r = await C.runCausoPipeline({ ideia: 'x', call });
    expect(r.conteudo).toBeTruthy();
    expect(call.chamadas()).toBeLessThanOrEqual(20);
  });

  it('avisa o progresso etapa por etapa', async () => {
    const vistos = [];
    const call = dublar(respostasAprovando());
    await C.runCausoPipeline({ ideia: 'x', call, onEtapa: (k) => vistos.push(k) });
    expect(vistos).toEqual(['conceitos', 'dossie', 'contar', 'criticos', 'pronto']);
  });

  it('guarda o rastro: conceitos, dossiê, notas e etapas', async () => {
    const call = dublar(respostasAprovando());
    const r = await C.runCausoPipeline({ ideia: 'x', call });
    expect(r.conceitos.length).toBe(2);
    expect(r.conceitoEscolhido.titulo).toBeTruthy();
    expect(r.dossie.personagens.length).toBe(2);
    expect(r.juizo.avaliadas.length).toBeGreaterThan(5);
    expect(r.assinatura.abertura).toBeTruthy();
  });
});

describe('a ferramenta na plataforma', () => {
  const html = ler('index.html');
  const js = ler('src/causos.js');

  it('a tela é um campo só — o gênero não é perguntado', () => {
    const vista = html.slice(html.indexOf('id="view-causos"'), html.indexOf('id="c-history-backdrop"'));
    const campos = (vista.match(/<(input|textarea|select)[^>]*id="/g) || [])
      .filter((t) => !/type="file"/.test(t));
    expect(campos.length, 'apareceu campo além da ideia').toBe(1);
    expect(vista).toContain('id="c-ideia"');
    expect(vista, 'quem decide o gênero é a etapa de concepção').not.toMatch(/id="c-genero"/);
  });

  it('está no menu, no roteamento e no manifesto', () => {
    const app = ler('src/app.js');
    expect(app).toMatch(/id: 'causos'/);
    expect(app).toMatch(/if \(viewId === 'causos'\) renderCausos\(\);/);
    const manifesto = ler('scripts/scripts.manifest.mjs');
    expect(manifesto).toContain("'causos-motor.js'");
    expect(manifesto).toContain("'causos.js'");
    expect(html).toContain('src/causos.js');
  });

  it('o histórico é a memória — apagar tudo avisa disso', () => {
    expect(js).toMatch(/mesa perde também a memória/i);
    expect(js).toMatch(/causoMemoriaDe\(State\.causos/);
  });

  it('a ata da mesa fica à mão, recolhida', () => {
    // Quem quer a história não quer a ata; quem recebeu um causo fraco precisa
    // poder ver em que dimensão ele falhou.
    expect(js).toMatch(/<details class="causo-mesa"/);
    expect(js).toMatch(/média não esconde defeito/);
    expect(ler('styles.css')).toMatch(/\.causo-nota-baixa/);
  });

  it('o estado tem chave própria e é carregado no boot', () => {
    const core = ler('src/core.js');
    expect(core).toMatch(/causos: 'agp\.causos'/);
    expect(core).toMatch(/causos: loadJSON\(STORAGE_KEYS\.causos, \[\]\)/);
  });
});

// O BOTÃO DE REVISAR OS PONTOS FRACOS
//
// A ata acertava os pontos fracos e parava aí: para agir sobre o diagnóstico, a
// única saída era gerar outro causo do zero — jogando fora o texto bom que já
// existia. Agora a ata tem um botão que parte do TEXTO QUE ESTÁ NA TELA, manda
// corrigir só o que o juiz reprovou, e põe a mesa para ler de novo.
//
// A releitura não é luxo: sem ela, a ata exibiria as notas de um texto que não
// está mais na tela — e a precisão da ata é justamente o que se quer preservar.
describe('a revisão a pedido', () => {
  const juizoRuim = {
    pior: 40, aprovado: false,
    reprovadas: [{ dimensao: 'autenticidade', nota: 4, minimo: 8 }],
    ordens: [{ dimensao: 'autenticidade', problema: 'a voz some no meio', ordem: 'manter quem conta presente', nota: 4 }],
  };

  const notasBoas = (dims, nota) => ({ notas: dims.map((d) => ({ dimensao: d, nota: nota || 9 })) });
  const releituraBoa = () => [
    notasBoas(['coerencia', 'causalidade', 'personagens', 'final']),
    notasBoas(['oralidade', 'ritmo', 'brasilidade', 'autenticidade']),
    notasBoas(['originalidade']),
    notasBoas(['exagero', 'humor']),
  ];

  it('reescreve e a mesa lê de novo: 1 + 4 chamadas', async () => {
    const call = dublar([CAUSO_BOM].concat(releituraBoa()));
    const r = await C.revisarCausoExistente({
      texto: 'Era uma noite escura. Ninguém acreditou.',
      dossie: DOSSIE, ordens: juizoRuim.ordens, juizoAnterior: juizoRuim, call,
    });
    expect(call.chamadas()).toBe(5);
    expect(r.conteudo).toBe(CAUSO_BOM);
    expect(r.juizo.aprovado).toBe(true);
    expect(r.melhorou).toBe(true);
  });

  it('parte do texto pronto, não da ideia do usuário', async () => {
    const anterior = 'Era uma noite escura. Ninguém acreditou.';
    const call = dublar([CAUSO_BOM].concat(releituraBoa()));
    await C.revisarCausoExistente({ texto: anterior, dossie: DOSSIE, ordens: juizoRuim.ordens, juizoAnterior: juizoRuim, call });
    expect(call.prompts[0]).toContain(anterior);
    expect(call.prompts[0]).toMatch(/lista fechada de problemas/);
  });

  it('manda corrigir SÓ o que foi reprovado', async () => {
    const call = dublar([CAUSO_BOM].concat(releituraBoa()));
    await C.revisarCausoExistente({ texto: 'x'.repeat(40), dossie: DOSSIE, ordens: juizoRuim.ordens, juizoAnterior: juizoRuim, call });
    const p = call.prompts[0];
    expect(p).toContain('a voz some no meio');
    expect(p).toContain('manter quem conta presente');
    // Nenhuma dimensão que passou pode entrar na lista de correções.
    expect(p).not.toMatch(/\[coerencia\]|\[ritmo\]|\[humor\]/);
  });

  it('a assinatura acompanha o texto novo — é ela que alimenta a memória', () => {
    // Deixá-la para trás guardaria na memória da mesa a abertura de uma versão
    // que não existe mais, e a mesa evitaria repetir uma frase que ninguém leu.
    const call = dublar([CAUSO_BOM].concat(releituraBoa()));
    return C.revisarCausoExistente({ texto: 'Era uma noite escura. Ninguém acreditou.', dossie: DOSSIE, ordens: juizoRuim.ordens, juizoAnterior: juizoRuim, call })
      .then((r) => {
        expect(r.assinatura).toEqual(C.causoAssinatura(CAUSO_BOM));
        expect(r.assinatura.abertura).not.toContain('noite escura');
      });
  });

  it('quando não melhora, diz que não melhorou — e entrega assim mesmo', async () => {
    // Quem pediu a revisão foi o usuário; esconder o resultado dele seria
    // decidir no lugar dele. O desfazer é a rede de proteção, não o silêncio.
    const call = dublar([CAUSO_BOM,
      notasBoas(['coerencia', 'causalidade', 'personagens', 'final']),
      { notas: [{ dimensao: 'oralidade', nota: 9 }, { dimensao: 'ritmo', nota: 9 },
        { dimensao: 'brasilidade', nota: 9 }, { dimensao: 'autenticidade', nota: 3, problema: 'continua sem voz' }] },
      notasBoas(['originalidade']), notasBoas(['exagero', 'humor'])]);
    const r = await C.revisarCausoExistente({ texto: 'texto anterior qualquer', dossie: DOSSIE, ordens: juizoRuim.ordens, juizoAnterior: juizoRuim, call });
    expect(r.melhorou).toBe(false);
    expect(r.conteudo, 'a versão nova é entregue mesmo assim').toBe(CAUSO_BOM);
    expect(r.juizo.aprovado).toBe(false);
  });

  it('reescrita vazia não substitui nada — lança, e o texto anterior fica de pé', async () => {
    const call = dublar(['   ']);
    await expect(C.revisarCausoExistente({ texto: 'o causo bom', dossie: DOSSIE, ordens: juizoRuim.ordens, call }))
      .rejects.toThrow(/continua aí/i);
  });

  it('sem nada reprovado, não há o que revisar', async () => {
    const call = dublar([CAUSO_BOM]);
    await expect(C.revisarCausoExistente({ texto: 'x', dossie: DOSSIE, ordens: [], call }))
      .rejects.toThrow(/não apontou nada/i);
    expect(call.chamadas()).toBe(0);
  });

  it('a releitura usa os críticos do gênero, como a geração', async () => {
    const call = dublar([CAUSO_BOM].concat(releituraBoa()));
    await C.revisarCausoExistente({ texto: 'x'.repeat(40), dossie: DOSSIE, ordens: juizoRuim.ordens, call });
    const juntos = call.prompts.join('\n');
    expect(juntos).toContain(C.CAUSO_CRITICOS.exagero.persona);
    expect(juntos).not.toContain(C.CAUSO_CRITICOS.misterio.persona);
  });
});

describe('a avaliação mora num lugar só', () => {
  it('avaliarCauso devolve conferência, críticas e juízo', async () => {
    const call = dublar([
      { notas: [{ dimensao: 'coerencia', nota: 9 }] },
      { notas: [{ dimensao: 'oralidade', nota: 9 }] },
      { notas: [{ dimensao: 'originalidade', nota: 9 }] },
      { notas: [{ dimensao: 'exagero', nota: 9 }] },
    ]);
    const r = await C.avaliarCauso({ texto: CAUSO_BOM, dossie: DOSSIE, call });
    expect(call.chamadas()).toBe(4);
    expect(r.criticosIds).toEqual(['narrativa', 'oralidade', 'originalidade', 'exagero']);
    expect(r.juizo.avaliadas.length).toBe(4);
    expect(r.local.achados).toEqual([]);
  });

  it('a geração e a revisão usam a MESMA avaliação', () => {
    // Duas cópias divergiriam no primeiro ajuste, e a ata passaria a medir uma
    // coisa enquanto a geração mede outra.
    const motor = ler('src/causos-motor.js');
    const chamadas = (motor.match(/await avaliarCauso\(/g) || []).length;
    expect(chamadas, 'geração e revisão precisam chamar a mesma função').toBe(2);
    expect((motor.match(/Promise\.all\(criticosIds/g) || []).length, 'crítica em dois lugares').toBe(1);
  });
});

describe('a ata virou lugar de agir', () => {
  const js = ler('src/causos.js');

  it('o botão só existe quando há ponto reprovado', () => {
    expect(js).toMatch(/const reprovadas = \(j\.ordens \|\| \[\]\)\.length;/);
    expect(js).toMatch(/const acoes = reprovadas \?/);
  });

  it('a ata fica aberta depois de revisar', () => {
    // Quem clicou num botão de dentro do painel não pode ver o painel se
    // fechar na própria cara.
    expect(js).toMatch(/causoPainelDaMesa\(item, \{ aberto: !!o\.mesaAberta \}\)/);
    expect(js).toMatch(/renderCausoResultado\(item, \{ mesaAberta: true \}\)/);
  });

  it('a memória da revisão EXCLUI o próprio causo', () => {
    // Sem isto, o crítico de originalidade compararia o texto com ele mesmo e
    // acusaria "abertura repetida" em toda revisão.
    expect(js).toMatch(/function causoMemoriaExceto/);
    expect(js).toMatch(/\(State\.causos \|\| \[\]\)\.filter\(\(x\) => x && x\.id !== id\)/);
    expect(js).toMatch(/memoria: causoMemoriaExceto\(item\.id\)/);
  });

  it('guarda um passo atrás e sabe desfazer', () => {
    expect(js).toMatch(/item\.anterior = antes;/);
    expect(js).toMatch(/function desfazerRevisaoCauso/);
    expect(js).toMatch(/item\.anterior = null;/);
  });

  it('o texto, o juízo, as críticas e a assinatura andam juntos', () => {
    ['item.conteudo = res.conteudo', 'item.juizo = res.juizo',
      'item.criticas = res.criticas', 'item.assinatura = res.assinatura'].forEach((t) => {
      expect(js, t).toContain(t);
    });
  });

  it('diz a verdade quando a revisão não melhora', () => {
    expect(js).toMatch(/A revisão não melhorou/);
    expect(js).toMatch(/Dá para desfazer/);
  });
});
