// PACOTE — a tela
//
// Mesmo padrão de `test/causos-ui.test.js`: exercita a tela de verdade em
// jsdom, não a forma do código-fonte. O aviso de chave, o botão "Empacotar
// outro" e o histórico seguem exatamente as lições já pagas em Causos e
// Julgador (aviso só na hora de tentar, ligação por atribuição religada a
// cada render, cartão de gesto para mídia grande).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let U;
beforeAll(() => {
  clearStorage();
  U = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'embalagem.js', 'resumo.js', 'pacote-motor.js', 'handoff.js',
      'media-transcode.js', 'ingest.js', 'pacote.js'],
    ['State', 'renderPacote', 'pacoteTemChave', 'pacoteAvisarSemChave', 'pacoteLimparResultado',
      'pacoteNovo', 'renderPacoteResultado', 'pacoteFullText', 'STORAGE_KEYS', 'TEXT_CONSUMERS']);
});

/* A tela da ferramenta, reduzida ao que `renderPacote` toca. */
const montarTela = () => {
  document.body.innerHTML = `
    <div id="pk-api-warning" class="hidden"></div>
    <textarea id="pk-conteudo"></textarea>
    <div id="pk-attach-pending"></div>
    <input type="file" id="pk-attach-input" />
    <button id="pk-attach-btn"></button>
    <div id="toast-stack"></div>
    <div id="pk-result-badge"></div>
    <div id="pk-result-area"></div>
    <button id="pk-submit"></button>
    <button id="pk-novo"></button>
    <div id="pk-history-list"></div>
    <button id="pk-history-open"></button><button id="pk-history-close"></button>
    <div id="pk-history-backdrop"></div><button id="pk-history-clear"></button>`;
};

const avisoVisivel = () => {
  const a = document.getElementById('pk-api-warning');
  return !!a && !a.classList.contains('hidden');
};

beforeEach(() => {
  clearStorage();
  U.State.pacotes = [];
  U.State.pacoteDraft = null;
  U.State.handoff = null;
  montarTela();
});

describe('o aviso de chave não fica na frente de quem quer trabalhar', () => {
  it('abrir a ferramenta SEM chave não mostra aviso nenhum', () => {
    U.State.apiKeys = {};
    U.renderPacote();
    expect(avisoVisivel()).toBe(false);
  });

  it('abrir a ferramenta COM chave também não mostra nada', () => {
    U.State.apiKeys = { groq: 'gsk_teste' };
    U.renderPacote();
    expect(avisoVisivel()).toBe(false);
  });

  it('o aviso aparecido numa tentativa some ao reabrir a ferramenta', () => {
    U.State.apiKeys = {};
    U.pacoteAvisarSemChave();
    expect(avisoVisivel()).toBe(true);
    U.State.apiKeys = { groq: 'gsk_teste' };
    U.renderPacote();
    expect(avisoVisivel()).toBe(false);
  });

  it('quando aparece, diz o que aconteceu e leva para as Configurações', () => {
    U.State.apiKeys = {};
    U.pacoteAvisarSemChave();
    const a = document.getElementById('pk-api-warning');
    expect(a.textContent).toMatch(/não foi possível empacotar/i);
    expect(a.querySelector('[data-go="settings"]'), 'sem caminho para resolver').toBeTruthy();
  });
});

describe('onde a chave é procurada', () => {
  it('no mesmo lugar de onde o callLLM a lê', () => {
    U.State.provider = 'groq';
    U.State.apiKeys = { groq: 'gsk_teste' };
    expect(U.pacoteTemChave()).toBe(true);
    U.State.apiKeys = {};
    expect(U.pacoteTemChave()).toBe(false);
  });

  it('respeita o provedor escolhido, não só a Groq', () => {
    U.State.provider = 'anthropic';
    U.State.apiKeys = { groq: 'gsk_teste' };
    expect(U.pacoteTemChave(), 'chave da Groq não serve para a Anthropic').toBe(false);
    U.State.apiKeys = { anthropic: 'sk-ant-teste' };
    expect(U.pacoteTemChave()).toBe(true);
    U.State.provider = 'groq';
  });
});

describe('empacotar outro', () => {
  const CONTEUDO = 'um conteúdo qualquer, comprido o bastante para passar da checagem de tamanho mínimo';
  /* Um pacote guardado, com a forma que o histórico lê. */
  const guardado = (id, conteudo) => ({
    id, createdAt: new Date().toISOString(), conteudo,
    titulo: 'Título guardado', legenda: 'Legenda guardada.',
    hashtags: [{ tag: 'a', tipo: 'ampla' }], palavrasChave: ['x'],
    auditoria: { ok: true, problemas: [] },
  });
  const escrever = (t) => {
    const c = document.getElementById('pk-conteudo');
    c.value = t; c.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const campo = () => document.getElementById('pk-conteudo').value;

  beforeEach(() => { U.State.apiKeys = { groq: 'gsk_teste' }; U.renderPacote(); });

  it('limpa o campo', () => {
    escrever(CONTEUDO);
    U.pacoteNovo(true);
    expect(campo()).toBe('');
  });

  const semOuvinte = () => { document.getElementById('pk-conteudo').oninput = null; };

  it('tira o pacote da tela por conta própria', () => {
    U.State.pacotes = [guardado('p1', CONTEUDO)];
    U.renderPacoteResultado(U.State.pacotes[0]);
    expect(document.getElementById('pk-result-titulo')).toBeTruthy();
    semOuvinte();
    U.pacoteNovo(true);
    expect(document.getElementById('pk-result-titulo'), 'o pacote antigo ficou na tela').toBeFalsy();
  });

  it('guarda o rascunho vazio por conta própria, senão volta ao recarregar', () => {
    escrever(CONTEUDO);
    semOuvinte();
    U.pacoteNovo(true);
    const d = JSON.parse(localStorage.getItem(U.STORAGE_KEYS.pacoteDraft) || '{}');
    expect(d.conteudo, 'o conteúdo antigo voltaria ao recarregar').toBe('');
  });

  it('o botão do resultado limpa sem perguntar — aquele conteúdo já virou pacote', () => {
    U.State.pacotes = [guardado('p1', CONTEUDO)];
    escrever(CONTEUDO);
    U.renderPacoteResultado(U.State.pacotes[0]);
    globalThis.confirm = () => { throw new Error('não devia perguntar'); };
    document.getElementById('pk-result-novo').click();
    expect(campo()).toBe('');
  });

  it('o botão sempre visível pergunta antes de descartar conteúdo não empacotado', () => {
    U.State.pacotes = [];
    escrever('um conteúdo que nunca virou pacote, bem comprido também');
    let perguntou = false;
    globalThis.confirm = () => { perguntou = true; return false; };
    document.getElementById('pk-novo').click();
    expect(perguntou, 'apagaria trabalho sem avisar').toBe(true);
    expect(campo(), 'disse não e limpou assim mesmo').not.toBe('');
  });

  it('renderizar duas vezes não empilha o handler', () => {
    U.renderPacote();
    U.renderPacote();
    U.State.pacotes = [];
    escrever('um conteúdo qualquer, comprido o bastante');
    globalThis.confirm = () => true;
    document.getElementById('toast-stack').innerHTML = '';
    document.getElementById('pk-novo').click();
    expect(document.getElementById('toast-stack').children.length,
      'o handler rodou mais de uma vez').toBe(1);
  });
});

describe('copiar o pacote', () => {
  it('o botão COPIAR TUDO junta título, legenda, hashtags e palavras-chave', async () => {
    const caixa = { texto: null };
    Object.defineProperty(navigator, 'clipboard',
      { value: { writeText: async (t) => { caixa.texto = t; } }, configurable: true });
    U.State.apiKeys = { groq: 'gsk_teste' };
    U.renderPacote();
    const item = {
      id: 'p1', createdAt: new Date().toISOString(), conteudo: 'x',
      titulo: 'O peixe que virou lenda', legenda: 'Ninguém acreditou até ver a prova.',
      hashtags: [{ tag: 'curiosidades', tipo: 'ampla' }, { tag: 'pescaria', tipo: 'assunto' }],
      palavrasChave: ['peixe gigante', 'pescaria incrível'],
      auditoria: { ok: true, problemas: [] },
    };
    U.renderPacoteResultado(item);
    document.getElementById('pk-result-copy').click();
    await new Promise((r) => setTimeout(r, 20));
    expect(caixa.texto).toBe(U.pacoteFullText(item));
    expect(caixa.texto).toContain('O peixe que virou lenda');
    expect(caixa.texto).toContain('#curiosidades');
    expect(caixa.texto).toContain('peixe gigante');
    expect(document.getElementById('toast-stack').textContent).toMatch(/copiado/i);
  });
});

describe('anexar vídeo', () => {
  it('vídeo grande espera o toque em vez de converter sozinho', () => {
    U.State.apiKeys = { groq: 'gsk_teste' };
    U.renderPacote();
    const f = new Blob(['x'], { type: 'video/mp4' });
    Object.defineProperty(f, 'size', { value: 40 * 1024 * 1024 });
    Object.defineProperty(f, 'name', { value: 'video.mp4' });
    const inp = document.getElementById('pk-attach-input');
    Object.defineProperty(inp, 'files', { value: [f], configurable: true });
    inp.onchange();
    expect(document.getElementById('toast-stack').children.length,
      'converteu sem gesto — é a falha do celular').toBe(0);
    expect(document.querySelector('#pk-attach-pending [data-attach-go]'),
      'a tela não passou o container do cartão').toBeTruthy();
  });
});

describe('handoff — Pacote entra e sai da barra "Enviar para"', () => {
  it('Pacote está na lista de destinos', () => {
    const ids = U.TEXT_CONSUMERS.map((c) => c.id);
    expect(ids).toContain('pacote');
  });

  it('texto de outra ferramenta vira o conteúdo, e a fila esvazia', () => {
    // `sendTextTo` (handoff.js) já chega com o texto aparado — é o que a
    // ferramenta de origem sempre entrega de verdade.
    U.State.handoff = { target: 'pacote', text: 'a transcrição vinda do Extrair' };
    U.State.apiKeys = { groq: 'gsk_teste' };
    U.renderPacote();
    expect(document.getElementById('pk-conteudo').value).toBe('a transcrição vinda do Extrair');
    expect(U.State.handoff).toBeNull();
  });

  it('handoff para OUTRA ferramenta não é consumido aqui', () => {
    U.State.handoff = { target: 'causos', text: 'não é para o Pacote' };
    U.State.apiKeys = { groq: 'gsk_teste' };
    U.renderPacote();
    expect(document.getElementById('pk-conteudo').value).toBe('');
    expect(U.State.handoff).not.toBeNull();
  });
});
