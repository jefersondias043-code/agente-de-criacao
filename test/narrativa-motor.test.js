// NARRATIVA — O MOTOR DE ROTEIROS
//
// A ferramenta fazia: entrada → prompt → roteiro. Uma chamada só. O modelo
// escrevia a primeira coisa que lhe vinha, e o que saía era correto e sem
// força. Duas causas, e as duas estavam na estrutura do processo, não no
// conhecimento do modelo:
//
//   1. A primeira versão ERA a entrega. Ninguém lia o rascunho antes do
//      usuário. Agora existe crítica e reescrita entre uma coisa e outra.
//   2. A estrutura vinha do FORMATO, não da história. Todo material entrava na
//      mesma fôrma — gancho → problema → solução → chamada —, inclusive os que
//      pediam outro desenho. Agora o formato só diz como o texto é ENTREGUE
//      (tempos, slides, numeração); o desenho da história sai do material.
//
// Chamadas de IA por geração: 1 → 4 (leitura, escrita, crítica, reescrita).
//
// O motor recebe a chamada de IA por parâmetro, então estes testes exercitam o
// pipeline inteiro com uma IA dublada — inclusive os caminhos que só aparecem
// quando ela devolve lixo, falha no meio ou piora o texto na reescrita.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');

let M;
beforeAll(() => {
  clearStorage();
  M = loadModules(['catalogs.js', 'core.js', 'poster-templates.js', 'agents.js', 'narrativa.js', 'narrativa-motor.js'],
    ['NARR_CRITERIOS', 'narrAberturaFraca', 'narrFrasesFeitas', 'narrExplicaEmVezDeMostrar',
      'narrLinhasDeFala', 'narrFalanteDaLinha', 'narrDialogoNarrado', 'narrFatosInventados', 'narrCtaCliche',
      'narrRepeticaoDeAbertura', 'narrPrimeiraFrase', 'criticarRoteiroLocal',
      'buildLeituraPrompt', 'buildRoteiroPrompt', 'buildCriticaPrompt', 'buildReescritaPrompt',
      'normalizarPlano', 'normalizarCritica', 'runNarrativaPipeline',
      'NARR_FORMATOS', 'NARR_LEMA', 'narrFormato', 'narrTom', 'narrTamanho']);
});

const MATERIAL = `Seu João, 71 anos, fechou a padaria do pai na pandemia.
Guardou a chave num pote de vidro em cima da geladeira.
Agora quer reabrir, mas o imóvel foi penhorado e o irmão quer vender o ponto.
Ele já gastou 40 mil das economias da aposentadoria em advogado.`;

const PLANO = {
  fatos: ['a padaria fechou na pandemia', 'a chave ficou num pote de vidro', 'o imóvel foi penhorado', 'ele gastou 40 mil'],
  protagonista: 'Seu João, 71 anos',
  desejo: 'reabrir a padaria do pai',
  obstaculo: 'o imóvel foi penhorado e o irmão quer vender',
  risco: 'as economias da aposentadoria',
  personagens: [
    { nome: 'Seu João', quer: 'reabrir a padaria', jeitoDeFalar: 'fala pouco, frases curtas', sabe: 'que o dinheiro acabou' },
    { nome: 'Nivaldo', quer: 'vender o ponto', jeitoDeFalar: 'fala rápido, usa número', sabe: 'que o irmão está sem dinheiro' },
  ],
  natureza: 'relato familiar sobre herança e teimosia',
  comecaEm: 'o momento em que ele tira a chave do pote',
  porqueComecaAi: 'é o instante em que a decisão já está tomada',
  estrutura: { nome: 'momento crítico e reconstrução', porque: 'o material entrega o desfecho pela metade', beats: ['a chave sai do pote', 'o irmão aparece com a proposta', 'a conta do advogado'] },
  mostrar: ['a chave no pote de vidro'],
  naoTem: '',
};

/* Uma IA dublada com roteiro de respostas: cada chamada devolve a próxima.
 * Guarda os prompts para conferir o que cada etapa recebeu. */
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

const ROTEIRO_BOM = `0–3s A chave saiu do pote de vidro em cima da geladeira.
3–10s Seu João: A padaria era do meu pai.
10–25s Nivaldo: O ponto vale mais fechado do que aberto.
25–45s O imóvel foi penhorado. As economias já foram para o advogado.
45–60s Ele girou a chave assim mesmo.`;

describe('a crítica que não é opinião', () => {
  describe('abertura', () => {
    it('pega o pigarro antes da história', () => {
      ['Hoje eu vou contar uma história incrível.', 'Deixa eu te contar uma coisa.',
        'Essa é a história de um homem.', 'Você não vai acreditar no que aconteceu.',
        'Oi gente, tudo bem?'].forEach((t) => {
        expect(M.narrAberturaFraca(t), t).toBeTruthy();
      });
    });

    it('não confunde com uma história que já começou', () => {
      ['A chave saiu do pote de vidro.', 'Seu João girou a chave pela última vez.',
        'O irmão chegou com a proposta na mão.'].forEach((t) => {
        expect(M.narrAberturaFraca(t), t).toBe('');
      });
    });

    it('enxerga através da marcação de entrega', () => {
      // Sem tirar "0–3s" ou "SLIDE 1 —", a checagem olharia para o rótulo e
      // nunca veria a frase que interessa.
      expect(M.narrAberturaFraca('0–3s Hoje eu vou contar uma história.')).toBeTruthy();
      expect(M.narrAberturaFraca('SLIDE 1 — Deixa eu te contar')).toBeTruthy();
      expect(M.narrPrimeiraFrase('0–3s A chave saiu do pote')).toBe('A chave saiu do pote');
    });

    it('"era uma vez" no meio de uma fala não é abertura fraca', () => {
      // A regra vale no COMEÇO. Reprovar no meio seria reprovar o personagem.
      expect(M.narrAberturaFraca('A chave saiu do pote.\nSeu João: era uma vez uma padaria aqui.')).toBe('');
    });
  });

  describe('frases de qualquer roteiro', () => {
    it('reconhece o som de quem não tinha o que dizer', () => {
      const t = 'No fim das contas, foi uma reviravolta do destino que mudou sua vida para sempre.';
      expect(M.narrFrasesFeitas(t).length).toBeGreaterThanOrEqual(3);
    });
    it('texto concreto passa limpo', () => {
      expect(M.narrFrasesFeitas(ROTEIRO_BOM)).toEqual([]);
    });
  });

  describe('explicar em vez de mostrar', () => {
    it('pega o sentimento anunciado', () => {
      const r = M.narrExplicaEmVezDeMostrar('Ele ficou muito nervoso. Ela estava triste.');
      expect(r.length).toBe(2);
    });
    it('a cena que mostra passa', () => {
      expect(M.narrExplicaEmVezDeMostrar('A mão dele tremeu na fechadura.')).toEqual([]);
    });
  });

  describe('diálogo que na verdade é narração', () => {
    it('duas pessoas na história e ninguém fala', () => {
      const p = M.narrDialogoNarrado('Seu João queria reabrir. O irmão não deixou.', PLANO);
      expect(p.join(' ')).toMatch(/nenhuma fala/);
    });

    it('com falas de verdade, não reclama', () => {
      expect(M.narrDialogoNarrado(ROTEIRO_BOM, PLANO)).toEqual([]);
    });

    it('reconhece fala com travessão e com nome', () => {
      expect(M.narrLinhasDeFala('— Some daqui.\nNIVALDO: Não vou.').length).toBe(2);
    });

    it('enxerga a fala através da marcação de entrega', () => {
      // Achado escrevendo este teste com um roteiro de Reels de verdade: a fala
      // vem como "3–10s Seu João: ...". Sem tolerar o prefixo, a checagem não
      // via fala nenhuma nos dois formatos mais usados e acusava de "tudo
      // narrado" um roteiro cheio de conversa.
      expect(M.narrFalanteDaLinha('3–10s Seu João: A padaria era do meu pai.')).toBe('Seu João');
      expect(M.narrFalanteDaLinha('SLIDE 2 — NIVALDO: Vende logo.')).toBe('NIVALDO');
      expect(M.narrFalanteDaLinha('0–3s A chave saiu do pote.')).toBe('');
    });

    it('narração com dois-pontos não conta como alguém falando', () => {
      // "Ele pensou: a chave ainda serve" casa com o padrão de falante. Se
      // contasse, a checagem calaria justamente quando devia falar.
      const p = M.narrDialogoNarrado('Ele pensou: a chave ainda serve. O irmão insistiu.', PLANO);
      expect(p.join(' ')).toMatch(/nenhuma fala/);
    });

    it('ninguém fala em parágrafo', () => {
      const fala = 'JOÃO: ' + 'palavra '.repeat(60);
      expect(M.narrDialogoNarrado(fala, PLANO).join(' ')).toMatch(/longas demais/);
    });

    it('pega a fala escrita para informar a plateia', () => {
      const t = 'JOÃO: Como você sabe, a padaria fechou em 2020.';
      expect(M.narrDialogoNarrado(t, PLANO).join(' ')).toMatch(/informar quem assiste/);
    });

    it('história de uma pessoa só não precisa de diálogo', () => {
      const solo = Object.assign({}, PLANO, { personagens: [PLANO.personagens[0]] });
      expect(M.narrDialogoNarrado('Ele girou a chave.', solo)).toEqual([]);
    });
  });

  describe('número inventado', () => {
    it('pega o que não estava no material', () => {
      expect(M.narrFatosInventados('Foram 300 clientes por dia.', MATERIAL)).toContain('300');
    });
    it('número que veio do material passa', () => {
      expect(M.narrFatosInventados('Gastou 40 mil com advogado.', MATERIAL)).toEqual([]);
    });
    it('marcação de entrega não vira fato inventado', () => {
      // Sem esta guarda, "0–3s" e "SLIDE 1" reprovariam todo roteiro de Reels
      // e de carrossel — a checagem morreria de falso positivo no primeiro uso.
      expect(M.narrFatosInventados('0–3s A chave saiu\n3–10s Ele girou', MATERIAL)).toEqual([]);
      expect(M.narrFatosInventados('SLIDE 1 — A chave\nSLIDE 2 — O pote', MATERIAL)).toEqual([]);
      expect(M.narrFatosInventados('1/ A chave saiu do pote\n2/ Ele girou', MATERIAL)).toEqual([]);
    });
  });

  describe('chamada colada por hábito', () => {
    it('pega quando ninguém pediu ação', () => {
      expect(M.narrCtaCliche('Comenta aqui embaixo o que você faria.', '')).toHaveLength(1);
    });
    it('some quando a ação foi pedida', () => {
      expect(M.narrCtaCliche('Comenta aqui embaixo.', 'peça um comentário')).toEqual([]);
    });
  });

  it('texto andando de lado: frases começando igual', () => {
    const t = 'Ele girou a chave. Ele olhou o balcão. Ele lembrou do pai. Ele saiu.';
    expect(M.narrRepeticaoDeAbertura(t).length).toBeGreaterThan(0);
  });

  describe('o veredito completo', () => {
    it('roteiro limpo passa', () => {
      const r = M.criticarRoteiroLocal(ROTEIRO_BOM, PLANO, { material: MATERIAL });
      expect(r.ok, JSON.stringify(r.achados)).toBe(true);
    });

    it('cada achado aponta o critério que fere', () => {
      const ruim = 'Hoje eu vou contar uma história. No fim das contas, ele ficou muito triste.';
      const r = M.criticarRoteiroLocal(ruim, PLANO, { material: MATERIAL });
      const ids = r.achados.map((a) => a.criterio);
      expect(ids).toContain('ponto-de-entrada');
      expect(ids).toContain('frases-genericas');
      expect(ids).toContain('mostrar-nao-explicar');
      // O critério citado precisa existir na lista — senão a reescrita recebe
      // um rótulo que não quer dizer nada.
      const validos = M.NARR_CRITERIOS.map((c) => c.id).concat(['fatos']);
      r.achados.forEach((a) => expect(validos, a.criterio).toContain(a.criterio));
    });

    it('separa o que é grave do que é ajuste', () => {
      const r = M.criticarRoteiroLocal('Hoje eu vou contar. Comenta aqui embaixo.', PLANO, { material: MATERIAL });
      expect(r.graves.length).toBeGreaterThan(0);
      expect(r.graves.length).toBeLessThan(r.achados.length);
    });
  });
});

describe('a estrutura nasce da história, não do formato', () => {
  it('o formato só carrega a embalagem — nenhum beat de história', () => {
    // Era aqui que morava a fôrma: cada formato trazia "GANCHO → CONTEXTO →
    // OBSTÁCULO → FECHAMENTO", e todo material entrava nela.
    M.NARR_FORMATOS.forEach((f) => {
      expect(f.entrega, f.id).toBeTruthy();
      expect(f.estrutura, `${f.id} ainda carrega beats fixos`).toBeUndefined();
    });
  });

  it('o prompt de escrita usa os beats do PLANO, e diz que embalagem não é estrutura', () => {
    const p = M.buildRoteiroPrompt(PLANO, { formato: M.narrFormato('reels'), tom: M.narrTom('direto') });
    PLANO.estrutura.beats.forEach((b) => expect(p).toContain(b));
    expect(p).toContain('momento crítico e reconstrução');
    expect(p).toMatch(/Isto é embalagem/);
    expect(p).toMatch(/NÃO é a estrutura da história/);
  });

  it('a leitura é proibida de usar a fórmula pronta', () => {
    const p = M.buildLeituraPrompt(MATERIAL, M.NARR_LEMA);
    expect(p).toMatch(/A estrutura nasce da história, não a história da estrutura/);
    expect(p).toMatch(/NÃO force este material dentro de/);
    expect(p).toMatch(/exemplos de VARIEDADE, não um cardápio/);
  });

  it('a leitura procura o momento em que já está acontecendo alguma coisa', () => {
    const p = M.buildLeituraPrompt(MATERIAL, '');
    expect(p).toMatch(/momento MAIS INTERESSANTE/);
    expect(p).toMatch(/não pelo começo cronológico/);
  });

  it('a escrita começa onde a leitura mandou, sem gancho grudado na frente', () => {
    const p = M.buildRoteiroPrompt(PLANO, { formato: M.narrFormato('reels'), tom: M.narrTom('direto') });
    expect(p).toContain(PLANO.comecaEm);
    expect(p).toMatch(/Nada de gancho artificial grudado na frente/);
  });
});

describe('os personagens falam como pessoas', () => {
  it('o prompt leva o jeito de falar e o que cada um sabe', () => {
    const p = M.buildRoteiroPrompt(PLANO, { formato: M.narrFormato('dialogo'), tom: M.narrTom('direto') });
    expect(p).toContain('fala pouco, frases curtas');
    expect(p).toContain('que o dinheiro acabou');
    expect(p).toMatch(/Ninguém fala porque quem assiste precisa saber/);
    expect(p).toMatch(/Cada personagem sabe só o que sabe/);
  });

  it('sem personagens, nem o cabeçalho de falas entra', () => {
    // Cabeçalho vazio é convite para o modelo inventar quem fale.
    const semGente = Object.assign({}, PLANO, { personagens: [] });
    const p = M.buildRoteiroPrompt(semGente, { formato: M.narrFormato('reels'), tom: M.narrTom('direto') });
    expect(p).not.toContain('QUEM FALA');
  });

  it('a leitura pede a voz e o conhecimento limitado de cada um', () => {
    const p = M.buildLeituraPrompt(MATERIAL, '');
    expect(p).toMatch(/jeitoDeFalar/);
    expect(p).toMatch(/o que essa pessoa sabe e o que ela ignora/);
  });
});

describe('a crítica pergunta o que precisa ser perguntado', () => {
  it('a lista cobre o que se pergunta a um roteiro', () => {
    const ids = M.NARR_CRITERIOS.map((c) => c.id);
    ['protagonista', 'desejo', 'obstaculo', 'risco', 'conflito', 'ponto-de-entrada',
      'tensao', 'virada', 'final-entrega', 'final-previsivel', 'dialogo-natural',
      'vozes-proprias', 'mostrar-nao-explicar', 'frases-genericas', 'cheiro-de-ia',
      'cada-frase-tem-razao'].forEach((id) => expect(ids).toContain(id));
  });

  it('todas as perguntas entram no prompt do crítico', () => {
    const p = M.buildCriticaPrompt(ROTEIRO_BOM, PLANO, []);
    M.NARR_CRITERIOS.forEach((c) => expect(p, c.id).toContain(c.pergunta));
  });

  it('o crítico recebe o que a medição já constatou, e é mandado olhar além', () => {
    // Sem isso, a IA gastaria a chamada repetindo o que o código já sabe.
    const p = M.buildCriticaPrompt(ROTEIRO_BOM, PLANO, [{ texto: 'abertura fraca' }]);
    expect(p).toContain('abertura fraca');
    expect(p).toMatch(/Não repita estes pontos/);
  });

  it('o crítico não reescreve — aponta', () => {
    const p = M.buildCriticaPrompt(ROTEIRO_BOM, PLANO, []);
    expect(p).toMatch(/Você NÃO reescreve/);
    expect(p).toMatch(/cite o TRECHO exato/);
  });

  it('veredito desconhecido vira "ok" e critério inventado é descartado', () => {
    const c = M.normalizarCritica({
      avaliacoes: [
        { id: 'tensao', veredito: 'falha', correcao: 'x' },
        { id: 'inventado-pela-ia', veredito: 'falha' },
        { id: 'virada', veredito: 'talvez' },
      ],
    });
    expect(c.avaliacoes.length).toBe(2);
    expect(c.falhas.map((f) => f.id)).toEqual(['tensao']);
  });
});

describe('a reescrita corrige sem virar outra história', () => {
  it('recebe os dois tipos de apontamento, separados', () => {
    const crit = M.normalizarCritica({ avaliacoes: [{ id: 'tensao', veredito: 'falha', trecho: 'x', correcao: 'aperte o meio' }], resumo: 'anda de lado' });
    const p = M.buildReescritaPrompt(ROTEIRO_BOM, crit, [{ texto: 'abertura fraca' }], PLANO, {});
    expect(p).toMatch(/CONSTATADO NA CONFERÊNCIA AUTOMÁTICA/);
    expect(p).toMatch(/APONTADO NA LEITURA CRÍTICA/);
    expect(p).toContain('aperte o meio');
    expect(p).toContain('anda de lado');
  });

  it('é proibida de inventar fato para resolver problema', () => {
    const p = M.buildReescritaPrompt(ROTEIRO_BOM, null, [], PLANO, {});
    expect(p).toMatch(/Não invente fato, número, nome nem citação/);
    expect(p).toMatch(/não mude o desfecho/);
    PLANO.fatos.forEach((f) => expect(p).toContain(f));
  });
});

describe('o motor inteiro', () => {
  const respostaLeitura = PLANO;

  it('roda as quatro etapas e entrega o texto reescrito', async () => {
    const call = dublar([
      respostaLeitura,
      'Hoje eu vou contar a história da padaria.',        // rascunho com defeito
      { avaliacoes: [{ id: 'ponto-de-entrada', veredito: 'falha', correcao: 'comece na chave' }], resumo: 'começa antes da história' },
      ROTEIRO_BOM,                                        // reescrita corrigida
    ]);
    const r = await M.runNarrativaPipeline({
      material: MATERIAL, formato: M.narrFormato('reels'), tom: M.narrTom('direto'),
      tamanho: M.narrTamanho('medio'), call,
    });
    expect(call.chamadas()).toBe(4);
    expect(r.etapas).toEqual(['leitura', 'escrita', 'critica', 'reescrita']);
    expect(r.conteudo).toBe(ROTEIRO_BOM);
    expect(r.rascunho).toMatch(/^Hoje eu vou/);
    expect(r.reescreveu).toBe(true);
  });

  it('rascunho limpo não gasta reescrita', async () => {
    // Quatro chamadas em todo clique seria imposto sobre quem acertou de
    // primeira. A crítica roda; a reescrita só se houver o que corrigir.
    const call = dublar([respostaLeitura, ROTEIRO_BOM, { avaliacoes: [], vale_reescrever: false }]);
    const r = await M.runNarrativaPipeline({
      material: MATERIAL, formato: M.narrFormato('reels'), tom: M.narrTom('direto'), call,
    });
    expect(call.chamadas()).toBe(3);
    expect(r.reescreveu).toBe(false);
    expect(r.conteudo).toBe(ROTEIRO_BOM);
  });

  it('a etapa de leitura pode barrar antes de gastar as outras três', async () => {
    // É a pergunta focada da interface: material que ainda não dá história não
    // merece três chamadas para virar um roteiro sobre nada.
    const call = dublar([{ protagonista: 'alguém', desejo: '', obstaculo: '', risco: '' }]);
    const r = await M.runNarrativaPipeline({
      material: 'um texto qualquer', formato: M.narrFormato('reels'), tom: M.narrTom('direto'),
      call, aposLeitura: () => false,
    });
    expect(call.chamadas()).toBe(1);
    expect(r.abortado).toBe(true);
    expect(r.conteudo).toBe('');
  });

  it('a reescrita que inventa número é descartada, e fica o rascunho', async () => {
    // A trava que impede a correção de virar invenção: preferimos um texto com
    // defeito de forma a um texto com fato que não existe.
    const call = dublar([
      respostaLeitura,
      'Hoje eu vou contar a história.',
      { avaliacoes: [{ id: 'ponto-de-entrada', veredito: 'falha', correcao: 'x' }] },
      'A padaria atendia 900 clientes por dia e faturava 12 mil por mês.',
    ]);
    const r = await M.runNarrativaPipeline({
      material: MATERIAL, formato: M.narrFormato('reels'), tom: M.narrTom('direto'), call,
    });
    expect(r.conteudo).toMatch(/^Hoje eu vou/);
    expect(r.etapas).toContain('reescrita-descartada');
    expect(r.reescreveu).toBe(false);
  });

  it('a reescrita que piora é descartada', async () => {
    const call = dublar([
      respostaLeitura,
      'A chave saiu do pote. No fim das contas ele girou.',   // 1 achado, leve
      { avaliacoes: [{ id: 'frases-genericas', veredito: 'falha', correcao: 'x' }] },
      'Hoje eu vou contar. Deixa eu te contar. JOÃO: Como você sabe, tudo mudou.', // pior
    ]);
    const r = await M.runNarrativaPipeline({
      material: MATERIAL, formato: M.narrFormato('reels'), tom: M.narrTom('direto'), call,
    });
    expect(r.conteudo).toMatch(/A chave saiu do pote/);
    expect(r.etapas).toContain('reescrita-descartada');
  });

  it('crítica que falha não derruba a geração', async () => {
    // A crítica é melhoria, não requisito: sem ela sobra a conferência
    // automática, que é a parte que nunca falha.
    const call = dublar([respostaLeitura, ROTEIRO_BOM, new Error('sem quota'), ROTEIRO_BOM]);
    const r = await M.runNarrativaPipeline({
      material: MATERIAL, formato: M.narrFormato('reels'), tom: M.narrTom('direto'), call,
    });
    expect(r.conteudo).toBeTruthy();
  });

  it('leitura ilegível não inventa história — os campos voltam vazios', async () => {
    const call = dublar(['isto não é json', ROTEIRO_BOM, { avaliacoes: [] }]);
    const r = await M.runNarrativaPipeline({
      material: MATERIAL, formato: M.narrFormato('reels'), tom: M.narrTom('direto'), call,
    });
    expect(r.plano.desejo).toBe('');
    expect(r.plano.fatos).toEqual([]);
  });

  it('a escrita sem texto é erro, não roteiro vazio', async () => {
    const call = dublar([respostaLeitura, '   ']);
    await expect(M.runNarrativaPipeline({
      material: MATERIAL, formato: M.narrFormato('reels'), tom: M.narrTom('direto'), call,
    })).rejects.toThrow(/não devolveu roteiro/i);
  });

  it('avisa o progresso etapa por etapa', async () => {
    const vistos = [];
    const call = dublar([respostaLeitura, 'Hoje eu vou contar.', { avaliacoes: [{ id: 'tensao', veredito: 'falha' }] }, ROTEIRO_BOM]);
    await M.runNarrativaPipeline({
      material: MATERIAL, formato: M.narrFormato('reels'), tom: M.narrTom('direto'), call,
      onEtapa: (k) => vistos.push(k),
    });
    expect(vistos).toEqual(['leitura', 'escrita', 'critica', 'reescrita', 'pronto']);
  });

  it('não reescreve para sempre', async () => {
    // Uma IA que devolve lixo em toda reescrita não pode prender o usuário num
    // laço: o motor tenta um número fixo de vezes e entrega o que tem.
    const call = dublar([respostaLeitura, 'Hoje eu vou contar.', { avaliacoes: [{ id: 'tensao', veredito: 'falha' }] },
      'Deixa eu te contar outra coisa.', 'Essa é a história de alguém.']);
    const r = await M.runNarrativaPipeline({
      material: MATERIAL, formato: M.narrFormato('reels'), tom: M.narrTom('direto'), call,
    });
    expect(call.chamadas()).toBeLessThanOrEqual(5);
    expect(r.conteudo).toBeTruthy();
  });
});

describe('a tela continua sendo um campo e um botão', () => {
  const html = ler('index.html');
  const js = ler('src/narrativa.js');

  it('nada de novo apareceu para o usuário preencher', () => {
    const vista = html.slice(html.indexOf('id="view-narrativa"'), html.indexOf('id="n-history-backdrop"'));
    const doc = vista.match(/<(input|textarea|select)[^>]*id="([^"]+)"/g) || [];
    const aVista = doc.filter((t) => !/type="file"/.test(t));
    // Só o campo da ideia fica fora do porta-estado escondido.
    expect(vista.indexOf('id="n-ideia"')).toBeGreaterThan(0);
    expect(aVista.length, 'apareceu campo novo na tela').toBeLessThanOrEqual(11);
  });

  it('o clique chama o motor, não o prompt de tiro único', () => {
    expect(js).toMatch(/await runNarrativaPipeline\(/);
    expect(js, 'o prompt de tiro único voltou').not.toMatch(/function buildNarrativaPrompt/);
  });

  it('o usuário vê o trabalho acontecendo — a espera ficou maior', () => {
    expect(js).toMatch(/data-step="leitura"/);
    expect(js).toMatch(/data-step="critica"/);
    expect(js).toMatch(/data-step="reescrita"/);
  });

  it('o motor está no manifesto e é carregado', () => {
    expect(ler('scripts/scripts.manifest.mjs')).toContain("'narrativa-motor.js'");
    expect(html).toContain('src/narrativa-motor.js');
  });

  it('a história salva guarda o rastro do trabalho', () => {
    // Para entender um resultado ruim sem ter de reproduzir a geração.
    expect(js).toMatch(/plano: res\.plano/);
    expect(js).toMatch(/reescreveu: !!res\.reescreveu/);
  });
});
