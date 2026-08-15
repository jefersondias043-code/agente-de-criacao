// AFERIDOR — avaliação binária
//
// A ferramenta existe para tirar a nota das mãos da IA. Ela responde SIM ou
// NÃO; o código calcula. Estes testes travam exatamente essa fronteira — se
// algum dia a IA voltar a decidir quanto vale a resposta dela, a suíte quebra.
//
// As três propriedades que fazem a ferramenta valer a pena, e que por isso têm
// teste próprio:
//
//   • REPRODUTÍVEL — as mesmas respostas produzem a mesma nota, sempre, e a
//     conta confere na mão;
//   • CEGA AO PESO — o prompt não carrega peso nenhum, senão saber que uma
//     pergunta vale 10 contamina a resposta;
//   • HONESTA COM A INCERTEZA — o consenso das rodadas é medido e guardado, e
//     empate não fabrica meio acerto.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  A = loadModules(
    ['catalogs.js', 'core.js', 'poster-templates.js', 'agents.js', 'aferidor-motor.js'],
    ['AFER_QUESTOES', 'AFER_BLOCOS', 'AFER_RODADAS', 'AFER_RODADAS_PADRAO', 'AFER_FAIXAS',
      'aferQuestao', 'aferBloco', 'aferQuestoesAplicaveis', 'aferRodadas', 'aferFaixa',
      'buildAferPrompt', 'normalizarRodada', 'consolidarRespostas', 'calcularAfericao',
      'runAfericaoPipeline']);
});

const CONTEUDO = `O Zé Macambira chegou em casa sem a carteira e sem o carro.
A mulher perguntou onde estava o carro.
Ele disse que tinha emprestado pro cunhado por dez minutos, três semanas atrás.
O cunhado mudou de cidade no dia seguinte, levando tudo.`;

/** Uma rodada como o modelo a devolveria. `over` troca respostas por id. */
const rodada = (over, questoes) => ({
  respostas: (questoes || A.AFER_QUESTOES).map((q) => ({
    id: q.id, resposta: over && over[q.id] ? over[q.id] : q.bom,   // padrão: tudo passa
  })),
});

/** IA dublada: cada chamada devolve a rodada da vez (cicla se acabarem). */
const dublar = (roteiro, opcoes) => {
  const o = opcoes || {};
  const prompts = [];
  let i = 0;
  const call = async (prompt) => {
    prompts.push(prompt);
    const n = i++;
    if (o.falharEm && o.falharEm.indexOf(n) >= 0) throw new Error('rodada caiu');
    const r = Array.isArray(roteiro) ? roteiro[n % roteiro.length] : roteiro;
    return { content: JSON.stringify(r), model: 'dublado' };
  };
  call.prompts = prompts;
  return call;
};

/* ========================================================================== */
describe('o questionário só admite pergunta verificável', () => {
  it('toda pergunta declara qual resposta pontua', () => {
    A.AFER_QUESTOES.forEach((q) => {
      expect(['sim', 'nao'], `${q.id}: resposta boa inválida`).toContain(q.bom);
    });
  });

  it('metade das perguntas pontua com NÃO — são as que descrevem defeito', () => {
    // Se todas pontuassem com SIM, a forma da pergunta estaria torcida para
    // caber na régua ("o conteúdo está LIVRE de repetição?"), e uma IA que
    // concorda por educação acertaria todas sem olhar.
    const comNao = A.AFER_QUESTOES.filter((q) => q.bom === 'nao');
    expect(comNao.length, 'nenhuma pergunta de defeito').toBeGreaterThan(3);
  });

  it('id, bloco e peso existem e não se repetem', () => {
    const ids = A.AFER_QUESTOES.map((q) => q.id);
    expect(new Set(ids).size, 'id repetido').toBe(ids.length);
    A.AFER_QUESTOES.forEach((q) => {
      expect(q.peso, `${q.id}: peso inválido`).toBeGreaterThan(0);
      expect(A.aferBloco(q.bloco), `${q.id}: bloco inexistente`).toBeTruthy();
      expect(q.pergunta.length, `${q.id}: pergunta curta demais`).toBeGreaterThan(30);
    });
  });

  it('as rodadas são ímpares — número par inventa empate', () => {
    A.AFER_RODADAS.forEach((n) => expect(n % 2, `${n} é par`).toBe(1));
    expect(A.AFER_RODADAS).toContain(A.AFER_RODADAS_PADRAO);
    expect(A.aferRodadas(4), 'valor fora da lista cai no padrão').toBe(A.AFER_RODADAS_PADRAO);
    expect(A.aferRodadas(undefined)).toBe(A.AFER_RODADAS_PADRAO);
    expect(A.aferRodadas(7)).toBe(7);
  });
});

/* ========================================================================== */
describe('a IA não vê o peso — é o que sustenta a separação', () => {
  it('nenhum peso aparece no prompt', () => {
    const p = A.buildAferPrompt(CONTEUDO, {}, '', A.AFER_QUESTOES);
    A.AFER_QUESTOES.forEach((q) => {
      // O peso não pode aparecer colado ao id da pergunta em lugar nenhum.
      expect(p, `${q.id}: peso vazou`).not.toMatch(new RegExp(`${q.id}[^\\n]*\\b${q.peso}\\b`));
    });
    expect(p, 'a palavra peso não tem o que fazer no prompt').not.toMatch(/peso|pontos|pontuação/i);
  });

  it('nem qual resposta pontua', () => {
    const p = A.buildAferPrompt(CONTEUDO, {}, '', A.AFER_QUESTOES);
    expect(p).not.toMatch(/resposta (certa|boa|esperada)/i);
    expect(p).not.toMatch(/\bbom\b\s*[:=]/i);
  });

  it('nem que existe mais de uma rodada', () => {
    // Saber que é uma entre cinco convida a economizar atenção.
    const p = A.buildAferPrompt(CONTEUDO, {}, '', A.AFER_QUESTOES);
    expect(p).not.toMatch(/rodada|outras leituras|várias vezes/i);
  });

  it('não pede nota, resumo nem opinião de qualidade', () => {
    const p = A.buildAferPrompt(CONTEUDO, {}, '', A.AFER_QUESTOES);
    expect(p).toMatch(/NÃO dá nota/i);
    expect(p).not.toMatch(/de 0 a (10|100)|dê uma nota/i);
  });

  it('todas as perguntas aplicáveis entram, e o conteúdo junto', () => {
    const p = A.buildAferPrompt(CONTEUDO, {}, '', A.AFER_QUESTOES);
    A.AFER_QUESTOES.forEach((q) => expect(p, q.id).toContain(q.id));
    expect(p).toContain('Macambira');
  });

  it('a descrição visual entra separada, quando existe', () => {
    expect(A.buildAferPrompt(CONTEUDO, {}, '', A.AFER_QUESTOES)).not.toMatch(/O QUE SE VÊ/);
    const p = A.buildAferPrompt(CONTEUDO, {}, 'O Zé aparece de chapéu na calçada.', A.AFER_QUESTOES);
    expect(p).toMatch(/== O QUE SE VÊ/);
    expect(p).toContain('chapéu');
  });
});

/* ========================================================================== */
describe('perguntas que não se aplicam saem da conta inteira', () => {
  it('sem título nem legenda, as de embalagem não são perguntadas', () => {
    const qs = A.aferQuestoesAplicaveis({ embalagem: {} });
    expect(qs.some((q) => q.exige === 'embalagem')).toBe(false);
    expect(qs.length).toBeLessThan(A.AFER_QUESTOES.length);
  });

  it('com título, elas voltam', () => {
    const qs = A.aferQuestoesAplicaveis({ embalagem: { titulo: 'O carro sumiu' } });
    expect(qs.length).toBe(A.AFER_QUESTOES.length);
  });

  it('e não entram no DIVISOR — senão a nota mediria o formulário, não o conteúdo', () => {
    // Duas aferições idênticas em tudo, exceto que numa a embalagem não existe.
    // A nota tem de ser a mesma: não escrever o título ainda não é defeito.
    const semEmb = A.aferQuestoesAplicaveis({ embalagem: {} });
    const comEmb = A.aferQuestoesAplicaveis({ embalagem: { titulo: 'x' } });
    const tudoBom = (qs) => A.calcularAfericao(
      A.consolidarRespostas([A.normalizarRodada(rodada({}, qs), qs)], qs), { rodadas: 1 });
    expect(tudoBom(semEmb).nota).toBe(100);
    expect(tudoBom(comEmb).nota).toBe(100);
    expect(tudoBom(semEmb).pesoTotal, 'o divisor precisa encolher junto')
      .toBeLessThan(tudoBom(comEmb).pesoTotal);
  });

  it('pergunta sem voto nenhum também sai do divisor', () => {
    // Todas as rodadas falharam NAQUELA pergunta: ela não foi verificada, então
    // não pode custar pontos. Contá-la no divisor seria descontar por uma
    // observação que não houve.
    const qs = A.AFER_QUESTOES;
    const semUma = { respostas: rodada({}, qs).respostas.filter((r) => r.id !== 'entrega_algo') };
    const r = A.calcularAfericao(
      A.consolidarRespostas([A.normalizarRodada(semUma, qs)], qs), { rodadas: 1 });
    expect(r.nota, 'a pergunta não respondida derrubou a nota').toBe(100);
    expect(r.avaliadas.some((q) => q.id === 'entrega_algo')).toBe(false);
    expect(r.pesoTotal).toBe(135 - A.aferQuestao('entrega_algo').peso);
  });
});

/* ========================================================================== */
describe('a consolidação: várias leituras viram uma resposta', () => {
  const qs = () => A.AFER_QUESTOES;
  const consolidar = (overs) => A.consolidarRespostas(
    overs.map((o) => A.normalizarRodada(rodada(o, qs()), qs())), qs());
  const de = (c, id) => c.find((q) => q.id === id);

  it('vale a resposta predominante — a leitura torta isolada é voto vencido', () => {
    // SIM, SIM, SIM, NÃO, SIM na mesma pergunta.
    const c = consolidar([{}, {}, {}, { abre_no_fato: 'nao' }, {}]);
    const q = de(c, 'abre_no_fato');
    expect(q.sim).toBe(4);
    expect(q.nao).toBe(1);
    expect(q.resposta).toBe('sim');
    expect(q.acertou).toBe(true);
  });

  it('a maioria vira nos dois sentidos', () => {
    const c = consolidar([{ abre_no_fato: 'nao' }, { abre_no_fato: 'nao' }, { abre_no_fato: 'nao' },
      {}, {}]);
    const q = de(c, 'abre_no_fato');
    expect(q.resposta).toBe('nao');
    expect(q.acertou, 'a resposta boa desta pergunta é sim').toBe(false);
  });

  it('o consenso é medido e guardado — 5 de 5 não é 3 de 5', () => {
    const unanime = de(consolidar([{}, {}, {}, {}, {}]), 'abre_no_fato');
    const apertado = de(consolidar([{}, {}, {}, { abre_no_fato: 'nao' }, { abre_no_fato: 'nao' }]), 'abre_no_fato');
    expect(unanime.consenso).toBe(1);
    expect(apertado.consenso).toBeCloseTo(0.6, 5);
    expect(unanime.resposta, 'a resposta consolidada é a mesma nos dois').toBe(apertado.resposta);
  });

  it('empate NÃO pontua — moeda ao ar não é meio acerto', () => {
    const c = consolidar([{}, { abre_no_fato: 'nao' }]);
    const q = de(c, 'abre_no_fato');
    expect(q.empate).toBe(true);
    expect(q.acertou, 'empate virou ponto').toBe(false);
    expect(q.resposta).toBe('nao');
  });

  it('e o empate resolve contra a pergunta, seja qual for a resposta boa', () => {
    // Numa pergunta cuja resposta boa é NÃO, o empate precisa cair em SIM.
    const c = consolidar([{}, { repeticao: 'sim' }]);
    const q = de(c, 'repeticao');
    expect(q.bom).toBe('nao');
    expect(q.empate).toBe(true);
    expect(q.resposta).toBe('sim');
    expect(q.acertou).toBe(false);
  });
});

/* ========================================================================== */
describe('o normalizador não deixa lixo entrar', () => {
  const qs = () => A.AFER_QUESTOES;

  it('aceita as formas que o modelo realmente devolve', () => {
    const m = A.normalizarRodada({ respostas: [
      { id: 'abre_no_fato', resposta: 'SIM' },
      { id: 'sem_preambulo', resposta: 'Não.' },
      { id: 'assunto_claro', resposta: ' sim ' },
      { id: 'progride', resposta: 'nao' },
    ] }, qs());
    expect(m.get('abre_no_fato')).toBe('sim');
    expect(m.get('sem_preambulo')).toBe('nao');
    expect(m.get('assunto_claro')).toBe('sim');
    expect(m.get('progride')).toBe('nao');
  });

  it('descarta id que não existe', () => {
    const m = A.normalizarRodada({ respostas: [
      { id: 'pergunta_inventada', resposta: 'sim' },
      { id: 'abre_no_fato', resposta: 'sim' },
    ] }, qs());
    expect(m.size).toBe(1);
    expect(m.has('pergunta_inventada')).toBe(false);
  });

  it('descarta resposta que não é sim nem não — e NÃO chuta para o lado bom', () => {
    // Chutar seria devolver pela janela a subjetividade que a ferramenta tira
    // pela porta. Sem resposta reconhecível, aquela rodada não votou.
    ['talvez', 'parcialmente', '', null, 7, 'depende do contexto'].forEach((v) => {
      const m = A.normalizarRodada({ respostas: [{ id: 'abre_no_fato', resposta: v }] }, qs());
      expect(m.has('abre_no_fato'), `"${v}" virou voto`).toBe(false);
    });
  });

  it('resposta repetida para o mesmo id: vale a primeira', () => {
    const m = A.normalizarRodada({ respostas: [
      { id: 'abre_no_fato', resposta: 'sim' },
      { id: 'abre_no_fato', resposta: 'nao' },
    ] }, qs());
    expect(m.get('abre_no_fato')).toBe('sim');
  });

  it('payload quebrado devolve rodada vazia, sem estourar', () => {
    [null, undefined, {}, { respostas: null }, { respostas: 'sim' }, { outra: [] }]
      .forEach((o) => expect(A.normalizarRodada(o, qs()).size).toBe(0));
  });
});

/* ========================================================================== */
describe('o cálculo é do código, e confere na mão', () => {
  const qs = () => A.AFER_QUESTOES;
  const calcular = (over) => A.calcularAfericao(
    A.consolidarRespostas([A.normalizarRodada(rodada(over, qs()), qs())], qs()), { rodadas: 1 });

  it('tudo certo é 100; tudo errado é 0', () => {
    expect(calcular({}).nota).toBe(100);
    const tudoErrado = {};
    qs().forEach((q) => { tudoErrado[q.id] = q.bom === 'sim' ? 'nao' : 'sim'; });
    expect(calcular(tudoErrado).nota).toBe(0);
  });

  it('a nota é peso dos acertos sobre peso do que se aplicava', () => {
    // Erra só `entrega_algo` (peso 10) num total de 135.
    const r = calcular({ entrega_algo: 'nao' });
    expect(r.pesoTotal).toBe(135);
    expect(r.pesoGanho).toBe(125);
    expect(r.nota).toBe(Math.round((125 / 135) * 100));
    expect(r.nota).toBe(93);
  });

  it('errar uma pergunta cara custa mais do que errar uma barata', () => {
    const caro = calcular({ entrega_algo: 'nao' });      // peso 10
    const barato = calcular({ cta_artificial: 'sim' });  // peso 3
    expect(caro.nota).toBeLessThan(barato.nota);
    expect(barato.pesoGanho - caro.pesoGanho).toBe(10 - 3);
  });

  it('as mesmas respostas produzem sempre a mesma nota', () => {
    const over = { entrega_algo: 'nao', repeticao: 'sim', previsivel: 'sim' };
    const notas = Array.from({ length: 6 }, () => calcular(over).nota);
    expect(new Set(notas).size, 'a conta variou entre execuções').toBe(1);
  });

  it('"onde a nota foi embora" sai ordenado do mais caro para o mais barato', () => {
    const r = calcular({ cta_artificial: 'sim', entrega_algo: 'nao', frase_de_ia: 'sim' });
    expect(r.perdidos.map((q) => q.id)).toEqual(['entrega_algo', 'frase_de_ia', 'cta_artificial']);
    for (let i = 1; i < r.perdidos.length; i++) {
      expect(r.perdidos[i - 1].peso).toBeGreaterThanOrEqual(r.perdidos[i].peso);
    }
  });

  it('o que passou não vira tarefa', () => {
    const r = calcular({ entrega_algo: 'nao' });
    expect(r.perdidos.map((q) => q.id)).toEqual(['entrega_algo']);
  });

  it('cada bloco tem a própria nota, pela mesma conta', () => {
    const r = calcular({ entrega_algo: 'nao' });
    const entrega = r.porBloco.find((b) => b.id === 'entrega');
    expect(entrega.peso).toBe(32);
    expect(entrega.nota).toBe(Math.round((22 / 32) * 100));
    const abertura = r.porBloco.find((b) => b.id === 'abertura');
    expect(abertura.nota, 'bloco intacto não devia ser afetado').toBe(100);
  });

  it('a faixa é rótulo do número, e nunca decide nada', () => {
    expect(A.aferFaixa(100).id).toBe('alto');
    expect(A.aferFaixa(85).id).toBe('alto');
    expect(A.aferFaixa(84).id).toBe('bom');
    expect(A.aferFaixa(70).id).toBe('bom');
    expect(A.aferFaixa(69).id).toBe('medio');
    expect(A.aferFaixa(49).id).toBe('baixo');
    expect(A.aferFaixa(0).id).toBe('baixo');
  });

  it('sem observação nenhuma a nota é zero, não cem', () => {
    // Divisor vazio: nada foi verificado. Devolver 100 seria premiar o vazio.
    const r = A.calcularAfericao([], { rodadas: 0 });
    expect(r.nota).toBe(0);
    expect(r.pesoTotal).toBe(0);
  });
});

/* ========================================================================== */
describe('a aferição inteira, de ponta a ponta', () => {
  it('roda o questionário o número pedido de vezes, com o MESMO prompt', async () => {
    const call = dublar(rodada({}));
    const r = await A.runAfericaoPipeline({ conteudo: CONTEUDO, rodadas: 5, call });
    expect(call.prompts.length).toBe(5);
    expect(new Set(call.prompts).size, 'as rodadas precisam ser idênticas').toBe(1);
    expect(r.resultado.nota).toBe(100);
    expect(r.rodadasValidas).toBe(5);
  });

  it('três rodadas discordando: a maioria decide e o consenso registra', async () => {
    const bom = rodada({});
    const ruim = rodada({ entrega_algo: 'nao' });
    const r = await A.runAfericaoPipeline({ conteudo: CONTEUDO, rodadas: 3, call: dublar([bom, ruim, bom]) });
    const q = r.resultado.questoes.find((x) => x.id === 'entrega_algo');
    expect(q.resposta).toBe('sim');
    expect(q.acertou).toBe(true);
    expect(q.consenso).toBeCloseTo(2 / 3, 5);
    expect(r.resultado.divergentes.map((x) => x.id)).toContain('entrega_algo');
  });

  it('uma rodada que cai não derruba a aferição — o divisor se ajusta', async () => {
    const call = dublar(rodada({}), { falharEm: [2] });
    const r = await A.runAfericaoPipeline({ conteudo: CONTEUDO, rodadas: 5, call });
    expect(r.falhas).toBe(1);
    expect(r.rodadasValidas).toBe(4);
    expect(r.resultado.nota).toBe(100);
  });

  it('mas TODAS caindo é erro — nota tirada de zero observação não é nota', async () => {
    const call = dublar(rodada({}), { falharEm: [0, 1, 2] });
    await expect(A.runAfericaoPipeline({ conteudo: CONTEUDO, rodadas: 3, call }))
      .rejects.toThrow(/nenhuma das leituras/i);
  });

  it('recusa conteúdo vazio em vez de aferir o nada', async () => {
    await expect(A.runAfericaoPipeline({ conteudo: '   ', call: dublar(rodada({})) }))
      .rejects.toThrow(/conteúdo/i);
  });

  it('sem função de chamada, diz isso em vez de falhar torto', async () => {
    await expect(A.runAfericaoPipeline({ conteudo: CONTEUDO, call: null, rodadas: 3 }))
      .rejects.toThrow();
  });

  it('as etapas saem na ordem, para a tela poder acompanhar', async () => {
    const vistas = [];
    await A.runAfericaoPipeline({
      conteudo: CONTEUDO, rodadas: 3, call: dublar(rodada({})),
      onEtapa: (k) => vistas.push(k),
    });
    expect(vistas).toEqual(['rodadas', 'calculo', 'pronto']);
  });

  it('com embalagem, o questionário cresce e a IA recebe o título', async () => {
    const semTitulo = dublar(rodada({}));
    await A.runAfericaoPipeline({ conteudo: CONTEUDO, rodadas: 3, call: semTitulo });
    const comTitulo = dublar(rodada({}));
    const r = await A.runAfericaoPipeline({
      conteudo: CONTEUDO, rodadas: 3, embalagem: { titulo: 'O cunhado sumiu com o carro' }, call: comTitulo,
    });
    expect(r.questoes.length).toBeGreaterThan(A.aferQuestoesAplicaveis({ embalagem: {} }).length);
    expect(comTitulo.prompts[0]).toContain('O cunhado sumiu com o carro');
    expect(semTitulo.prompts[0]).not.toMatch(/== A EMBALAGEM/);
  });

  it('a IA nunca decide a nota: mexer só no cálculo muda o resultado, mexer na IA não', async () => {
    /* A prova da fronteira. As MESMAS respostas passam por dois cálculos com
     * pesos diferentes e dão notas diferentes — sem a IA ser consultada de
     * novo. É isso que o usuário pediu: mudar a importância de um quesito sem
     * tocar na análise. */
    const call = dublar(rodada({ entrega_algo: 'nao' }));
    const r = await A.runAfericaoPipeline({ conteudo: CONTEUDO, rodadas: 3, call });
    const chamadasGastas = call.prompts.length;

    const consolidado = r.resultado.questoes;
    const comOutroPeso = consolidado.map((q) => (q.id === 'entrega_algo' ? { ...q, peso: 40 } : q));
    const recalculado = A.calcularAfericao(comOutroPeso, { rodadas: 3 });

    expect(recalculado.nota).not.toBe(r.resultado.nota);
    expect(recalculado.nota).toBeLessThan(r.resultado.nota);
    expect(call.prompts.length, 'recalcular não pode custar chamada de IA').toBe(chamadasGastas);
  });
});
