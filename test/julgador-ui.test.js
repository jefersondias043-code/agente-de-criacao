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
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'media-transcode.js', 'ingest.js', 'julgador-motor.js', 'julgador.js'],
    ['State', 'renderJulgador', 'julgTemChave', 'julgAvisarSemChave', 'julgLimparResultado',
      'renderJulgResultado', 'julgSepararLote', 'julgDiagnosticoEmTexto', 'julgarConteudo',
      'conferirJulgamentoLocal', 'renderJulgTriagem', 'julgNovoConteudo', 'STORAGE_KEYS']);
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
      <select id="j-formato"></select>
      <textarea id="j-conteudo"></textarea>
      <textarea id="j-visual"></textarea>
      <input id="j-titulo" /><input id="j-capa" /><textarea id="j-legenda"></textarea>
      <input type="file" id="j-attach-input" /><button id="j-attach-btn"></button>
      <div id="j-attach-pending"></div>
      <div id="j-result-area"></div>
      <button id="j-submit"></button>
      <button id="j-novo"></button>
      <textarea id="j-lote"></textarea>
      <input type="file" id="j-lote-attach-input" /><button id="j-lote-attach-btn"></button>
      <div id="j-lote-attach-pending"></div>
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

  it('o botão COPIAR copia — clicado de verdade', async () => {
    /* O defeito relatado. Havia teste para `julgDiagnosticoEmTexto`, mas nenhum
     * CLICAVA no botão — e o clique morria num `copyText is not defined`, sem
     * copiar e sem avisar. Cobertura de função não é cobertura de botão. */
    const caixa = { texto: null };
    Object.defineProperty(navigator, 'clipboard',
      { value: { writeText: async (t) => { caixa.texto = t; } }, configurable: true });
    U.renderJulgResultado(itemRuim());
    document.getElementById('j-result-copy').click();
    await new Promise((r) => setTimeout(r, 20));
    expect(caixa.texto, 'o clique não copiou nada').toBeTruthy();
    expect(caixa.texto).toMatch(/NÃO PUBLICARIA AINDA/);
    expect(caixa.texto).toMatch(/SE VOCÊ SÓ PUDER MUDAR UMA COISA/);
    expect(document.getElementById('toast-stack').textContent,
      'copiou calado — o usuário não sabe se funcionou').toMatch(/copiado/i);
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

describe('a nota ponderada e o fator positivo na tela', () => {
  const itemComPeso = (formato) => {
    const juizo = U.julgarConteudo([
      { avaliador: 'retencao', notas: [{ dimensao: 'retencao', nota: 4, problema: 'perde gente cedo' },
        { dimensao: 'historia', nota: 8 }] },
      { avaliador: 'impacto', notas: [{ dimensao: 'impacto', nota: 9 }, { dimensao: 'clareza', nota: 8 }] },
      { avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 8 }] },
    ], [], formato ? { formato } : undefined);
    return { id: 'p1', createdAt: new Date().toISOString(), conteudo: 'x', embalagem: {}, juizo, local: {}, banca: [] };
  };

  it('mostra "o que mais pesa na nota", visualmente separado da pior dimensão', () => {
    U.renderJulgResultado(itemComPeso());
    const bloco = [...document.querySelectorAll('.julg-secao-titulo')]
      .find((e) => /O que mais pesa na nota/.test(e.textContent));
    expect(bloco, 'o bloco de peso precisa existir').toBeTruthy();
    expect(document.querySelectorAll('.julg-peso').length).toBeGreaterThan(0);
  });

  it('avisa que a nota ponderada não é o algoritmo de nenhuma plataforma', () => {
    U.renderJulgResultado(itemComPeso());
    const selo = document.querySelector('.julg-nota-ponderada');
    expect(selo).toBeTruthy();
    expect(selo.getAttribute('title')).toMatch(/não é o algoritmo real de nenhuma plataforma/);
  });

  it('o rótulo do formato escolhido aparece junto da nota ponderada', () => {
    U.renderJulgResultado(itemComPeso('curto'));
    expect(document.querySelector('.julg-nota-ponderada').textContent).toMatch(/Shorts\/Reels\/TikTok/);
  });

  it('mostra o fator positivo — o par simétrico do principal', () => {
    U.renderJulgResultado(itemComPeso());
    const f = document.querySelector('.julg-fator-positivo');
    expect(f, 'a maior nota da mesa precisa aparecer como fator positivo').toBeTruthy();
    expect(f.textContent).toMatch(/Primeiro impacto está forte — 9\/10/);
  });

  /* A AUDITORIA ACHOU ISTO: num conteúdo reprovado de ponta a ponta, a maior
   * nota também está abaixo do mínimo — e a tela dizia "Naturalidade está
   * forte — 3/10" ao lado de um NÃO PUBLICARIA e de um 10/100. Elogiar o que
   * não é bom é o que a doutrina proíbe os avaliadores de fazer; a tela não
   * pode fazer o que proíbe a banca. */
  it('quando NEM a maior nota passa do mínimo, a tela não chama isso de forte', () => {
    const juizo = U.julgarConteudo([
      { avaliador: 'naturalidade', notas: [{ dimensao: 'naturalidade', nota: 3, problema: 'soa escrito' }] },
      { avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 1, problema: 'não entrega nada' }] },
    ], []);
    expect(juizo.veredito).toBe('nao');
    expect(juizo.pontoForte.nota).toBeLessThan(juizo.pontoForte.minimo);
    U.renderJulgResultado({ id: 'fraco', juizo, local: {}, banca: [] });
    const f = document.querySelector('.julg-fator-positivo');
    expect(f.textContent, 'a tela elogiou uma nota reprovada').not.toMatch(/está forte/);
    expect(f.textContent).toMatch(/menos fraco/i);
    expect(f.textContent).toMatch(/maior nota da mesa/);
    expect(f.className, 'sem a classe, o bloco continua com cara de boa notícia').toMatch(/julg-fator-fraco/);
  });

  it('e o texto copiável conta a mesma história que a tela', () => {
    const juizo = U.julgarConteudo([
      { avaliador: 'naturalidade', notas: [{ dimensao: 'naturalidade', nota: 3 }] },
      { avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 1 }] },
    ], []);
    const texto = U.julgDiagnosticoEmTexto({ juizo, local: {}, avaliacoes: [] });
    expect(texto).toMatch(/O MENOS FRACO/);
    expect(texto).not.toMatch(/PRINCIPAL FATOR POSITIVO/);
  });

  it('o principal sem texto de problema não vira rótulo com dois-pontos e nada', () => {
    // Quando quem deu a pior nota não escreveu `problema`, a versão anterior
    // imprimia a linha solta "Retenção potencial: " — um rótulo e um vazio.
    const juizo = U.julgarConteudo([
      { avaliador: 'espectador', notas: [{ dimensao: 'retencao', nota: 2 }] },
    ], []);
    const texto = U.julgDiagnosticoEmTexto({ juizo, local: {}, avaliacoes: [] });
    expect(texto).not.toMatch(/Retenção potencial:\s*\n/);
    expect(texto, 'a nota precisa aparecer junto do rótulo').toMatch(/Retenção potencial — 2\/10/);
  });

  it('os eixos saem em bloco, com UMA linha em branco antes — não uma entre cada', () => {
    const juizo = U.julgarConteudo([
      { avaliador: 'impacto', notas: [{ dimensao: 'impacto', nota: 8 }, { dimensao: 'clareza', nota: 8 }] },
      { avaliador: 'retencao', notas: [{ dimensao: 'retencao', nota: 8 }, { dimensao: 'historia', nota: 8 }] },
      { avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 8 }] },
      { avaliador: 'compartilhamento', notas: [{ dimensao: 'compartilhamento', nota: 8 }] },
    ], []);
    const texto = U.julgDiagnosticoEmTexto({ juizo, local: {}, avaliacoes: [] });
    expect(texto).toMatch(/OS QUATRO EIXOS/);
    const bloco = texto.slice(texto.indexOf('OS QUATRO EIXOS'));
    expect(bloco, 'voltou a separar eixo a eixo com linha em branco').not.toMatch(/\n\n/);
  });

  /* O QUE A AUDITORIA ACHOU NESTE BLOCO. Ele ordenava por CONTRIBUIÇÃO
   * (peso × quanto falta para 10), e o efeito era o oposto do título: num
   * vídeo bom, as dimensões nota 10 contribuem zero e sumiam — "o que mais
   * pesa na nota" mostrava Compartilhamento (12%), Reação (6%), Curiosidade
   * (5%) e História (3%), enquanto Retenção (30%) e Impacto (20%) nem
   * apareciam. E o texto de ajuda afirmava "do maior peso para o menor". */
  const itemTudoAlto = () => {
    const juizo = U.julgarConteudo([
      { avaliador: 'retencao', notas: [{ dimensao: 'retencao', nota: 10 }, { dimensao: 'historia', nota: 9 }] },
      { avaliador: 'impacto', notas: [{ dimensao: 'impacto', nota: 10 }, { dimensao: 'clareza', nota: 10 }] },
      { avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 10 }] },
      { avaliador: 'compartilhamento', notas: [{ dimensao: 'compartilhamento', nota: 9 }] },
      { avaliador: 'comentarios', notas: [{ dimensao: 'comentarios', nota: 9 }] },
    ], []);
    return { id: 'alto', createdAt: new Date().toISOString(), conteudo: 'x', embalagem: {}, juizo, local: {}, banca: [] };
  };

  it('num vídeo bom, o bloco mostra as dimensões de MAIOR peso — não as de menor', () => {
    U.renderJulgResultado(itemTudoAlto());
    const dims = [...document.querySelectorAll('.julg-peso-dim')].map((e) => e.textContent);
    expect(dims[0], 'a dimensão de maior peso precisa vir primeiro').toBe('Retenção potencial');
    expect(dims[1]).toBe('Primeiro impacto');
    expect(dims, 'o bloco escondia justamente o que mais pesa').toContain('Valor entregue');
  });

  it('a ordem é por peso decrescente, sempre', () => {
    U.renderJulgResultado(itemTudoAlto());
    const pesos = [...document.querySelectorAll('.julg-peso-valores')]
      .map((e) => parseInt(/peso (\d+)%/.exec(e.textContent)[1], 10));
    expect(pesos.length).toBeGreaterThan(1);
    for (let i = 1; i < pesos.length; i++) expect(pesos[i - 1]).toBeGreaterThanOrEqual(pesos[i]);
  });

  it('uma dimensão de peso baixo e nota zero não fura a fila', () => {
    // Era exatamente este o caso que a ordenação por contribuição invertia:
    // embalagem (2%) zerada vinha na frente de retenção (30%) perfeita.
    const juizo = U.julgarConteudo([
      { avaliador: 'embalagem', notas: [{ dimensao: 'embalagem', nota: 0, problema: 'capa mente' }] },
      { avaliador: 'retencao', notas: [{ dimensao: 'retencao', nota: 10 }] },
    ], []);
    U.renderJulgResultado({ id: 'z', juizo, local: {}, banca: [] });
    const dims = [...document.querySelectorAll('.julg-peso-dim')].map((e) => e.textContent);
    expect(dims[0]).toBe('Retenção potencial');
  });

  it('o texto de ajuda descreve a ordenação que existe de verdade', () => {
    U.renderJulgResultado(itemTudoAlto());
    const ajuda = document.querySelector('.julg-peso').previousElementSibling.textContent;
    expect(ajuda).toMatch(/maior peso/);
    expect(ajuda, 'a cobertura declarada é o que torna o recorte honesto').toMatch(/% da nota ponderada/);
  });

  it('o selo do bloco de peso diz ESTADO, não tamanho de problema', () => {
    // "Baixo impacto · Compartilhamento · peso 12% · 9/10" era contraditório:
    // o rótulo de gravidade descreve problema, e aqui a linha não é problema.
    U.renderJulgResultado(itemTudoAlto());
    const selos = [...document.querySelectorAll('.julg-peso .julg-acao-grav')].map((e) => e.textContent);
    expect(selos[0]).toBe('OK');
    expect(selos.join(' '), 'vocabulário de problema vazou para a tabela de pesos').not.toMatch(/impacto/i);
  });

  it('sem ponderado no juízo (formato antigo, sem 3º parâmetro), o bloco de peso simplesmente não aparece', () => {
    const juizoAntigo = { avaliadas: [], reprovadas: [], criticas: [], veredito: 'sim',
      vereditoInfo: { label: 'PUBLICARIA', resumo: '' }, principal: null, pontoForte: null,
      acoes: [], eixos: [], nota: 0, media: 0 };
    U.renderJulgResultado({ id: 'y', juizo: juizoAntigo, local: {}, banca: [] });
    expect(document.querySelector('.julg-peso')).toBeFalsy();
    expect(document.querySelector('.julg-fator-positivo')).toBeFalsy();
  });
});

describe('a jornada do espectador na tela', () => {
  const itemComJornada = () => {
    const juizo = U.julgarConteudo([
      { avaliador: 'retencao', notas: [{ dimensao: 'retencao', nota: 7 }, { dimensao: 'historia', nota: 8 }] },
    ], []);
    return {
      id: 'j1', createdAt: new Date().toISOString(), conteudo: 'x', embalagem: {}, juizo, local: {}, banca: [],
      avaliacoes: [{
        avaliador: 'retencao', notas: [{ dimensao: 'retencao', nota: 7 }],
        jornada: [
          { trecho: '0-3s', riscoAbandono: 'alto', observacao: 'começa devagar, sem gancho' },
          { trecho: 'final', riscoAbandono: 'baixo', observacao: 'fecha o que abriu' },
        ],
        recompensaFinal: true, recompensaFinalTexto: 'a pergunta do início é respondida',
      }],
    };
  };

  it('mostra a travessia trecho por trecho quando o crítico de retenção devolveu jornada', () => {
    U.renderJulgResultado(itemComJornada());
    const detalhes = [...document.querySelectorAll('summary')]
      .find((e) => /A jornada do espectador, trecho por trecho/.test(e.textContent));
    expect(detalhes, 'o bloco de jornada precisa existir').toBeTruthy();
    const trechos = document.querySelectorAll('.julg-trecho');
    expect(trechos.length).toBe(2);
    expect(trechos[0].textContent).toMatch(/0-3s/);
    expect(trechos[0].textContent).toMatch(/começa devagar/);
  });

  it('mostra se há recompensa no final', () => {
    U.renderJulgResultado(itemComJornada());
    const area = document.getElementById('j-result-area').textContent;
    expect(area).toMatch(/Recompensa no final: sim/);
    expect(area).toMatch(/a pergunta do início é respondida/);
  });

  it('sem jornada nenhuma (ou sem crítico de retenção na banca), o bloco não aparece', () => {
    const juizo = U.julgarConteudo([{ avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 8 }] }], []);
    U.renderJulgResultado({ id: 'j2', juizo, local: {}, banca: [], avaliacoes: [] });
    const detalhes = [...document.querySelectorAll('summary')]
      .find((e) => /A jornada do espectador/.test(e.textContent));
    expect(detalhes).toBeFalsy();
  });

  it('a jornada também sobrevive na versão copiável', () => {
    const texto = U.julgDiagnosticoEmTexto(itemComJornada());
    expect(texto).toMatch(/A JORNADA DO ESPECTADOR, TRECHO POR TRECHO/);
    expect(texto).toMatch(/0-3s.*começa devagar/);
    expect(texto).toMatch(/Recompensa no final: sim/);
  });
});

describe('julgar outro conteúdo', () => {
  const encher = () => {
    document.getElementById('j-conteudo').value = 'o roteiro do primeiro vídeo, com bastante texto aqui';
    document.getElementById('j-visual').value = 'o Zé aparece de chapéu na calçada';
    document.getElementById('j-titulo').value = 'Título do primeiro';
    document.getElementById('j-capa').value = 'capa do primeiro';
    document.getElementById('j-legenda').value = 'legenda do primeiro';
    ['j-conteudo', 'j-visual', 'j-titulo', 'j-capa', 'j-legenda'].forEach((id) =>
      document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true })));
  };
  const vazios = () => ['j-conteudo', 'j-visual', 'j-titulo', 'j-capa', 'j-legenda']
    .every((id) => document.getElementById(id).value === '');

  beforeEach(() => { U.State.apiKeys = { groq: 'gsk_teste' }; U.renderJulgador(); });

  it('limpa os quatro campos de uma vez', () => {
    encher();
    U.julgNovoConteudo(true);
    expect(vazios(), 'sobrou campo preenchido').toBe(true);
  });

  it('esquece a versão anterior — senão o próximo vídeo sai comparado com ela', () => {
    // A armadilha deste botão: `julgadorOrigemId` sobreviver à limpeza faria a
    // banca comparar dois conteúdos sem relação nenhuma, e mostrar um "+5 em
    // impacto" que não quer dizer coisa alguma.
    U.State.julgadorOrigemId = 'julgamento-antigo';
    encher();
    U.julgNovoConteudo(true);
    expect(U.State.julgadorOrigemId, 'a comparação ficaria presa no vídeo anterior').toBe(null);
  });

  it('tira o diagnóstico da tela', () => {
    const juizo = U.julgarConteudo([{ avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 9 }] }], []);
    U.renderJulgResultado({ id: 'x', juizo, local: {}, banca: [] });
    expect(document.querySelector('.julg-veredito')).toBeTruthy();
    U.julgNovoConteudo(true);
    expect(document.querySelector('.julg-veredito'), 'o veredito do vídeo antigo ficou na tela').toBeFalsy();
  });

  it('NÃO apaga o histórico — o julgamento anterior continua guardado', () => {
    const juizo = U.julgarConteudo([{ avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 9 }] }], []);
    U.State.julgamentos = [{ id: 'v1', createdAt: new Date().toISOString(), conteudo: 'x', juizo }];
    U.julgNovoConteudo(true);
    expect(U.State.julgamentos.length).toBe(1);
  });

  it('não mexe no rascunho da Seleção — são duas abas', () => {
    document.getElementById('j-lote').value = 'acervo inteiro colado aqui';
    document.getElementById('j-lote').dispatchEvent(new Event('input', { bubbles: true }));
    encher();
    U.julgNovoConteudo(true);
    expect(U.State.julgadorDraft.lote).toBe('acervo inteiro colado aqui');
  });

  it('o rascunho GUARDADO também é limpo, senão volta ao recarregar a página', () => {
    // Ler `State` aqui não provaria nada: `julgNovoConteudo` mexe nele em
    // memória, e a tela lê de lá. Quem sobrevive a um F5 é o localStorage — e
    // era só isso que este teste precisava conferir. A primeira versão
    // conferia `State` e passava mesmo sem o `saveJulgadorDraft()`.
    encher();
    U.julgNovoConteudo(true);
    const guardado = JSON.parse(localStorage.getItem(U.STORAGE_KEYS.julgadorDraft) || '{}');
    expect(guardado.conteudo, 'o conteúdo antigo voltaria ao recarregar').toBe('');
    expect(guardado.titulo).toBe('');
    U.renderJulgador();
    expect(vazios()).toBe(true);
  });

  it('o botão do resultado limpa sem perguntar — aquele conteúdo já está guardado', () => {
    const juizo = U.julgarConteudo([{ avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 9 }] }], []);
    encher();
    U.renderJulgResultado({ id: 'x', juizo, local: {}, banca: [] });
    globalThis.confirm = () => { throw new Error('não devia perguntar'); };
    document.getElementById('j-result-novo').click();
    expect(vazios()).toBe(true);
  });

  it('o botão sempre visível pergunta antes de descartar texto não julgado', () => {
    encher();
    U.State.julgamentos = [];
    let perguntou = false;
    globalThis.confirm = () => { perguntou = true; return false; };
    document.getElementById('j-novo').click();
    expect(perguntou, 'apagaria trabalho sem avisar').toBe(true);
    expect(vazios(), 'disse não e limpou assim mesmo').toBe(false);
  });

  it('avisa quem escuta os campos — é o que faz o × sumir', () => {
    // `julgPreencher` só atribui `.value`, e atribuição não dispara evento.
    // `clear-field.js` sincroniza o × pelo `input`: sem o aviso, o × ficaria na
    // tela de um campo já vazio.
    encher();
    const avisados = new Set();
    ['j-conteudo', 'j-visual', 'j-titulo', 'j-capa', 'j-legenda'].forEach((id) =>
      document.getElementById(id).addEventListener('input', () => avisados.add(id)));
    U.julgNovoConteudo(true);
    expect([...avisados].sort()).toEqual(['j-capa', 'j-conteudo', 'j-legenda', 'j-titulo', 'j-visual']);
  });

  it('renderizar duas vezes não empilha o handler', () => {
    // O guard "ligar uma vez só" foi removido para que botões novos sejam
    // ligados numa tela remontada. O preço seria empilhar ouvintes — não é o
    // caso, porque tudo é ligado por atribuição. Um clique, um efeito.
    U.renderJulgador();
    U.renderJulgador();
    encher();
    U.State.julgamentos = [];
    globalThis.confirm = () => true;
    document.getElementById('toast-stack').innerHTML = '';
    document.getElementById('j-novo').click();
    expect(document.getElementById('toast-stack').children.length,
      'o handler rodou mais de uma vez').toBe(1);
  });

  it('e não pergunta quando o texto na tela já foi julgado', () => {
    encher();
    const juizo = U.julgarConteudo([{ avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 9 }] }], []);
    U.State.julgamentos = [{ id: 'v1', createdAt: new Date().toISOString(),
      conteudo: document.getElementById('j-conteudo').value, juizo }];
    globalThis.confirm = () => { throw new Error('não devia perguntar'); };
    document.getElementById('j-novo').click();
    expect(vazios()).toBe(true);
  });
});

describe('a descrição visual', () => {
  beforeEach(() => { U.State.apiKeys = { groq: 'gsk_teste' }; U.renderJulgador(); });

  it('o campo guarda sozinho, como os outros', () => {
    const v = document.getElementById('j-visual');
    v.value = 'o Zé aparece segurando um relógio dourado';
    v.dispatchEvent(new Event('input', { bubbles: true }));
    expect(U.State.julgadorDraft.visual).toBe('o Zé aparece segurando um relógio dourado');
  });

  it('volta ao reabrir a ferramenta', () => {
    const v = document.getElementById('j-visual');
    v.value = 'plano fechado no rosto dele';
    v.dispatchEvent(new Event('input', { bubbles: true }));
    montarTela();
    U.renderJulgador();
    expect(document.getElementById('j-visual').value).toBe('plano fechado no rosto dele');
  });

  it('reabrir um julgamento do histórico traz a descrição junto', () => {
    const juizo = U.julgarConteudo([{ avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 9 }] }], []);
    U.State.julgamentos = [{ id: 'v1', createdAt: new Date().toISOString(), nome: 'x',
      conteudo: 'a fala do vídeo', visual: 'o Zé de chapéu na calçada', embalagem: {}, juizo }];
    U.renderJulgador();
    document.querySelector('[data-julg-id="v1"]').click();
    expect(document.getElementById('j-visual').value).toBe('o Zé de chapéu na calçada');
  });
});

describe('o formato do conteúdo', () => {
  beforeEach(() => { U.State.apiKeys = { groq: 'gsk_teste' }; U.renderJulgador(); });

  it('o seletor vem populado com os formatos do registro, começando em Geral', () => {
    const sel = document.getElementById('j-formato');
    const rotulos = [...sel.options].map((o) => o.textContent);
    expect(rotulos).toContain('Geral');
    expect(rotulos.length).toBeGreaterThan(1);
    expect(sel.value, 'default é o formato neutro').toBe('geral');
  });

  it('o campo guarda sozinho, como os outros', () => {
    const sel = document.getElementById('j-formato');
    sel.value = 'curto';
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    expect(U.State.julgadorDraft.formato).toBe('curto');
  });

  it('volta ao reabrir a ferramenta', () => {
    const sel = document.getElementById('j-formato');
    sel.value = 'informativo';
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    montarTela();
    U.renderJulgador();
    expect(document.getElementById('j-formato').value).toBe('informativo');
  });

  it('"Julgar outro conteúdo" preserva o formato — é configuração da sessão, não do vídeo', () => {
    const sel = document.getElementById('j-formato');
    sel.value = 'comedia';
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    U.julgNovoConteudo(true);
    expect(U.State.julgadorDraft.formato, 'o formato não é conteúdo — não devia ser apagado').toBe('comedia');
    expect(document.getElementById('j-formato').value).toBe('comedia');
  });

  /* TROCAR O FORMATO COM UM DIAGNÓSTICO NA TELA.
   *
   * A auditoria pegou a tela mentindo: o seletor dizia "Comédia" e o bloco
   * continuava mostrando "97/100 · Geral", sem aviso nenhum de que o número
   * não era o do formato selecionado. Como a nota ponderada é função pura das
   * avaliações já guardadas, o certo é recalcular na hora — sem gastar as dez
   * chamadas de IA de uma nova submissão. */
  describe('trocar o formato com um resultado na tela', () => {
    const montarResultado = () => {
      const juizo = U.julgarConteudo([
        { avaliador: 'retencao', notas: [{ dimensao: 'retencao', nota: 5, problema: 'cai no meio' }] },
        { avaliador: 'impacto', notas: [{ dimensao: 'impacto', nota: 9 }, { dimensao: 'clareza', nota: 9 }] },
        { avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 9 }] },
      ], [], { formato: 'geral' });
      const item = { id: 'rec1', createdAt: new Date().toISOString(), nome: 'x',
        conteudo: 'a fala do vídeo', visual: '', embalagem: {}, juizo, local: { achados: [] },
        avaliacoes: [
          { avaliador: 'retencao', notas: [{ dimensao: 'retencao', nota: 5, problema: 'cai no meio' }] },
          { avaliador: 'impacto', notas: [{ dimensao: 'impacto', nota: 9 }, { dimensao: 'clareza', nota: 9 }] },
          { avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 9 }] },
        ],
        banca: ['retencao', 'impacto', 'valor'] };
      U.State.julgamentos = [item];
      U.renderJulgResultado(item);
      return item;
    };
    const trocar = (v) => {
      const sel = document.getElementById('j-formato');
      sel.value = v;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
    };

    it('a nota ponderada e o rótulo do formato acompanham o seletor', () => {
      montarResultado();
      const antes = document.querySelector('.julg-nota-ponderada').textContent;
      expect(antes).toMatch(/Geral/);
      trocar('curto');
      const depois = document.querySelector('.julg-nota-ponderada').textContent;
      expect(depois, 'a tela ficou mostrando o formato antigo').toMatch(/Shorts\/Reels\/TikTok/);
      expect(depois, 'retenção pesa mais em "curto" — a nota tinha de cair').not.toBe(antes);
    });

    it('e NADA mais do juízo muda — veredito, pior dimensão, principal e ações', () => {
      const item = montarResultado();
      const antes = JSON.stringify({ v: item.juizo.veredito, n: item.juizo.nota,
        p: item.juizo.principal.dimensao, a: item.juizo.acoes.map((x) => x.dimensao) });
      trocar('comedia');
      const depois = JSON.stringify({ v: item.juizo.veredito, n: item.juizo.nota,
        p: item.juizo.principal.dimensao, a: item.juizo.acoes.map((x) => x.dimensao) });
      expect(depois, 'o peso vazou para a decisão').toBe(antes);
    });

    it('o formato novo é gravado no histórico, não só desenhado', () => {
      montarResultado();
      trocar('informativo');
      const guardado = JSON.parse(localStorage.getItem(U.STORAGE_KEYS.julgamentos) || '[]');
      expect(guardado[0].juizo.ponderado.formato).toBe('informativo');
    });

    it('um julgamento antigo sem avaliações guardadas não é destruído pelo recálculo', () => {
      // Sem `avaliacoes`, recalcular produziria um juízo vazio e apagaria o
      // diagnóstico que já estava na tela. Melhor deixar como está.
      const juizo = U.julgarConteudo([
        { avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 9 }] }], []);
      const item = { id: 'velho', createdAt: new Date().toISOString(), juizo, local: {}, banca: [] };
      U.State.julgamentos = [item];
      U.renderJulgResultado(item);
      trocar('curto');
      expect(item.juizo.avaliadas.length, 'o diagnóstico antigo foi apagado').toBe(1);
      expect(document.querySelector('.julg-veredito')).toBeTruthy();
    });

    it('trocar o formato SEM resultado na tela não quebra nada', () => {
      U.julgLimparResultado();
      trocar('causo');
      expect(U.State.julgadorDraft.formato).toBe('causo');
      expect(document.querySelector('.julg-veredito')).toBeFalsy();
    });
  });

  it('reabrir um julgamento do histórico traz o formato usado naquela avaliação', () => {
    const juizo = U.julgarConteudo(
      [{ avaliador: 'valor', notas: [{ dimensao: 'valor', nota: 9 }] }], [], { formato: 'causo' });
    U.State.julgamentos = [{ id: 'v1', createdAt: new Date().toISOString(), nome: 'x',
      conteudo: 'a fala do vídeo', visual: '', embalagem: {}, juizo }];
    U.renderJulgador();
    document.querySelector('[data-julg-id="v1"]').click();
    expect(document.getElementById('j-formato').value).toBe('causo');
  });
});

describe('anexar vídeo', () => {
  /* O defeito relatado: a tela convertia mídia grande direto no `change` do
   * seletor de arquivo. No celular isso não é um gesto do usuário, o Web Audio
   * fica suspenso, a decodificação nunca resolve e depois de 45 segundos o
   * usuário recebe "formato incompatível" — com o formato certo.
   *
   * O helper compartilhado resolve o COMO. Este teste trava o QUEM: que esta
   * tela passe o container do cartão. Era exatamente isso que faltava. */
  const videoGrande = () => {
    const f = new Blob(['x'], { type: 'video/mp4' });
    Object.defineProperty(f, 'size', { value: 40 * 1024 * 1024 });
    Object.defineProperty(f, 'name', { value: 'entrevista.mp4' });
    return f;
  };
  const anexar = (inputId) => {
    const inp = document.getElementById(inputId);
    Object.defineProperty(inp, 'files', { value: [videoGrande()], configurable: true });
    inp.onchange();
  };
  const conversoes = () => document.getElementById('toast-stack').children.length;

  beforeEach(() => { U.State.apiKeys = { groq: 'gsk_teste' }; U.renderJulgador(); });

  it('vídeo grande espera o toque em vez de converter sozinho', () => {
    anexar('j-attach-input');
    expect(conversoes(), 'converteu sem gesto — é a falha do celular').toBe(0);
    expect(document.querySelector('#j-attach-pending [data-attach-go]'),
      'a tela não passou o container do cartão').toBeTruthy();
    expect(document.getElementById('j-attach-pending').textContent).toMatch(/entrevista\.mp4/);
  });

  it('o modo Seleção também espera o toque', () => {
    anexar('j-lote-attach-input');
    expect(conversoes()).toBe(0);
    expect(document.querySelector('#j-lote-attach-pending [data-attach-go]')).toBeTruthy();
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
