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
      'causoOriginalidade', 'causoAssinatura', 'causoCurvaDoExagero', 'causoAbsurdoPresente',
      'causoFantasia', 'CAUSO_FANTASIA', 'conferirCausoLocal',
      'julgarCauso', 'escolherConceito', 'causoMemoriaDe', 'normalizarConceitos',
      'normalizarDossie', 'normalizarCritica', 'buildConceitosPrompt', 'buildDossiePrompt',
      'buildContarPrompt', 'buildCriticoPrompt', 'buildReescreverCausoPrompt',
      'runCausoPipeline']);
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
  // A escada é de TAMANHO. A versão anterior terminava em "o peixe falando" —
  // fantasia, exatamente o que faz o espectador sair do vídeo.
  curvaExagero: ['a canoa voltou torta', 'o peixe não coube no balde', 'o peixe entortou o motor e ninguém conseguiu pesar'],
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

  it('o exagero parte do real — não do impossível', () => {
    // Correção de rota: a doutrina anterior mandava o impossível acontecer e
    // dava "o peixe fala" como exemplo. A ferramenta obedeceu e passou a
    // entregar reino encantado, que é o que faz o espectador sair do vídeo.
    const p = C.buildContarPrompt(DOSSIE, {});
    expect(p).toMatch(/o absurdo é de TAMANHO, não de natureza/);
    expect(p).toMatch(/A coisa EXISTE; o que não existe é aquele tamanho/);
    expect(p, 'o exemplo que estragou não pode voltar').not.toMatch(/o peixe fala/);
  });

  it('a dúvida é o produto — e está escrita como teste', () => {
    const p = C.buildContarPrompt(DOSSIE, {});
    expect(p).toMatch(/TESTE DA PULGA ATRÁS DA ORELHA/);
    expect(p).toMatch(/SEM SABER se acredita/);
    expect(p).toMatch(/ela para de ouvir/);
  });

  it('a fantasia é proibida com nome e sobrenome', () => {
    const p = C.buildContarPrompt(DOSSIE, {});
    ['fada', 'magia', 'reino encantado', 'bicho que fala'].forEach((x) => expect(p, x).toContain(x));
    expect(p).toMatch(/assombração, ela NUNCA é confirmada/);
  });

  it('a doutrina diz para que o causo existe — e é para divertir', () => {
    // Faltava isto: nenhum prompt dizia que o objetivo era fazer rir, e
    // "verdadeiro" estava sendo lido como "sóbrio".
    [C.buildConceitosPrompt('x', {}), C.buildDossiePrompt({ genero: 'pescador' }, 'x', {}),
      C.buildContarPrompt(DOSSIE, {})].forEach((p, i) => {
      expect(p, `prompt ${i}`).toMatch(/Para DIVERTIR/);
      expect(p, `prompt ${i}`).toMatch(/que mentira mais absurda/);
    });
  });

  it('a seriedade é do contador, não da história', () => {
    // O reenquadramento que libera o absurdo sem perder a autenticidade.
    const p = C.buildContarPrompt(DOSSIE, {});
    expect(p).toMatch(/QUEM É SÉRIO AQUI É O CONTADOR, NÃO A HISTÓRIA/);
    expect(p).toMatch(/bem escrita e sóbria é um defeito/);
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
    notasBoas(['humor', 'absurdo', 'ritmo']),
    notasBoas(['exagero', 'absurdo']),
  ];

  it('roda concepção → dossiê → contar → críticos e entrega', async () => {
    const call = dublar(respostasAprovando());
    const r = await C.runCausoPipeline({ ideia: 'uma história de pescador sobre um peixe impossível', call });
    expect(r.conteudo).toBe(CAUSO_BOM);
    expect(r.etapas).toEqual(['conceitos', 'dossie', 'contar', 'criticos']);
    expect(r.juizo.aprovado).toBe(true);
    // 3 sequenciais + 5 críticos em paralelo (o de humor passou a ler sempre).
    expect(call.chamadas()).toBe(8);
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
      { notas: [{ dimensao: 'humor', nota: 8 }, { dimensao: 'absurdo', nota: 8 }] },
      { notas: [{ dimensao: 'exagero', nota: 8 }] },
      CAUSO_BOM,
      notasBoas(['coerencia', 'causalidade', 'personagens', 'final']),
      notasBoas(['oralidade', 'ritmo', 'brasilidade', 'autenticidade']),
      notasBoas(['originalidade']),
      notasBoas(['humor', 'absurdo', 'ritmo']),
      notasBoas(['exagero', 'absurdo']),
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
      { notas: [] }, { notas: [] }, { notas: [] }, { notas: [] },
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
      notasBoas(['humor', 'absurdo', 'ritmo']),
      notasBoas(['exagero', 'absurdo']),
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
      { notas: [] }, { notas: [] }, { notas: [] }, { notas: [] },
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
    expect(js).toMatch(/<details class="causo-mesa">/);
    expect(js).toMatch(/média não esconde defeito/);
    expect(ler('styles.css')).toMatch(/\.causo-nota-baixa/);
  });

  it('o estado tem chave própria e é carregado no boot', () => {
    const core = ler('src/core.js');
    expect(core).toMatch(/causos: 'agp\.causos'/);
    expect(core).toMatch(/causos: loadJSON\(STORAGE_KEYS\.causos, \[\]\)/);
  });
});

describe('o aviso de chave não fica na frente de quem quer trabalhar', () => {
  const js = ler('src/causos.js');

  // (Que o aviso não apareça ao abrir a tela é conferido em
  // test/causos-ui.test.js, exercitando `renderCausos` de verdade: a versão
  // anterior deste teste conferia o FORMATO do código e deixava passar o aviso
  // voltando por outro caminho.)

  it('o aviso só aparece quando a tentativa de contar não sai do lugar', () => {
    const iCheca = js.indexOf('if (!causoTemChave()) { causoAvisarSemChave(); return; }');
    const iPipeline = js.indexOf('await runCausoPipeline(');
    expect(iCheca).toBeGreaterThan(0);
    expect(iCheca, 'a checagem tem de vir antes de gastar chamada').toBeLessThan(iPipeline);
  });

  it('a chave é procurada onde ela realmente mora', () => {
    // A primeira versão procurava em `State.settings.groqKey` — lugar que não
    // existe. O resultado era o aviso dar a chave por ausente SEMPRE, mesmo
    // configurada, e nunca sair da tela. `callLLM` lê de `State.apiKeys`.
    expect(js).toMatch(/State\.apiKeys && State\.apiKeys\[provider\]/);
    // A verificação olha o CÓDIGO, não o texto do arquivo: o comentário logo
    // acima cita o lugar errado justamente para explicar o defeito.
    const semComentarios = js.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    expect(semComentarios, 'lugar inexistente de volta').not.toContain('State.settings.groqKey');
    expect(ler('src/llm.js'), 'a fonte da verdade mudou de lugar')
      .toMatch(/const apiKey = State\.apiKeys\[provider\]/);
  });

});

// A MESA EXISTE PARA DIVERTIR
//
// Relatado: os causos saíam com postura séria. Não era ajuste de prompt — eram
// cinco causas somadas, e a dominante estava no CÓDIGO:
//
//   1. `escolherConceito` pontuava novidade de forma, concretude, virada e
//      risco — nada sobre graça. E o prompt mandava variar a natureza ("uma
//      engraçada, outra de emoção"), então 1 em 4 conceitos era cômico e ele
//      concorria por critérios cegos à comédia.
//   2. `humor` tinha piso 6 e `autenticidade`, 8: o refino corria para o sóbrio.
//   3. o crítico de humor lia em 2 dos 5 gêneros.
//   4. a curva do exagero só era medida em história de pescador.
//   5. nenhum prompt dizia que o objetivo era fazer rir.
describe('a graça deixou de ser opcional', () => {
  const comGraca = { titulo: 'A', premissa: 'curta', absurdo: 'o boi subiu no telhado e ficou lá', graca: 'a teimosia do dono' };
  const semGraca = { titulo: 'B', premissa: 'uma premissa bem mais longa e desenvolvida que a outra, com muito detalhe', quer: 'algo', virada: 'algo muda', risco: 'melodrama' };

  it('a escolha prefere o conceito que tem a mentira e o riso declarados', () => {
    // Era a causa dominante: um conceito emocional bem desenvolvido ganhava de
    // um absurdo enxuto, porque a pontuação não olhava a graça.
    const r = C.escolherConceito(C.normalizarConceitos({ conceitos: [semGraca, comGraca] }), {});
    expect(r.escolhido.titulo).toBe('A');
  });

  it('os dois campos atravessam a normalização', () => {
    const [c] = C.normalizarConceitos({ conceitos: [comGraca] });
    expect(c.absurdo).toBe('o boi subiu no telhado e ficou lá');
    expect(c.graca).toBe('a teimosia do dono');
  });

  it('o prompt de conceitos pede os quatro de rir, não um de cada humor', () => {
    const p = C.buildConceitosPrompt('uma história de pescador', {});
    expect(p).toMatch(/AS QUATRO SÃO DE RIR/);
    expect(p, 'a variação por natureza é o que trazia o sério').not.toMatch(/outra de medo, outra absurda, outra de emoção/);
    expect(p).toMatch(/"absurdo":/);
    expect(p).toMatch(/"graca":/);
    expect(p).toMatch(/Ficar séria demais/);
  });

  it('o dossiê carrega o impossível adiante, mesmo se a IA esquecer de repetir', () => {
    const d = C.normalizarDossie({ titulo: 'x' }, comGraca);
    expect(d.absurdo).toBe('o boi subiu no telhado e ficou lá');
    expect(d.graca).toBe('a teimosia do dono');
  });

  it('o contador recebe o impossível como matéria obrigatória', () => {
    const d = Object.assign({}, DOSSIE, { absurdo: 'o peixe chamou ele pelo nome', graca: 'a cara de quem ouviu' });
    const p = C.buildContarPrompt(d, {});
    expect(p).toContain('o peixe chamou ele pelo nome');
    expect(p).toMatch(/Isto ACONTECE na história, e ninguém acha estranho/);
    expect(p).toMatch(/Não explique, não justifique/);
    expect(p).toMatch(/Não anuncie a graça/);
  });
});

describe('quem olha a graça, e com que rigor', () => {
  it('o crítico de humor lê em TODOS os gêneros', () => {
    // Em assombração e lenda ninguém olhava a graça, e a história saía sóbria
    // sem que nada no processo reclamasse.
    C.CAUSO_GENEROS.forEach((g) => {
      expect(C.causoCriticosDe(g.id), g.id).toContain('humor');
    });
  });

  it('e não é convocado duas vezes quando já é o especialista', () => {
    ['engracado', 'vida'].forEach((g) => {
      const cs = C.causoCriticosDe(g);
      expect(cs.filter((x) => x === 'humor').length, g).toBe(1);
    });
    expect(C.causoCriticosDe('pescador').length).toBe(5);
    expect(C.causoCriticosDe('engracado').length).toBe(4);
  });

  it('o especialista do gênero continua entrando por cima', () => {
    expect(C.causoCriticosDe('pescador')).toContain('exagero');
    expect(C.causoCriticosDe('assombracao')).toContain('misterio');
  });

  it('o piso do humor subiu, e o absurdo virou dimensão própria', () => {
    expect(C.causoDimensao('humor').minimo).toBeGreaterThanOrEqual(7);
    const abs = C.causoDimensao('absurdo');
    expect(abs, 'sem dimensão de absurdo ninguém reprova história sóbria').toBeTruthy();
    expect(abs.minimo).toBeGreaterThanOrEqual(7);
  });

  it('alguém pontua o absurdo — e mais de um, de propósito', () => {
    // `julgarCauso` fica com a pior avaliação: dois olhares sobre a mesma
    // dimensão é rede, não desperdício.
    const quemPontua = Object.keys(C.CAUSO_CRITICOS)
      .filter((id) => C.CAUSO_CRITICOS[id].dimensoes.indexOf('absurdo') >= 0);
    expect(quemPontua).toContain('humor');
    expect(quemPontua.length).toBeGreaterThanOrEqual(2);
  });

  it('a autenticidade não foi afrouxada para caber o absurdo', () => {
    // É o que faz o causo soar real, e não estava em questão.
    expect(C.causoDimensao('autenticidade').minimo).toBe(8);
  });
});

describe('a medição pega a história que ficou sóbria', () => {
  const dossieComAbsurdo = Object.assign({}, DOSSIE, { absurdo: 'o peixe chamou ele pelo nome' });

  it('acusa quando o impossível combinado não chegou ao texto', () => {
    const sobrio = 'Zé Macambira voltou do rio. Sentou na venda do Tonho e ficou quieto a tarde toda.';
    const r = C.causoAbsurdoPresente(sobrio, dossieComAbsurdo);
    expect(r.problemas.join(' ')).toMatch(/não aparece na história/);
    expect(r.problemas.join(' ')).toMatch(/bem escrito e sério/);
  });

  it('passa quando o impossível está lá', () => {
    expect(C.causoAbsurdoPresente(CAUSO_BOM, dossieComAbsurdo).problemas).toEqual([]);
  });

  it('sem absurdo declarado, não há o que conferir', () => {
    const r = C.causoAbsurdoPresente('qualquer texto', { absurdo: '' });
    expect(r.problemas).toEqual([]);
    expect(r.conferido).toBe(false);
  });

  it('o achado entra na conferência como problema de absurdo', () => {
    const sobrio = 'Zé Macambira voltou do rio. Sentou na venda do Tonho e ficou quieto a tarde toda.';
    const r = C.conferirCausoLocal(sobrio, dossieComAbsurdo, { genero: 'pescador' });
    expect(r.achados.map((a) => a.dimensao)).toContain('absurdo');
  });

  it('e derruba a nota alta que um crítico tenha dado ao absurdo', () => {
    // O falso positivo da autoavaliação: a IA diz que está absurdo, a conta
    // mostra que o impossível combinado nem está no texto.
    const sobrio = 'Zé Macambira voltou do rio. Sentou na venda do Tonho e ficou quieto a tarde toda.';
    const local = C.conferirCausoLocal(sobrio, dossieComAbsurdo, { genero: 'pescador' });
    const j = C.julgarCauso([{ critico: 'humor', notas: [{ dimensao: 'absurdo', nota: 10 }] }], local.achados);
    expect(j.avaliadas.find((a) => a.dimensao === 'absurdo').nota).toBeLessThan(7);
    expect(j.aprovado).toBe(false);
  });

  it('a curva do exagero passou a valer em qualquer gênero', () => {
    // Antes só rodava em pescador; nos outros quatro ninguém media se o
    // absurdo chegava pronto na primeira frase.
    const invertida = 'O boi era gigante, nunca visto, monstruoso, não cabia no curral. '
      + 'Ele saiu andando. O sol estava alto. Chegou na venda. Sentou no degrau. '
      + 'Pediu uma pinga. Ficou quieto. Foi para casa. Dormiu cedo. Acordou tarde.';
    const r = C.conferirCausoLocal(invertida, { genero: 'assombracao' }, { genero: 'assombracao' });
    expect(r.achados.map((a) => a.dimensao)).toContain('exagero');
  });
});

// O EXAGERO É DE TAMANHO, NÃO DE NATUREZA
//
// Correção de rota, e de um erro meu: a doutrina anterior mandava "a coisa
// IMPOSSÍVEL acontece" e dava como exemplo "o peixe fala, o boi sobe no
// telhado". A ferramenta obedeceu e passou a entregar reino encantado e fada.
//
// O relato do usuário explica por quê: no instante em que a história sai do
// mundo real, quem assiste ganha CERTEZA de que é mentira e pula o vídeo. O
// que sustenta o causo é a dúvida — "será que é verdade?". Um peixe que não
// coube na canoa mantém a dúvida; um peixe que conversa a destrói.
describe('a mentira parte do real', () => {
  it('a doutrina põe a dúvida como teste, e o tamanho como regra', () => {
    [C.buildConceitosPrompt('x', {}), C.buildDossiePrompt({ genero: 'pescador' }, 'x', {}),
      C.buildContarPrompt(DOSSIE, {})].forEach((p, i) => {
      expect(p, `prompt ${i}`).toMatch(/TESTE DA PULGA ATRÁS DA ORELHA/);
      expect(p, `prompt ${i}`).toMatch(/o absurdo é de TAMANHO, não de natureza/);
    });
  });

  it('os exemplos são de coisas que existem, no tamanho errado', () => {
    const p = C.buildContarPrompt(DOSSIE, {});
    expect(p).toMatch(/não coube na canoa/);
    expect(p).toMatch(/duzentos litros/);
    expect(p, 'nada de exemplo fora do mundo').not.toMatch(/peixe fala|boi sobe no telhado|defunto senta/);
  });

  it('o conceito declara de que coisa REAL o exagero parte', () => {
    const p = C.buildConceitosPrompt('uma história de pescador', {});
    expect(p).toMatch(/a coisa REAL de que ele parte/);
    expect(p).toMatch(/NÃO invente coisa que não existe no mundo/);
  });

  it('a assombração nunca é confirmada — a dúvida é o causo', () => {
    const p = C.buildContarPrompt(DOSSIE, {});
    expect(p).toMatch(/NUNCA é confirmada/);
    expect(p).toMatch(/podia ser o boi do vizinho/);
    // E o especialista em mistério cobra isso.
    expect(C.CAUSO_CRITICOS.misterio.olhar.join(' ')).toMatch(/A assombração foi CONFIRMADA/);
  });

  it('o especialista em exagero policia a fronteira do mundo real', () => {
    const c = C.CAUSO_CRITICOS.exagero;
    expect(c.persona).toMatch(/NUNCA sai do mundo real/);
    expect(c.olhar.join(' ')).toMatch(/parte de uma coisa que EXISTE/);
    expect(c.olhar.join(' ')).toMatch(/será que é verdade/);
  });
});

describe('a fantasia é medida, não só proibida', () => {
  it('reconhece o que tira a pessoa do vídeo', () => {
    ['Foi uma fada que apareceu na estrada.', 'O velho tinha um feitiço guardado.',
      'Ali era um reino encantado.', 'Passou um disco voador por cima do curral.',
      'O homem virou lobisomem na esquina.'].forEach((t) => {
      expect(C.causoFantasia(t).problemas.length, t).toBeGreaterThan(0);
    });
  });

  it('pega bicho falando, que foi o exemplo que eu mesmo plantei', () => {
    ['O peixe disse o nome dele.', 'A vaca falou que não ia sair dali.',
      'O cachorro respondeu de mau humor.'].forEach((t) => {
      expect(C.causoFantasia(t).problemas.join(' '), t).toMatch(/bicho falando/);
    });
  });

  it('papagaio fica de fora — papagaio fala mesmo', () => {
    expect(C.causoFantasia('O papagaio falou o nome do delegado.').problemas).toEqual([]);
  });

  it('exagero de tamanho passa limpo', () => {
    ['O peixe não coube na canoa e entortou o motor.',
      'A vaca deu duzentos litros num dia só.',
      'Choveu três meses sem parar naquele ano.',
      'Ele comeu quarenta ovos numa sentada e foi trabalhar.'].forEach((t) => {
      expect(C.causoFantasia(t).problemas, t).toEqual([]);
    });
  });

  it('o causo bom da suíte continua limpo', () => {
    // Ele diz que o peixe "sabia o nome" — o pescador AFIRMANDO isso é a
    // mentira dele, não um bicho falando na cena.
    expect(C.causoFantasia(CAUSO_BOM).problemas).toEqual([]);
  });

  it('não confunde palavra parecida', () => {
    // "fada" dentro de "enfadado", "magia" dentro de "imagina".
    expect(C.causoFantasia('O homem estava enfadado e nem imaginava o tamanho daquilo.').problemas).toEqual([]);
  });

  it('a fantasia entra na conferência como problema de absurdo', () => {
    const r = C.conferirCausoLocal('Uma fada apareceu na beira do rio e resolveu tudo.', DOSSIE, { genero: 'pescador' });
    expect(r.achados.map((a) => a.dimensao)).toContain('absurdo');
    expect(r.fantasia.achadas).toContain('fada');
  });

  it('e derruba a nota alta que o crítico deu ao absurdo', () => {
    const local = C.conferirCausoLocal('O saci apareceu e o cachorro falou com ele.', DOSSIE, { genero: 'pescador' });
    const j = C.julgarCauso([{ critico: 'exagero', notas: [{ dimensao: 'absurdo', nota: 10 }] }], local.achados);
    expect(j.avaliadas.find((a) => a.dimensao === 'absurdo').nota).toBeLessThan(7);
    expect(j.aprovado).toBe(false);
  });

  it('quem REESCREVE também recebe a regra — senão troca a fada por um duende', () => {
    // Achado medindo os prompts de verdade: o reescritor era o único que
    // escreve prosa sem a doutrina. Recebia "tire a fada" e podia obedecer à
    // ordem reincidindo no mesmo defeito, porque ninguém dizia por quê.
    const p = C.buildReescreverCausoPrompt(
      'Uma fada saiu da água.',
      [{ dimensao: 'absurdo', problema: 'saiu do mundo real', ordem: 'tire a fada' }], DOSSIE);
    expect(p).toMatch(/o absurdo é de TAMANHO, não de natureza/);
    expect(p, 'a lista do proibido tem de vir junto').toMatch(/PROIBIDO, sem exceção/);
  });

  it('todo prompt que escreve prosa carrega a doutrina; o do crítico não precisa', () => {
    const escrevem = [C.buildConceitosPrompt('x', {}), C.buildDossiePrompt({ genero: 'pescador' }, 'x', {}),
      C.buildContarPrompt(DOSSIE, {}),
      C.buildReescreverCausoPrompt('t', [{ dimensao: 'ritmo', ordem: 'apertar' }], DOSSIE)];
    escrevem.forEach((p, i) => expect(p, `prompt gerativo ${i}`).toMatch(/Para DIVERTIR/));
    // O crítico julga pelas dimensões dele; a pergunta da dimensão `absurdo` já
    // carrega a fronteira, e a conferência do código não depende dele.
    expect(C.causoDimensao('absurdo').pergunta).toMatch(/sem sair do mundo/);
  });
});
