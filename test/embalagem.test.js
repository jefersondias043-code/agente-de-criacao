// EMBALAGEM — sugerir título e legenda sem contar o vídeo
//
// Pedido: aproveitar a transcrição e a descrição visual que o Julgador já tem
// para sugerir título e legenda — "despertar curiosidade e criar uma razão para
// a pessoa assistir, sem entregar o desfecho".
//
// O QUE ESTES TESTES PROTEGEM. O prompt pede; o código mede. A regra "não conte
// o fim" já existia no AutoPost desde o r224 e o que a segura lá não é o texto
// da instrução — é `auditarSpoiler`, que roda depois da geração. Aqui é o
// mesmo: `embAuditarSpoiler` é o que decide, e o pipeline reescreve quando ela
// reprova.
//
// A conferência é ESTREITA de propósito: número e nome próprio que estreiam no
// último terço da fala. O r224 tentou medir "resumo" por abrangência e a
// medição reprovava o pacote certo — palavra comum se repete em qualquer
// roteiro. Alarme falso empurra a sugestão para o vago, que é defeito pior do
// que o spoiler que se queria evitar.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (f) => readFileSync(join(raiz, f), 'utf8');

let E;
let AP;
beforeAll(() => {
  clearStorage();
  E = loadModules(
    // agents.js entra porque é onde mora `extractJSON`, que o pipeline usa para
    // ler a resposta do modelo — sem ele o motor não enxerga nada do que voltou.
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js', 'embalagem.js'],
    ['EMB_REGRAS_SEM_SPOILER', 'EMB_SPOILER_MIN_PALAVRAS', 'EMB_MAX_TITULO', 'EMB_MAX_LEGENDA',
      'embPalavrasDoConteudo', 'embPalavrasDoDesfecho', 'embSpoilersEm', 'embAuditarSpoiler',
      'buildEmbalagemPrompt', 'embNormalizarSugestao', 'runEmbalagemPipeline']);

  // O AutoPost, para conferir que as duas casas continuam com a MESMA doutrina.
  const codigo = ['autopost-ia/js/core.js', 'autopost-ia/js/api.js', 'autopost-ia/js/package.js']
    .map(ler).join('\n;\n');
  (0, eval)(codigo + `\n;globalThis.__AP__ = {
    REGRAS_SEM_SPOILER, palavrasDoDesfecho, auditarSpoiler,
    SPOILER_MAX_TITULO, SPOILER_MAX_LEGENDA, SPOILER_MIN_PALAVRAS_ROTEIRO };`);
  AP = globalThis.__AP__;
});

/* Um vídeo em que o desfecho está claramente no fim: a revenda por duzentos e o
 * nome do comprador só aparecem no último terço. */
const TRANSCRICAO = `O vizinho apareceu na porta de casa com um relógio na mão dizendo que estava
precisando de dinheiro naquele mesmo dia. Perguntei quanto ele queria pelo relógio e ele
respondeu que vendia por vinte se fosse na hora. Olhei a peça de perto, era pesada, o vidro
riscado, a pulseira gasta de tanto uso, mas o ponteiro dos segundos andava certinho.
Fiquei com pena da situação dele e resolvi comprar mesmo sem saber se prestava. Guardei o
relógio na gaveta e fui trabalhar sem pensar mais no assunto durante o resto da manhã.
Na hora do almoço mostrei a peça para um colega do escritório que entende dessas coisas.
Ele olhou o fundo da caixa, viu a inscrição e ficou quieto por um tempo bem longo.
Disse que aquilo ali não era um relógio comum de banca de camelô. O Ricardo pagou duzentos
reais na mesma tarde e ainda disse que estava levando vantagem no negócio.`;

const VISUAL = `Homem de camisa azul sentado à mesa da cozinha, segurando um relógio prateado
perto da câmera. Na parede atrás dele há um calendário. Ele gira o relógio mostrando o fundo
da caixa para a câmera.`;

describe('a conferência: o que conta como desfecho', () => {
  it('número e nome próprio que estreiam no fim são o desfecho', () => {
    const d = E.embPalavrasDoDesfecho(TRANSCRICAO, '');
    expect(d).toContain('duzentos');
    expect(d).toContain('ricardo');
  });

  it('o número que já apareceu no começo NÃO é desfecho', () => {
    // "vinte" é o preço de compra, dito logo no início: é situação, não resposta.
    expect(E.embPalavrasDoDesfecho(TRANSCRICAO, '')).not.toContain('vinte');
  });

  it('verbo comum que estreia no fim não é desfecho', () => {
    const d = E.embPalavrasDoDesfecho(TRANSCRICAO, '');
    expect(d).not.toContain('escritorio');
    expect(d).not.toContain('vantagem');
  });

  it('fala curta demais não tem terços — e não se inventa desfecho', () => {
    const curto = 'O vizinho vendeu o relógio por vinte reais e eu revendi por duzentos.';
    expect(curto.split(/\s+/).length).toBeLessThan(E.EMB_SPOILER_MIN_PALAVRAS);
    expect(E.embPalavrasDoDesfecho(curto, '')).toEqual([]);
    // E a auditoria diz que NÃO conferiu, em vez de dizer que passou.
    const a = E.embAuditarSpoiler({ titulo: 'Revendi por duzentos', legenda: '' }, curto, '');
    expect(a.conferido).toBe(false);
    expect(a.ok).toBe(true);
  });
});

describe('a descrição visual é fonte do que JÁ SE VÊ, não do fim', () => {
  it('o que está na tela desde o começo deixa de contar como desfecho', () => {
    // "Ricardo" só é dito no fim da fala, mas se ele aparece em cena o vídeo
    // inteiro, o nome não é resposta escondida.
    const visualComNome = VISUAL + ' Ao lado dele está o Ricardo, de boné, rindo.';
    expect(E.embPalavrasDoDesfecho(TRANSCRICAO, '')).toContain('ricardo');
    expect(E.embPalavrasDoDesfecho(TRANSCRICAO, visualComNome)).not.toContain('ricardo');
  });

  it('os terços saem da FALA — o tamanho do visual não move o corte', () => {
    /* Emendar os dois textos moveria o ponto de corte: com uma descrição visual
     * longa, o "último terço" passaria a ser a descrição inteira e o desfecho
     * da fala escaparia da conferência.
     *
     * A primeira versão deste teste conferia que uma palavra só do visual não
     * era acusada de desfecho — e passava com a emenda posta de propósito,
     * porque o visual também entra na lista do que já se viu e saía por ali. O
     * que separa as duas implementações é o CORTE, então é o corte que precisa
     * ser medido: um visual comprido e sem nenhuma palavra em comum não pode
     * mudar nada. */
    const visualLongo = Array.from({ length: 60 },
      (_, i) => `Plano ${i} mostrando ambiente iluminado, parede pintada, janela fechada.`).join(' ');
    expect(E.embPalavrasDoDesfecho(TRANSCRICAO, visualLongo).sort())
      .toEqual(E.embPalavrasDoDesfecho(TRANSCRICAO, '').sort());
    expect(E.embPalavrasDoDesfecho(TRANSCRICAO, visualLongo)).toContain('duzentos');
  });

  it('o que só existe no visual não é acusado de desfecho', () => {
    const d = E.embPalavrasDoDesfecho(TRANSCRICAO, VISUAL);
    expect(d).not.toContain('calendario');
    expect(d).toContain('duzentos');
  });

  it('sem descrição visual, responde igual ao AutoPost', () => {
    // Onde as duas casas se sobrepõem, elas têm de dar a mesma resposta — senão
    // são duas noções de spoiler, e uma delas está errada.
    expect(E.embPalavrasDoDesfecho(TRANSCRICAO, '').sort())
      .toEqual(AP.palavrasDoDesfecho(TRANSCRICAO).sort());
  });
});

describe('o veredito da conferência', () => {
  const auditar = (titulo, legenda) =>
    E.embAuditarSpoiler({ titulo, legenda }, TRANSCRICAO, '');

  it('reprova o título que conta como termina', () => {
    const a = auditar('Comprei por vinte e revendi por duzentos no mesmo dia', '');
    expect(a.ok).toBe(false);
    expect(a.noTitulo).toContain('duzentos');
    expect(a.problemas[0]).toMatch(/título entrega o desfecho/i);
  });

  it('aprova o título que dá a situação e retém a resposta', () => {
    const a = auditar(
      'O vizinho me vendeu o relógio dele por vinte reais para pagar uma conta',
      'Comprei por pena. Na hora do almoço mostrei para um colega que entende do assunto — e ele ficou quieto.');
    expect(a.ok).toBe(true);
    expect(a.noTitulo).toEqual([]);
  });

  it('no título, UMA palavra do fim já reprova', () => {
    expect(E.EMB_MAX_TITULO).toBe(0);
    expect(auditar('O que o Ricardo viu no fundo da caixa', '').ok).toBe(false);
  });

  it('a legenda tolera uma coincidência, mas não duas', () => {
    expect(E.EMB_MAX_LEGENDA).toBe(1);
    expect(auditar('', 'O Ricardo apareceu na porta de casa naquela manhã.').ok).toBe(true);
    expect(auditar('', 'O Ricardo pagou duzentos sem pensar duas vezes.').ok).toBe(false);
  });

  it('os limites são os mesmos do AutoPost', () => {
    expect(E.EMB_MAX_TITULO).toBe(AP.SPOILER_MAX_TITULO);
    expect(E.EMB_MAX_LEGENDA).toBe(AP.SPOILER_MAX_LEGENDA);
    expect(E.EMB_SPOILER_MIN_PALAVRAS).toBe(AP.SPOILER_MIN_PALAVRAS_ROTEIRO);
  });
});

describe('a doutrina é uma só, nas duas casas', () => {
  it('EMB_REGRAS_SEM_SPOILER é cópia byte a byte de REGRAS_SEM_SPOILER', () => {
    expect(E.EMB_REGRAS_SEM_SPOILER).toBe(AP.REGRAS_SEM_SPOILER);
  });

  it('e ela carrega as três coisas que a fazem funcionar', () => {
    // Sem isto, a comparação acima passaria com as duas cópias vazias.
    const r = E.EMB_REGRAS_SEM_SPOILER;
    expect(r).toMatch(/SITUAÇÃO/);
    expect(r).toMatch(/DESFECHO/);
    expect(r).toMatch(/ainda sobra uma pergunta/i);
    expect(r).toMatch(/NÃO é permissão para ser vago/i);
  });
});

describe('o pedido que sai para a IA', () => {
  it('leva as duas fontes, separadas e nomeadas', () => {
    const p = E.buildEmbalagemPrompt(TRANSCRICAO, VISUAL, {});
    expect(p).toContain('== O QUE SE OUVE');
    expect(p).toContain('== O QUE SE VÊ');
    expect(p).toContain('relógio na mão');
    expect(p).toContain('camisa azul');
  });

  it('sem descrição visual, não finge que existe uma', () => {
    const p = E.buildEmbalagemPrompt(TRANSCRICAO, '', {});
    expect(p).not.toContain('== O QUE SE VÊ');
  });

  it('carrega a regra do spoiler antes de pedir o texto', () => {
    const p = E.buildEmbalagemPrompt(TRANSCRICAO, '', {});
    expect(p.indexOf('SITUAÇÃO')).toBeGreaterThan(-1);
    expect(p.indexOf('SITUAÇÃO')).toBeLessThan(p.indexOf('== O QUE ENTREGAR =='));
  });

  it('pede a pergunta retida — é o teste da regra virado em entrega', () => {
    expect(E.buildEmbalagemPrompt(TRANSCRICAO, '', {})).toContain('pergunta_retida');
  });

  it('a capa já escolhida entra, para o título não repetir o que ela mostra', () => {
    const p = E.buildEmbalagemPrompt(TRANSCRICAO, '', { capa: 'Close no relógio riscado' });
    expect(p).toContain('Close no relógio riscado');
    expect(p).toMatch(/não repita em palavras o que a capa já mostra/i);
  });

  it('na segunda tentativa, o prompt leva as palavras que vazaram', () => {
    const p = E.buildEmbalagemPrompt(TRANSCRICAO, '', {
      problemas: ['O título entrega o desfecho: "duzentos" só acontece no fim do vídeo.'],
    });
    expect(p).toContain('REPROVADA NA CONFERÊNCIA');
    expect(p).toContain('duzentos');
    // E avisa para não resolver ficando vago — que é o jeito fácil e errado.
    expect(p).toMatch(/não resolva ficando vago/i);
  });
});

describe('o pipeline', () => {
  const resposta = (titulo, legenda) => ({
    content: JSON.stringify({
      titulo, legenda, pergunta_retida: 'E aí, quanto valia?', fisgada: 'o relógio riscado',
    }),
  });
  const LIMPO = 'O vizinho me vendeu o relógio dele por vinte reais';
  const LIMPA = 'Comprei por pena, sem saber se prestava. O que veio depois eu não esperava.';

  it('uma chamada quando a conferência aprova de primeira', async () => {
    const chamadas = [];
    const r = await E.runEmbalagemPipeline({
      conteudo: TRANSCRICAO, visual: VISUAL,
      call: async (p) => { chamadas.push(p); return resposta(LIMPO, LIMPA); },
    });
    expect(chamadas.length).toBe(1);
    expect(r.titulo).toBe(LIMPO);
    expect(r.pergunta).toBe('E aí, quanto valia?');
    expect(r.auditoria.ok).toBe(true);
    expect(r.tentativas).toBe(1);
  });

  it('reprovou? reescreve uma vez, com o problema na mão', async () => {
    const chamadas = [];
    const r = await E.runEmbalagemPipeline({
      conteudo: TRANSCRICAO, visual: '',
      call: async (p) => {
        chamadas.push(p);
        return chamadas.length === 1
          ? resposta('Revendi o relógio por duzentos reais', LIMPA)
          : resposta(LIMPO, LIMPA);
      },
    });
    expect(chamadas.length).toBe(2);
    expect(chamadas[1]).toContain('REPROVADA NA CONFERÊNCIA');
    expect(chamadas[1]).toContain('duzentos');
    expect(r.titulo).toBe(LIMPO);
    expect(r.auditoria.ok).toBe(true);
    expect(r.tentativas).toBe(2);
  });

  it('insistiu no spoiler? devolve mesmo assim, com a reprovação declarada', async () => {
    // Esconder deixaria o autor sem nada e sem saber por quê. O que não se faz
    // é entregar o spoiler dizendo que passou.
    let n = 0;
    const r = await E.runEmbalagemPipeline({
      conteudo: TRANSCRICAO, visual: '',
      call: async () => { n++; return resposta('O Ricardo pagou duzentos', LIMPA); },
    });
    expect(n).toBe(2);
    expect(r.auditoria.ok).toBe(false);
    expect(r.auditoria.noTitulo).toContain('duzentos');
    expect(r.titulo).toBe('O Ricardo pagou duzentos');
  });

  it('nunca passa de duas chamadas', async () => {
    let n = 0;
    await E.runEmbalagemPipeline({
      conteudo: TRANSCRICAO, visual: '',
      call: async () => { n++; return resposta('O Ricardo pagou duzentos', LIMPA); },
    });
    expect(n).toBe(2);
  });

  it('sem conteúdo, nem chama a IA', async () => {
    let n = 0;
    await expect(E.runEmbalagemPipeline({ conteudo: '   ', call: async () => { n++; return resposta('a', 'b'); } }))
      .rejects.toThrow(/conteúdo/i);
    expect(n).toBe(0);
  });

  it('resposta sem título e sem legenda é erro, não sugestão vazia', async () => {
    await expect(E.runEmbalagemPipeline({
      conteudo: TRANSCRICAO,
      call: async () => ({ content: '{"titulo": "", "legenda": ""}' }),
    })).rejects.toThrow(/não devolveu/i);
  });

  it('as aspas que o modelo põe em volta do título saem', async () => {
    const r = await E.runEmbalagemPipeline({
      conteudo: TRANSCRICAO,
      call: async () => resposta(`"${LIMPO}"`, LIMPA),
    });
    expect(r.titulo).toBe(LIMPO);
  });
});
