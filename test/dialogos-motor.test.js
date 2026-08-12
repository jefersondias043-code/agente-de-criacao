// DIÁLOGOS NATURAIS — o segundo modo da mesa
//
// Pedido: "utilizar o mesmo conceito de qualidade e profundidade do motor
// atual, porém direcionado para a criação de conversas que pareçam realmente
// acontecer entre pessoas… não deveria parecer um texto narrado ou um roteiro
// artificial."
//
// O QUE ESTES TESTES PROTEGEM. Como no Causos, o prompt pede e o CÓDIGO mede. O
// diálogo escrito por IA falha sempre pelos mesmos lugares, e todos são
// contáveis sem opinião: todo mundo falando igual, ninguém interrompendo
// ninguém, turnos do mesmo tamanho, narrador vazando em rubrica e verbo de
// dizer. É isso que `conferirDialogoLocal` mede — e o que ela acha entra no
// juízo por cima da nota do crítico, que é o antídoto conhecido para a IA
// aprovar o próprio texto.
//
// AS CONTAS SÃO FROUXAS DE PROPÓSITO. A lição do r224 vale aqui inteira: uma
// conferência que produz falso positivo é pior do que conferência nenhuma,
// porque empurra a ferramenta para o defeito oposto. Cobrar 50/50 de turnos
// produziria exatamente o revezamento educado que este modo existe para evitar.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let D;
beforeAll(() => {
  clearStorage();
  D = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'dialogos-motor.js', 'causos-motor.js'],
    ['dialogoTurnos', 'dialogoNarracao', 'dialogoMonopolio', 'dialogoRitmo', 'dialogoVozes',
      'conferirDialogoLocal', 'dialogoBlocoDoutrina', 'dialogoDimensao', 'dialogoCriticosDe',
      'DIALOGO_DIMENSOES', 'DIALOGO_GENEROS', 'buildDialogoConceitosPrompt',
      'buildDialogoDossiePrompt', 'buildDialogoContarPrompt', 'buildDialogoCriticoPrompt',
      'buildDialogoReescreverPrompt', 'julgarCauso', 'causoModo', 'causoModosDisponiveis',
      'CAUSO_MODOS', 'CAUSO_MODO_PADRAO']);
});

/* Uma conversa com o que uma conversa de verdade tem: turno curto, gente que
 * desconversa, tamanhos desiguais, vozes separadas. */
const BOA = `TIÃO: Você viu o preço da carne?
MARISA: Vi.
TIÃO: Vinte e oito reais o quilo do acém, Marisa. Acém. Aquele que a minha mãe dava pro cachorro quando eu era pequeno, hoje é comida de rico, e ninguém fala nada, todo mundo acha normal.
MARISA: Hum.
TIÃO: Você não acha absurdo?
MARISA: Acho que você fala muito de carne pra quem parou de comer carne.
TIÃO: Isso é outra coisa.
MARISA: É a mesma coisa.
TIÃO: Não é não. Uma coisa é eu não comer, outra coisa é o preço estar
MARISA: Tião.
TIÃO: O quê?
MARISA: A gente ia falar da sua irmã.
TIÃO: Eu sei.`;

/* O diálogo escrito por IA: turnos do mesmo tamanho, ninguém corta ninguém,
 * cada pergunta respondida direitinho, todo mundo com o mesmo vocabulário. */
const FALSA = `ANA: Eu realmente acredito que precisamos conversar sobre a situação da casa.
BRUNO: Eu também acredito que precisamos conversar sobre a situação da casa hoje.
ANA: A situação da casa está realmente complicada e precisamos resolver isso logo.
BRUNO: Concordo que a situação está complicada e que precisamos resolver isso logo.
ANA: Podemos começar conversando sobre as contas que estão atrasadas neste mês.
BRUNO: Podemos começar conversando sobre as contas atrasadas deste mês, sim.
ANA: As contas atrasadas realmente precisam da nossa atenção imediata agora.
BRUNO: Nossa atenção imediata é realmente necessária para as contas atrasadas.`;

describe('fatiar a conversa em turnos', () => {
  it('reconhece a etiqueta NOME: fala', () => {
    const { turnos, soltas } = D.dialogoTurnos('TIÃO: Oi.\nMARISA: Oi.');
    expect(turnos.map((t) => t.quem)).toEqual(['TIÃO', 'MARISA']);
    expect(turnos[0].fala).toBe('Oi.');
    expect(soltas).toEqual([]);
  });

  it('reconhece o travessão, sem dono', () => {
    const { turnos } = D.dialogoTurnos('— Oi.\n— Oi, tudo bem?');
    expect(turnos.length).toBe(2);
    expect(turnos[0].quem).toBe('');
    expect(turnos[0].marcado).toBe(false);
  });

  it('linha que não é fala de ninguém fica separada', () => {
    const { turnos, soltas } = D.dialogoTurnos('TIÃO: Oi.\nEle olhou pela janela demoradamente.\nMARISA: Oi.');
    expect(turnos.length).toBe(2);
    expect(soltas).toEqual(['Ele olhou pela janela demoradamente.']);
  });
});

describe('narração vazando — o que transforma conversa em roteiro', () => {
  it('acusa a linha de narrador no meio das falas', () => {
    const r = D.dialogoNarracao('TIÃO: Oi.\nA sala estava escura e cheirava a café velho.\nMARISA: Oi.');
    expect(r.ok).toBe(false);
    expect(r.soltas).toBe(1);
    expect(r.problemas[0]).toMatch(/não são fala de ninguém/i);
  });

  it('acusa o verbo de dizer atribuído', () => {
    const r = D.dialogoNarracao('TIÃO: Sei lá, disse ele.\nMARISA: Oi.');
    expect(r.ok).toBe(false);
    expect(r.atribuicoes).toBe(1);
  });

  it('NÃO acusa alguém contando que outra pessoa falou algo', () => {
    // "ele disse que vinha" é fala legítima; só conta quando é atribuição
    // depois de vírgula ou travessão. Sem essa distinção, a conta reprovaria
    // metade das conversas de verdade — e alarme falso é pior que conta nenhuma.
    const r = D.dialogoNarracao('TIÃO: O Zé disse que vinha hoje.\nMARISA: Ele sempre disse isso.');
    expect(r.ok).toBe(true);
    expect(r.atribuicoes).toBe(0);
  });

  it('acusa rubrica entre parênteses', () => {
    const r = D.dialogoNarracao('TIÃO: (rindo) Não acredito.\nMARISA: Pois é.');
    expect(r.ok).toBe(false);
    expect(r.rubricas).toBe(1);
  });

  it('a conversa boa passa limpa', () => {
    expect(D.dialogoNarracao(BOA).ok).toBe(true);
  });
});

describe('monopólio — conversa é disputa pelo turno, não palestra', () => {
  it('acusa quem toma quase tudo', () => {
    const palestra = ['ANA: ' + 'palavra '.repeat(60),
      'BRUNO: Sei.', 'ANA: ' + 'outra '.repeat(60), 'BRUNO: Hum.',
      'ANA: ' + 'mais '.repeat(60), 'BRUNO: Tá.'].join('\n');
    const r = D.dialogoMonopolio(palestra);
    expect(r.ok).toBe(false);
    expect(r.problemas[0]).toMatch(/viraram plateia/);
  });

  it('não reclama de conversa desigual, que é o normal', () => {
    // Na BOA, o Tião fala bem mais que a Marisa — e é assim que gente conversa.
    const r = D.dialogoMonopolio(BOA);
    expect(r.medido).toBe(true);
    expect(r.ok).toBe(true);
  });

  it('conversa curta demais não é medida — e não é aprovada por omissão', () => {
    const r = D.dialogoMonopolio('ANA: Oi.\nBRUNO: Oi.');
    expect(r.medido).toBe(false);
  });
});

describe('ritmo — ninguém responde só em parágrafo', () => {
  it('acusa a conversa sem nenhuma fala curta', () => {
    const r = D.dialogoRitmo(FALSA);
    expect(r.ok).toBe(false);
    expect(r.problemas[0]).toMatch(/nenhuma fala curta/);
  });

  it('a conversa boa passa: ela tem "Vi.", "Hum.", "Tião."', () => {
    const r = D.dialogoRitmo(BOA);
    expect(r.medido).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.curtos).toBeGreaterThan(2);
  });
});

describe('vozes — tapando as etiquetas, dá para saber quem fala?', () => {
  it('acusa duas pessoas que são a mesma pessoa', () => {
    const r = D.dialogoVozes(FALSA);
    expect(r.ok).toBe(false);
    expect(r.problemas[0]).toMatch(/falam igual/);
  });

  it('a conversa boa passa — os turnos deles não têm o mesmo tamanho', () => {
    const r = D.dialogoVozes(BOA);
    expect(r.medido).toBe(true);
    expect(r.ok).toBe(true);
  });

  it('turnos de tamanho parecido NÃO bastam para acusar — se o vocabulário separa', () => {
    /* O falso positivo que esta conta precisa evitar. Duas pessoas conversando
     * em turnos de tamanho parecido é a coisa mais normal do mundo; o que
     * denuncia a voz única é isso JUNTO com o mesmo vocabulário. Cobrar
     * qualquer uma das duas sozinha reprovaria conversa boa — e conferência que
     * reprova o texto certo empurra a mesa para a caricatura, que é o defeito
     * que este modo mais teme. */
    const parecidos = [
      'DOUTOR: Respiração ofegante desde quando, exatamente? Piora à noite?',
      'SEU ZÉ: Desde que a chuva pegou eu capinando o terreiro.',
      'DOUTOR: Febre aferida em casa? Calafrio? Dor torácica ao inspirar?',
      'SEU ZÉ: Tremedeira danada, doutor, e uma fisgada aqui no vão.',
      'DOUTOR: Tabagismo prévio, ainda que interrompido há algumas décadas?',
      'SEU ZÉ: Fumei palheiro até os quarenta, depois larguei de vez.',
      'DOUTOR: Solicitarei radiografia de tórax e hemograma completo hoje.',
      'SEU ZÉ: O senhor manda, eu obedeço, mas volto pro roçado.',
    ].join('\n');
    const r = D.dialogoVozes(parecidos);
    expect(r.medido).toBe(true);
    expect(r.difTamanho).toBeLessThan(0.25);   // os turnos TÊM tamanho parecido
    expect(r.sobreposicao).toBeLessThan(0.5);  // mas o vocabulário separa
    expect(r.ok).toBe(true);
  });

  it('com mais de duas pessoas, a conta não se aplica e não finge que sim', () => {
    const tres = ['ANA: Oi gente.', 'BRUNO: Oi.', 'CARLA: Oi.', 'ANA: Tudo bem?',
      'BRUNO: Tudo.', 'CARLA: Mais ou menos.'].join('\n');
    const r = D.dialogoVozes(tres);
    expect(r.medido).toBe(false);
    expect(r.problemas).toEqual([]);
  });
});

describe('a conferência do modo, inteira', () => {
  it('a conversa falsa reprova em várias frentes', () => {
    const r = D.conferirDialogoLocal(FALSA, {}, {});
    const dims = new Set(r.achados.map((a) => a.dimensao));
    expect(r.ok).toBe(false);
    expect(dims.has('dinamica')).toBe(true);
    expect(dims.has('vozes')).toBe(true);
  });

  it('a conversa boa não é reprovada pela conta', () => {
    // O contrário do teste acima, e mais importante que ele: uma conferência
    // que reprova o texto certo empurra a mesa para o defeito oposto.
    const r = D.conferirDialogoLocal(BOA, {}, {});
    expect(r.achados.map((a) => a.texto)).toEqual([]);
  });

  it('o que a conta acha entra no juízo por cima da nota do crítico', () => {
    const local = D.conferirDialogoLocal(FALSA, {}, {});
    const criticas = [{ critico: 'ouvido', notas: [{ dimensao: 'vozes', nota: 10, problema: '', correcao: '' }] }];
    const juizo = D.julgarCauso(criticas, local.achados, D.causoModo('dialogos'));
    const vozes = juizo.avaliadas.find((a) => a.dimensao === 'vozes');
    expect(vozes.nota).toBe(5);
    expect(juizo.aprovado).toBe(false);
  });

  it('o juiz do modo diálogos não enxerga dimensão de causo', () => {
    // 'exagero' e 'absurdo' não existem numa conversa: nota nessas dimensões
    // é ruído de um crítico confuso e não pode reprovar a conversa.
    const juizo = D.julgarCauso(
      [{ critico: 'ouvido', notas: [{ dimensao: 'exagero', nota: 1, problema: 'x', correcao: 'y' }] }],
      [], D.causoModo('dialogos'));
    expect(juizo.avaliadas).toEqual([]);
  });
});

describe('a cabeça do modo', () => {
  it('a doutrina proíbe narrador e cobra o teste das etiquetas', () => {
    const d = D.dialogoBlocoDoutrina();
    expect(d).toMatch(/NARRADOR/);
    expect(d).toMatch(/rubrica/i);
    expect(d).toMatch(/tapar os nomes/i);
    expect(d).toMatch(/NINGUÉM EXPLICA O QUE OS DOIS JÁ SABEM/);
  });

  it('o prompt de escrita manda variar o tamanho dos turnos', () => {
    const p = D.buildDialogoContarPrompt({ genero: 'amigos', personagens: [] }, { tamanho: 'medio' });
    expect(p).toMatch(/VARIE O TAMANHO DOS TURNOS/);
    expect(p).toMatch(/NOME: fala/);
    expect(p).toMatch(/pergunta sem resposta/i);
  });

  it('o dossiê cobra o que SEPARA uma pessoa da outra', () => {
    const p = D.buildDialogoDossiePrompt({ genero: 'amigos' }, 'dois amigos no bar', {});
    expect(p).toMatch(/são a mesma pessoa/);
    expect(p).toMatch(/nuncaDiz/);
  });

  it('o crítico recebe só as dimensões que ele olha', () => {
    const p = D.buildDialogoCriticoPrompt('vozes', BOA, {}, []);
    expect(p).toMatch(/vozes —/);
    expect(p).not.toMatch(/subtexto —/);
  });

  it('a reescrita manda preservar o que já funciona', () => {
    const p = D.buildDialogoReescreverPrompt(BOA, [{ dimensao: 'vozes', ordem: 'separe as vozes' }], {});
    expect(p).toMatch(/O QUE JÁ FUNCIONA FICA/);
    expect(p).toMatch(/separe as vozes/);
  });
});

describe('o registro de modos', () => {
  it('o padrão é o Causos', () => {
    expect(D.CAUSO_MODO_PADRAO).toBe('causos');
    expect(D.causoModo(undefined).id).toBe('causos');
    expect(D.causoModo('modo-que-nao-existe').id).toBe('causos');
  });

  it('os dois modos estão disponíveis para a tela', () => {
    const ids = D.causoModosDisponiveis().map((m) => m.id);
    expect(ids).toEqual(['causos', 'dialogos']);
  });

  it('cada modo tem a sua cabeça — nada é compartilhado por engano', () => {
    const c = D.causoModo('causos');
    const d = D.causoModo('dialogos');
    expect(c.doutrina()).not.toBe(d.doutrina());
    expect(c.prompts.contar).not.toBe(d.prompts.contar);
    expect(c.conferir).not.toBe(d.conferir);
    expect(c.dimensoes().map((x) => x.id)).not.toEqual(d.dimensoes().map((x) => x.id));
  });

  it('os modos oferecem tudo o que a tela e o pipeline pedem', () => {
    for (const id of ['causos', 'dialogos']) {
      const m = D.causoModo(id);
      expect(typeof m.criticosDe, id).toBe('function');
      expect(typeof m.conferir, id).toBe('function');
      expect(typeof m.dimensao, id).toBe('function');
      for (const k of ['conceitos', 'dossie', 'contar', 'critico', 'reescrever']) {
        expect(typeof m.prompts[k], `${id}.${k}`).toBe('function');
      }
      expect(m.label && m.descricao && m.exemplo, id).toBeTruthy();
    }
  });

  it('cada gênero de conversa convoca críticos que existem', () => {
    for (const g of D.DIALOGO_GENEROS) {
      const ids = D.dialogoCriticosDe(g.id);
      expect(ids.length, g.id).toBeGreaterThanOrEqual(4);
      for (const c of ids) {
        expect(D.buildDialogoCriticoPrompt(c, 'X: oi', {}, []), `${g.id}/${c}`).toBeTruthy();
      }
    }
  });

  it('toda dimensão que um crítico olha existe na tabela do modo', () => {
    // Um crítico que devolve dimensão inexistente vira nota que o juiz descarta
    // em silêncio — o defeito some sem ninguém saber.
    const olhadas = new Set();
    for (const g of D.DIALOGO_GENEROS) {
      for (const c of D.dialogoCriticosDe(g.id)) {
        const p = D.buildDialogoCriticoPrompt(c, 'X: oi', {}, []);
        for (const m of p.matchAll(/^ {2}(\w+) —/gm)) olhadas.add(m[1]);
      }
    }
    expect(olhadas.size).toBeGreaterThan(5);
    for (const id of olhadas) expect(D.dialogoDimensao(id), id).toBeTruthy();
  });
});
