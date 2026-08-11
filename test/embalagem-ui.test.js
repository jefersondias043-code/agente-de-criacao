// EMBALAGEM — o botão na tela do Julgador
//
// Por que uma tela inteira em vez de um teste do motor: no r219 e no r220 a
// lógica estava certa e o botão não fazia nada — um guard de "ligar uma vez só"
// prendia os handlers aos elementos do primeiro render. Motor testado, botão
// morto. Aqui a tela é RECORTADA DO index.html publicado e ligada por
// `renderJulgador`, então o teste quebra tanto se a fiação sumir quanto se o
// botão nunca tiver chegado ao HTML.
//
// A rede é a única coisa dublada — `callLLM` é uma ligação léxica dentro do
// eval dos módulos e não dá para espionar de fora (ver o comentário em
// test/ingest-anexo.test.js sobre a tentativa que fracassou).
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');

let U;
beforeAll(() => {
  clearStorage();
  U = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'media-transcode.js', 'transcricao.js', 'embalagem.js', 'ingest.js',
      'julgador-motor.js', 'julgador.js'],
    ['State', 'renderJulgador', 'julgNovoConteudo', 'julgSugerirEmbalagem', 'STORAGE_KEYS']);
});

/* A vista do Julgador como ela está publicada. */
const montarTela = () => {
  const inicio = html.indexOf('id="view-julgador"');
  const fim = html.indexOf('id="j-history-backdrop"');
  expect(inicio, 'a vista do Julgador sumiu do index.html').toBeGreaterThan(-1);
  const trecho = html.slice(inicio, fim);
  document.body.innerHTML =
    `<div id="toast-stack"></div><div id="view-julgador" class="mtabs-host" data-mtab="a">` +
    `${trecho.slice(trecho.indexOf('>') + 1)}</div>`;
};

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

const TITULO_LIMPO = 'O vizinho me vendeu o relógio dele por vinte reais';
const LEGENDA_LIMPA = 'Comprei por pena, sem saber se prestava. O que veio depois eu não esperava.';

let chamadas;
let fetchOriginal;
let devolver;

beforeEach(() => {
  chamadas = [];
  devolver = () => ({ titulo: TITULO_LIMPO, legenda: LEGENDA_LIMPA, pergunta_retida: 'E aí, quanto valia?', fisgada: 'o relógio riscado' });
  fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (_url, opcoes) => {
    const corpo = JSON.parse(opcoes.body);
    chamadas.push(corpo.messages.at(-1).content);
    return {
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(devolver(chamadas.length)) } }] }),
    };
  };
  U.State.provider = 'groq';
  U.State.apiKeys = { groq: 'chave-de-teste' };
  U.State.models = { groq: 'modelo-de-teste' };
  U.State.julgadorDraft = null;
  montarTela();
  U.renderJulgador();
});

afterEach(() => { globalThis.fetch = fetchOriginal; });

const $$ = (sel) => document.querySelector(sel);
const preencherConteudo = (t) => {
  const el = $$('#j-conteudo');
  el.value = t;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const clicar = async (sel) => {
  const el = $$(sel);
  expect(el, `${sel} não está na tela`).toBeTruthy();
  el.click();
  for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 4));
};
const painel = () => $$('#j-sugestao .julg-sug');
const avisoDeChave = () => {
  const a = $$('#j-api-warning');
  return !!a && !a.classList.contains('hidden');
};

describe('o botão de sugerir título e legenda', () => {
  it('está na tela publicada, dentro da embalagem', () => {
    expect($$('#j-sugerir')).toBeTruthy();
    expect($$('#j-sugestao')).toBeTruthy();
    // Junto dos campos que ele preenche — não perdido em outra parte da tela.
    expect($$('.julg-embalagem-body #j-sugerir')).toBeTruthy();
  });

  it('sem conteúdo, não gasta chamada de IA', async () => {
    await clicar('#j-sugerir');
    expect(chamadas.length).toBe(0);
    expect(painel()).toBeNull();
  });

  it('com conteúdo curto demais, avisa o que falta em vez de tentar', async () => {
    /* O campo vazio o motor também barraria, então testar só ele não media a
     * guarda da tela. O que a tela acrescenta é o PISO: um punhado de palavras
     * não é transcrição, e mandar isso para a IA gastaria uma chamada para
     * devolver um título inventado do nada. */
    preencherConteudo('vendi o relógio');
    await clicar('#j-sugerir');
    expect(chamadas.length).toBe(0);
    const aviso = document.querySelector('#toast-stack').textContent;
    expect(aviso).toMatch(/cole ou anexe o conteúdo/i);
  });

  it('sem chave de API, avisa em vez de falhar calado', async () => {
    U.State.apiKeys = {};
    preencherConteudo(TRANSCRICAO);
    await clicar('#j-sugerir');
    expect(chamadas.length).toBe(0);
    expect(avisoDeChave()).toBe(true);
  });

  it('com conteúdo e chave, o painel aparece com título, legenda e a pergunta', async () => {
    preencherConteudo(TRANSCRICAO);
    await clicar('#j-sugerir');

    expect(chamadas.length).toBe(1);
    const p = painel();
    expect(p).toBeTruthy();
    expect(p.textContent).toContain(TITULO_LIMPO);
    expect(p.textContent).toContain(LEGENDA_LIMPA);
    expect(p.textContent).toContain('E aí, quanto valia?');
    expect(p.textContent).toMatch(/Nenhuma palavra do desfecho vazou/i);
  });

  it('a descrição visual vai junto no pedido', async () => {
    preencherConteudo(TRANSCRICAO);
    $$('#j-visual').value = 'Homem de camisa azul segurando o relógio perto da câmera.';
    await clicar('#j-sugerir');
    expect(chamadas[0]).toContain('camisa azul');
    expect(chamadas[0]).toContain('== O QUE SE VÊ');
  });

  it('NÃO preenche os campos sozinho — quem aplica é o autor', async () => {
    preencherConteudo(TRANSCRICAO);
    $$('#j-titulo').value = 'meu título de antes';
    await clicar('#j-sugerir');
    expect($$('#j-titulo').value).toBe('meu título de antes');
    expect($$('#j-legenda').value).toBe('');
  });
});

describe('aplicar a sugestão', () => {
  beforeEach(async () => {
    preencherConteudo(TRANSCRICAO);
    await clicar('#j-sugerir');
  });

  it('"Usar os dois" preenche título e legenda', async () => {
    await clicar('#j-sugestao [data-usar="ambos"]');
    expect($$('#j-titulo').value).toBe(TITULO_LIMPO);
    expect($$('#j-legenda').value).toBe(LEGENDA_LIMPA);
  });

  it('e guarda no rascunho, que é o que sobrevive a um novo render', async () => {
    await clicar('#j-sugestao [data-usar="ambos"]');
    const guardado = JSON.parse(localStorage.getItem(U.STORAGE_KEYS.julgadorDraft));
    expect(guardado.titulo).toBe(TITULO_LIMPO);
    expect(guardado.legenda).toBe(LEGENDA_LIMPA);
  });

  it('usar só o título não mexe na legenda', async () => {
    $$('#j-legenda').value = 'a minha legenda';
    await clicar('#j-sugestao [data-usar="titulo"]');
    expect($$('#j-titulo').value).toBe(TITULO_LIMPO);
    expect($$('#j-legenda').value).toBe('a minha legenda');
  });

  it('"Dispensar" tira o painel da tela', async () => {
    await clicar('#j-sug-fechar');
    expect(painel()).toBeNull();
  });

  it('"Sugerir outra" pede de novo', async () => {
    await clicar('#j-sug-outra');
    expect(chamadas.length).toBe(2);
  });
});

describe('quando o fim vaza', () => {
  it('a tela mostra a reprovação em vez de anunciar que passou', async () => {
    devolver = () => ({
      titulo: 'O Ricardo pagou duzentos reais pelo relógio',
      legenda: LEGENDA_LIMPA, pergunta_retida: '', fisgada: '',
    });
    preencherConteudo(TRANSCRICAO);
    await clicar('#j-sugerir');

    // Duas tentativas: a conferência reprovou a primeira e mandou reescrever.
    expect(chamadas.length).toBe(2);
    const p = painel();
    expect(p.textContent).toMatch(/O fim vazou/);
    expect(p.textContent).toContain('duzentos');
    expect(p.textContent).not.toMatch(/Nenhuma palavra do desfecho vazou/i);
  });

  it('mesmo reprovada, a sugestão fica disponível — a decisão é do autor', async () => {
    devolver = () => ({ titulo: 'O Ricardo pagou duzentos reais', legenda: LEGENDA_LIMPA });
    preencherConteudo(TRANSCRICAO);
    await clicar('#j-sugerir');
    await clicar('#j-sugestao [data-usar="titulo"]');
    expect($$('#j-titulo').value).toBe('O Ricardo pagou duzentos reais');
  });
});

describe('o painel não sobrevive à troca de conteúdo', () => {
  it('"Julgar outro conteúdo" leva a sugestão embora', async () => {
    preencherConteudo(TRANSCRICAO);
    await clicar('#j-sugerir');
    expect(painel()).toBeTruthy();

    U.julgNovoConteudo(true);
    // Uma sugestão feita para o vídeo anterior, ao lado de um campo vazio,
    // convidaria a colar no conteúdo errado.
    expect(painel()).toBeNull();
  });
});

describe('achar o botão', () => {
  it('a seção da embalagem anuncia a sugestão mesmo fechada', () => {
    /* O <details> nasce recolhido. Um botão dentro de uma seção fechada é um
     * botão que não existe para quem nunca a abriu — então o resumo, que é a
     * única parte visível, precisa dizer que a sugestão está ali dentro. */
    const resumo = document.querySelector('.julg-embalagem > summary');
    expect(resumo).toBeTruthy();
    expect(resumo.textContent).toMatch(/sugerir/i);
    expect(document.querySelector('.julg-embalagem').open).toBe(false);
  });
});
