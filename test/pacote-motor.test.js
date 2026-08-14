// PACOTE — o motor
//
// Sucessora do AutoPost IA (removido no r227): áudio/vídeo/texto vira título,
// legenda, hashtags e palavras-chave. A diferença de propósito em relação ao
// AutoPost original é o JUIZ: lá era outra chamada de IA pontuando 9
// critérios; aqui é código — uma conferência determinística que reaproveita
// funções JÁ TESTADAS de outros arquivos (embalagem.js, resumo.js, agents.js)
// em vez de reimplementá-las. Por isso estes testes focam em DUAS coisas:
//
//   1. a CONFERÊNCIA reage certo a cada defeito que ela reúne (spoiler,
//      referência genérica repetida, hashtag/palavra-chave insuficiente);
//   2. o LAÇO (1 chamada, audita, no máximo 1 correção) se comporta como
//      `runEmbalagemPipeline` — nunca esconde um resultado ruim.
//
// A correção do PROMPT em si (doutrina sem spoiler, texto de anonimização) já
// tem dono: `test/embalagem.test.js` e a doutrina de resumo. Aqui só se
// confere que o prompt do Pacote INCLUI essas peças, não que elas dizem a
// coisa certa — isso já está garantido noutro lugar.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let C;
beforeAll(() => {
  clearStorage();
  C = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'embalagem.js', 'resumo.js', 'pacote-motor.js'],
    ['buildPacotePrompt', 'auditarPacote', 'runPacotePipeline', 'pacoteNormalizarSugestao',
      'PACOTE_MIN_HASHTAGS', 'PACOTE_MIN_PALAVRAS_CHAVE']);
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

/* Um pacote limpo: mensura ~100 palavras, sem spoiler óbvio (o "desfecho" —
 * um cascudo pequeno chamado Joãozinho — não aparece no título/legenda),
 * legenda sem referência genérica repetida, 5 hashtags cobrindo faixas
 * diferentes, 6 palavras-chave. */
const CONTEUDO = 'O vizinho jurou que pescou um peixe do tamanho de um bezerro perto da ponte velha naquela tarde de domingo. '
  + 'Ninguém acreditou de primeira, mas ele mostrou o motor entortado da canoa como prova concreta do esforço. '
  + 'A vila inteira discutiu aquilo por semanas, cada um dando um palpite diferente sobre o tamanho real. '
  + 'No fim ele confessou que exagerou: era um cascudo pequeno, que ele batizou de Joãozinho antes de soltar de volta no rio.';

const PACOTE_LIMPO = {
  titulo: 'O peixe que virou lenda na vila',
  legenda: 'Um vizinho jurou ter fisgado algo enorme perto da ponte velha. A vila discutiu por semanas até ele confessar o que realmente aconteceu.',
  pergunta_retida: 'O que ele confessou no fim?',
  fisgada: 'o motor entortado como prova física',
  hashtags: [
    { tag: 'curiosidades', tipo: 'ampla' }, { tag: 'pescaria', tipo: 'assunto' },
    { tag: 'historiareal', tipo: 'nicho' }, { tag: 'interior', tipo: 'nicho' },
    { tag: 'vaiacreditar', tipo: 'intencao' },
  ],
  palavras_chave: ['peixe gigante', 'pescaria incrível', 'história de pescador',
    'motor entortado', 'vila do interior', 'prova real'],
};

describe('o prompt reúne as peças certas, sem reescrevê-las', () => {
  it('inclui a doutrina sem spoiler de embalagem.js, verbatim', () => {
    const p = C.buildPacotePrompt(CONTEUDO, {});
    expect(p).toContain('O QUE O PACOTE PODE CONTAR');
    expect(p).toContain('SITUAÇÃO e DESFECHO');
  });

  it('inclui a doutrina de anonimização contextual', () => {
    const p = C.buildPacotePrompt(CONTEUDO, {});
    expect(p).toMatch(/SOBRE NOMES DE PESSOAS/);
    expect(p).toMatch(/o motorista, o vizinho/);
  });

  it('pede as 5 hashtags estratificadas do AutoPost original', () => {
    const p = C.buildPacotePrompt(CONTEUDO, {});
    expect(p).toMatch(/UMA hashtag AMPLA/);
    expect(p).toMatch(/UMA hashtag de ASSUNTO/);
    expect(p).toMatch(/DUAS hashtags de NICHO/);
    expect(p).toMatch(/UMA hashtag de INTENÇÃO/);
  });

  it('inclui o contexto temporal, para não sugerir tag datada', () => {
    const p = C.buildPacotePrompt(CONTEUDO, { hoje: new Date(2026, 0, 15) });
    expect(p).toMatch(/janeiro de 2026/);
  });

  it('quando reprovado, manda os problemas exatos de volta', () => {
    const p = C.buildPacotePrompt(CONTEUDO, { problemas: ['só 1 hashtag'] });
    expect(p).toMatch(/TENTATIVA ANTERIOR FOI REPROVADA/);
    expect(p).toContain('só 1 hashtag');
  });
});

describe('a conferência — cada defeito reaproveitado de outro arquivo', () => {
  it('um pacote limpo passa sem ressalva', () => {
    const a = C.auditarPacote(C.pacoteNormalizarSugestao(PACOTE_LIMPO), CONTEUDO);
    expect(a.ok, JSON.stringify(a.problemas)).toBe(true);
  });

  it('spoiler no título — reaproveitado de embAuditarSpoiler', () => {
    const vazado = { ...PACOTE_LIMPO, titulo: 'O peixe era só um cascudo chamado Joãozinho' };
    const a = C.auditarPacote(C.pacoteNormalizarSugestao(vazado), CONTEUDO);
    expect(a.ok).toBe(false);
    expect(a.problemas.some((p) => /desfecho/.test(p))).toBe(true);
  });

  it('referência genérica repetida na legenda — reaproveitado de resumoGenericosRepetidos', () => {
    const repetitivo = { ...PACOTE_LIMPO,
      legenda: 'Uma pessoa jurou ter visto algo enorme. Uma pessoa não foi acreditada. Uma pessoa então mostrou uma prova. Uma pessoa confessou no fim.' };
    const a = C.auditarPacote(C.pacoteNormalizarSugestao(repetitivo), CONTEUDO);
    expect(a.ok).toBe(false);
    expect(a.problemas.some((p) => /genérica repetida/.test(p))).toBe(true);
  });

  it('poucas hashtags reprova, mesmo sem nenhum outro defeito', () => {
    const poucasTags = { ...PACOTE_LIMPO, hashtags: [{ tag: 'a', tipo: 'ampla' }] };
    const a = C.auditarPacote(C.pacoteNormalizarSugestao(poucasTags), CONTEUDO);
    expect(a.ok).toBe(false);
    expect(a.problemas.some((p) => /hashtag/.test(p))).toBe(true);
  });

  it('poucas palavras-chave reprova, mesmo sem nenhum outro defeito', () => {
    const poucasChaves = { ...PACOTE_LIMPO, palavras_chave: ['um', 'dois'] };
    const a = C.auditarPacote(C.pacoteNormalizarSugestao(poucasChaves), CONTEUDO);
    expect(a.ok).toBe(false);
    expect(a.problemas.some((p) => p.includes('palavra') && p.includes('chave'))).toBe(true);
  });

  it('o limiar é o que a constante diz — não um número solto no meio do código', () => {
    expect(C.PACOTE_MIN_HASHTAGS).toBeGreaterThan(0);
    expect(C.PACOTE_MIN_PALAVRAS_CHAVE).toBeGreaterThan(0);
  });
});

describe('o pipeline: 1 chamada, audita, no máximo 1 correção', () => {
  it('aprova de primeira e não gasta uma segunda chamada', async () => {
    const call = dublar([PACOTE_LIMPO]);
    const r = await C.runPacotePipeline({ conteudo: CONTEUDO, call });
    expect(r.tentativas).toBe(1);
    expect(r.auditoria.ok).toBe(true);
    expect(r.titulo).toBe(PACOTE_LIMPO.titulo);
  });

  it('reprovado na primeira, corrige na segunda e entrega a versão corrigida', async () => {
    const vazado = { ...PACOTE_LIMPO, titulo: 'O peixe era só um cascudo chamado Joãozinho' };
    const call = dublar([vazado, PACOTE_LIMPO]);
    const r = await C.runPacotePipeline({ conteudo: CONTEUDO, call });
    expect(r.tentativas).toBe(2);
    expect(r.auditoria.ok).toBe(true);
    expect(r.titulo).toBe(PACOTE_LIMPO.titulo);
    // O prompt da segunda chamada carrega o problema exato da primeira.
    expect(call.prompts[1]).toMatch(/TENTATIVA ANTERIOR FOI REPROVADA/);
  });

  it('reprovado nas duas, entrega mesmo assim — nunca esconde um resultado ruim', async () => {
    const vazado1 = { ...PACOTE_LIMPO, titulo: 'O peixe era só um cascudo chamado Joãozinho' };
    const vazado2 = { ...PACOTE_LIMPO, titulo: 'Assim nasceu a lenda do cascudo Joãozinho' };
    const call = dublar([vazado1, vazado2]);
    const r = await C.runPacotePipeline({ conteudo: CONTEUDO, call });
    expect(r.tentativas).toBe(2);
    expect(r.auditoria.ok).toBe(false);
    // A SEGUNDA versão é a entregue — é a mais recente, não a primeira descartada.
    expect(r.titulo).toBe(vazado2.titulo);
  });

  it('sem conteúdo, recusa antes de gastar uma chamada', async () => {
    const call = dublar([PACOTE_LIMPO]);
    await expect(C.runPacotePipeline({ conteudo: '   ', call })).rejects.toThrow();
    expect(call.prompts.length).toBe(0);
  });

  it('resposta sem título nem legenda é erro, não um pacote vazio', async () => {
    const call = dublar([{ hashtags: [], palavras_chave: [] }]);
    await expect(C.runPacotePipeline({ conteudo: CONTEUDO, call })).rejects.toThrow(/não devolveu/);
  });
});
