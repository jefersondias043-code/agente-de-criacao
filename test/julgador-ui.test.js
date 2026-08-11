// JULGADOR — a tela
//
// Estes testes exercitam a tela de verdade em jsdom, em vez de conferir o
// formato do código. A lição vem do Causos: uma versão anterior daquele teste
// conferia a forma de `renderCausos` e deixava passar o defeito voltando por
// outro caminho.
//
// O que mais importa aqui é o bloco da MEDIÇÃO. Ele existe porque o juiz fica
// com a pior nota de cada dimensão: quando o avaliador é mais duro que a
// conferência automática, é o texto DELE que fica — e "o vídeo leva 15 segundos
// até chegar no assunto" sumia do relatório, trocado por um comentário genérico.
// Era perder o apontamento mais acionável que a ferramenta produz.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let U;
beforeAll(() => {
  clearStorage();
  U = loadModules(
    ['catalogs.js', 'core.js', 'poster-templates.js', 'agents.js', 'julgador-motor.js', 'julgador.js'],
    ['State', 'renderJulgador', 'julgTemChave', 'julgAvisarSemChave', 'julgLimparResultado',
      'renderJulgResultado', 'julgSepararLote', 'julgDiagnosticoEmTexto', 'julgarConteudo',
      'conferirJulgamentoLocal', 'renderJulgTriagem']);
});

/* A tela, reduzida ao que `renderJulgador` e o resultado tocam. */
const montarTela = () => {
  document.body.innerHTML = `
    <div id="view-julgador" class="mtabs-host" data-mtab="a">
      <div id="j-api-warning" class="hidden"></div>
      <div class="mtabs" id="j-mtabs">
        <button type="button" data-mtab="a" class="active">Um</button>
        <button type="button" data-mtab="b">Seleção</button>
      </div>
      <textarea id="j-conteudo"></textarea>
      <input id="j-titulo" /><input id="j-capa" /><textarea id="j-legenda"></textarea>
      <input type="file" id="j-attach-input" /><button id="j-attach-btn"></button>
      <div id="j-result-area"></div>
      <button id="j-submit"></button>
      <textarea id="j-lote"></textarea>
      <input type="file" id="j-lote-attach-input" /><button id="j-lote-attach-btn"></button>
      <div id="j-lote-result"></div>
      <button id="j-lote-submit"></button>
      <div id="j-history-backdrop"></div>
      <button id="j-history-open"></button><button id="j-history-close"></button>
      <button id="j-history-clear"></button>
      <div id="j-history-list"></div>
    </div>
    <div id="toast-stack"></div>`;
};

const avisoVisivel = () => {
  const a = document.getElementById('j-api-warning');
  return !!a && !a.classList.contains('hidden');
};
const tela = () => document.getElementById('j-result-area').textContent;

beforeEach(() => {
  clearStorage();
  U.State.julgamentos = [];
  U.State.julgadorDraft = null;
  U.State.julgadorOrigemId = null;
  montarTela();
});

describe('o aviso de chave não fica na frente de quem quer trabalhar', () => {
  it('abrir a ferramenta sem chave não mostra aviso nenhum', () => {
    U.State.apiKeys = {};
    U.renderJulgador();
    expect(avisoVisivel()).toBe(false);
  });

  it('o aviso de uma tentativa some ao reabrir a ferramenta', () => {
    U.State.apiKeys = {};
    U.julgAvisarSemChave();
    expect(avisoVisivel()).toBe(true);
    U.State.apiKeys = { groq: 'gsk_teste' };
    U.renderJulgador();
    expect(avisoVisivel()).toBe(false);
  });

  it('procura a chave no mesmo lugar de onde o callLLM a lê', () => {
    U.State.provider = 'groq';
    U.State.apiKeys = { groq: 'gsk_teste' };
    expect(U.julgTemChave()).toBe(true);
    U.State.apiKeys = {};
    expect(U.julgTemChave()).toBe(false);
    U.State.provider = 'groq';
  });
});

describe('o diagnóstico na tela', () => {
  /* Um conteúdo em que a conferência automática acha coisa, e um avaliador dá
   * uma nota AINDA MAIS BAIXA na mesma dimensão — o caso exato em que o texto
   * medido era descartado. */
  const RUIM = `Oi gente, tudo bem com vocês? Aqui é o canal de novo.
Sejam bem-vindos a mais um vídeo.
Hoje eu vou falar sobre uma coisa que aconteceu comigo.
Antes de começar, se inscreve no canal e deixa o like.
Então, o que aconteceu foi que eu perdi a carteira no mercado.
Comenta aqui embaixo se já aconteceu com você.`;

  const itemRuim = () => {
    const local = U.conferirJulgamentoLocal(RUIM, {});
    const juizo = U.julgarConteudo([
      { avaliador: 'impacto', notas: [{ dimensao: 'impacto', nota: 2, problema: 'a abertura não segura', correcao: 'comece pelo fato' },
        { dimensao: 'clareza', nota: 8 }] },
      { avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 8 }] },
    ], local.achados);
    return { id: 'x1', createdAt: new Date().toISOString(), conteudo: RUIM, embalagem: {}, juizo, local, banca: ['impacto', 'valor'] };
  };

  it('mostra o veredito com a cor da decisão', () => {
    U.renderJulgResultado(itemRuim());
    expect(tela()).toMatch(/NÃO PUBLICARIA AINDA/);
    expect(document.querySelector('.julg-veredito.julg-vermelho'), 'sem a faixa vermelha').toBeTruthy();
  });

  it('responde "se você só puder mudar uma coisa"', () => {
    U.renderJulgResultado(itemRuim());
    const p = document.querySelector('.julg-principal');
    expect(p, 'o principal é a informação mais valiosa da tela').toBeTruthy();
    expect(p.textContent).toMatch(/Primeiro impacto/);
    expect(p.textContent).toMatch(/comece pelo fato/);
  });

  it('a MEDIÇÃO aparece mesmo quando o avaliador foi mais duro que ela', () => {
    // O avaliador deu 2 em impacto; a conferência automática impõe 5. Vale o 2 —
    // e, sem este bloco, o texto medido ("leva N segundos até o assunto") sumia
    // junto com a nota perdida.
    const item = itemRuim();
    expect(item.juizo.avaliadas.find((a) => a.dimensao === 'impacto').nota, 'o avaliador precisa ter vencido').toBe(2);
    U.renderJulgResultado(item);
    expect(tela()).toMatch(/segundos até chegar no assunto/);
    expect(tela()).toMatch(/O que a medição encontrou/);
  });

  it('a medição também sobrevive na versão copiável', () => {
    const texto = U.julgDiagnosticoEmTexto(itemRuim());
    expect(texto).toMatch(/O QUE A MEDIÇÃO ENCONTROU/);
    expect(texto).toMatch(/segundos até chegar no assunto/);
    expect(texto).toMatch(/SE VOCÊ SÓ PUDER MUDAR UMA COISA/);
  });

  it('a nota exibida é a pior dimensão, e a tela diz isso', () => {
    U.renderJulgResultado(itemRuim());
    expect(document.querySelector('.julg-nota-valor').textContent).toBe('20');
    expect(tela(), 'sem essa legenda a nota vira média disfarçada').toMatch(/pior dimensão/);
  });

  it('desenha os quatro eixos quando a banca inteira pontuou', () => {
    const juizo = U.julgarConteudo([
      { avaliador: 'impacto', notas: [{ dimensao: 'impacto', nota: 8 }, { dimensao: 'clareza', nota: 8 }] },
      { avaliador: 'retencao', notas: [{ dimensao: 'retencao', nota: 8 }, { dimensao: 'historia', nota: 7 }] },
      { avaliador: 'curiosidade', notas: [{ dimensao: 'curiosidade', nota: 7 }] },
      { avaliador: 'naturalidade', notas: [{ dimensao: 'naturalidade', nota: 8 }] },
      { avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 8 }] },
      { avaliador: 'comentarios', notas: [{ dimensao: 'comentarios', nota: 6 }] },
      { avaliador: 'compartilhamento', notas: [{ dimensao: 'compartilhamento', nota: 6 }] },
      { avaliador: 'embalagem', notas: [{ dimensao: 'embalagem', nota: 8 }] },
    ], []);
    U.renderJulgResultado({ id: 'x2', juizo, local: {}, banca: [] });
    expect(document.querySelectorAll('.julg-eixo').length).toBe(4);
  });

  it('eixo sem nenhuma dimensão pontuada não ganha barra inventada', () => {
    // `itemRuim` não tem título, então ninguém pontuou embalagem nem
    // compartilhamento — o eixo de distribuição não existe naquele julgamento.
    // Desenhar uma barra vazia ali seria fingir uma medição que não houve.
    U.renderJulgResultado(itemRuim());
    const rotulos = [...document.querySelectorAll('.julg-eixo-label')].map((e) => e.textContent);
    expect(rotulos).not.toContain('Potencial de distribuição');
    expect(rotulos.length).toBe(3);
  });

  it('a média aparece só como referência, e a tela diz que ela não decide', () => {
    U.renderJulgResultado(itemRuim());
    expect(tela()).toMatch(/Média das dimensões/);
    expect(tela()).toMatch(/Ela não decide nada/);
  });

  it('a ata vem recolhida — quem quer saber o que fazer não quer a planilha', () => {
    U.renderJulgResultado(itemRuim());
    const ata = document.querySelector('.causo-mesa');
    expect(ata).toBeTruthy();
    expect(ata.hasAttribute('open')).toBe(false);
  });

  it('avisa que potencial não é garantia', () => {
    U.renderJulgResultado(itemRuim());
    expect(tela()).toMatch(/Potencial não é garantia/);
  });

  it('o botão de reavaliar marca de qual versão a próxima será comparada', () => {
    const item = itemRuim();
    U.renderJulgResultado(item);
    document.getElementById('j-result-reavaliar').click();
    expect(U.State.julgadorOrigemId).toBe(item.id);
  });
});

describe('o modo Seleção', () => {
  it('separa o acervo por uma linha de traços', () => {
    const itens = U.julgSepararLote(
      'Primeiro vídeo\nfala fala fala fala fala fala\n---\nSegundo vídeo\noutra fala outra fala outra');
    expect(itens.length).toBe(2);
    expect(itens[0].nome, 'a primeira linha curta vira o nome').toBe('Primeiro vídeo');
    expect(itens[1].nome).toBe('Segundo vídeo');
  });

  it('ignora pedaços vazios ou curtos demais para julgar', () => {
    expect(U.julgSepararLote('conteudo de verdade com bastante texto aqui\n---\n \n---\noi').length).toBe(1);
  });

  it('a fila mostra o veredito e o principal de cada um', () => {
    const juizo = U.julgarConteudo([{ avaliador: 'impacto', notas: [{ dimensao: 'impacto', nota: 3, problema: 'demora a começar' }] }], []);
    U.renderJulgTriagem({ banca: ['impacto'], fila: [{ nome: 'Vídeo do carro', ok: true, juizo }] });
    const t = document.getElementById('j-lote-result').textContent;
    expect(t).toMatch(/Vídeo do carro/);
    expect(t).toMatch(/NÃO PUBLICARIA/);
    expect(t).toMatch(/demora a começar/);
    expect(t, 'a triagem precisa se declarar reduzida').toMatch(/banca reduzida/i);
  });

  it('um vídeo que quebrou aparece na fila em vez de sumir', () => {
    U.renderJulgTriagem({ banca: ['impacto'], fila: [{ nome: 'Quebrado', ok: false, erro: 'sem conteúdo' }] });
    expect(document.getElementById('j-lote-result').textContent).toMatch(/Quebrado.*não deu para avaliar/s);
  });
});
