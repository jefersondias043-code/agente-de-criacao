// EXTRAIR — texto tratado, resumo, e a saída para as outras ferramentas
//
// Pedido: "a ferramenta Extrair deixe de ser apenas uma ferramenta de extração
// de texto e passe a funcionar como uma porta de entrada para o restante da
// plataforma, transformando arquivos brutos em conteúdo tratado, resumido e
// pronto para ser utilizado em outras ferramentas."
//
// O QUE ESTES TESTES SEGURAM, e é o ponto que o usuário mais destacou: o resumo
// não pode ficar isolado. A barra "Enviar para" já existia nesta tela e mandava
// `e.text` — o texto completo. Com o resumo aberto, mandar o completo seria
// enviar uma coisa enquanto mostra outra, e o usuário só descobriria do outro
// lado, na ferramenta de destino, depois de gerar em cima do texto errado.
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
      'storage.js', 'media-transcode.js', 'transcricao.js', 'resumo.js', 'ingest.js',
      'handoff.js', 'extract.js'],
    ['State', 'renderExtractionDetail', 'extractTextoAtivo', 'extractBlocoTexto',
      'sendTextTo', 'renderExtract', 'abrirExtractHistorico', 'fecharExtractHistorico', 'STORAGE_KEYS']);
});

const montarTela = () => {
  const inicio = html.indexOf('id="view-extract"');
  expect(inicio, 'a vista Extrair sumiu do index.html').toBeGreaterThan(-1);
  const fim = html.indexOf('id="view-posters"');
  const trecho = html.slice(inicio, fim > inicio ? fim : inicio + 20000);
  document.body.innerHTML =
    `<div id="toast-stack"></div><section id="view-extract" class="mtabs-host" data-mtab="a">` +
    `${trecho.slice(trecho.indexOf('>') + 1)}</section>`;
};

const TEXTO = `Na terça-feira de manhã, o senhor João saiu de casa por volta das sete horas, como fazia
todo dia desde que se aposentou. Ele levava o saco de lixo na mão direita e o guarda-chuva na esquerda.
O vizinho dele, o Anderson, estava lavando o carro na calçada. O senhor João seguiu até a lixeira da
esquina e percebeu que ela tinha sumido: no lugar havia só um cano enferrujado saindo do chão.
Voltou para casa com o lixo, contrariado, e ligou para a prefeitura, onde ninguém atendeu.`;
const RESUMO = `Um homem aposentado saiu de casa para jogar o lixo e passou por um vizinho lavando o
carro. Ao chegar à lixeira da esquina, viu que ela tinha sumido — restava só um cano. Voltou com o
lixo e ligou para a prefeitura, sem resposta.`;

const item = (extra = {}) => ({
  id: 'x1', title: 'Teste', createdAt: new Date().toISOString(),
  files: [{ id: 'f1', name: 'a.txt', type: 'text', status: 'completed', text: TEXTO }],
  text: TEXTO, status: 'completed', ...extra,
});

let fetchOriginal;
beforeEach(() => {
  fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('nenhuma chamada de rede era esperada'); };
  clearStorage();
  globalThis.goTo = () => {};
  U.State.extractions = [item()];
  U.State.activeExtractionId = 'x1';
  montarTela();
  // renderExtract() é quem liga a gaveta e o dropzone — a tela real passa por
  // ele antes de qualquer detalhe aparecer.
  try { U.renderExtract(); } catch (_) { /* dependências de upload não importam aqui */ }
  U.renderExtractionDetail();
});
afterEach(() => { globalThis.fetch = fetchOriginal; });

const $$ = (s) => document.querySelector(s);
const texto = () => ($$('#e-detail-content pre') || {}).textContent || '';

describe('sem resumo ainda', () => {
  it('oferece o botão de resumir', () => {
    expect($$('#e-resumir')).toBeTruthy();
    expect($$('#e-resumir').textContent).toMatch(/resumir/i);
  });

  it('mostra o texto tratado e não inventa abas', () => {
    expect(texto()).toContain('senhor João');
    expect($$('[data-vertexto]')).toBeNull();
  });

  it('a barra de envio existe e manda o texto completo', () => {
    expect($$('#e-detail-content [data-sendto]')).toBeTruthy();
    expect(U.extractTextoAtivo(U.State.extractions[0])).toBe(TEXTO);
  });
});

describe('com resumo', () => {
  beforeEach(() => {
    U.State.extractions = [item({
      resumo: RESUMO, verResumo: true,
      resumoConferencia: { ok: true, problemas: [], palavras: 42, proporcao: 0.42, nomes: [] },
    })];
    U.renderExtractionDetail();
  });

  it('as abas NÃO usam a classe do celular, que some no computador', () => {
    // Medido no navegador: com `.mtabs` o resumo era gerado e ficava invisível
    // acima de 1100px, porque aquela classe é `display:none` no desktop.
    expect(document.querySelector('.extract-abas')).toBeTruthy();
    expect(document.querySelector('#e-detail-content .mtabs')).toBeNull();
  });

  it('as duas versões convivem, em abas', () => {
    const abas = [...document.querySelectorAll('[data-vertexto]')].map((b) => b.dataset.vertexto);
    expect(abas).toEqual(['completo', 'resumo']);
  });

  it('mostra o resumo, e a medição dele', () => {
    expect(texto()).toContain('Um homem aposentado');
    expect($$('#e-detail-content').textContent).toMatch(/42 palavras/);
    expect($$('#e-detail-content').textContent).toMatch(/sem nomes de pessoas/);
  });

  it('CLICAR NA ABA troca o texto mostrado', () => {
    $$('[data-vertexto="completo"]').click();
    expect(texto()).toContain('senhor João');
    $$('[data-vertexto="resumo"]').click();
    expect(texto()).toContain('Um homem aposentado');
  });

  it('a escolha sobrevive a um novo render', () => {
    $$('[data-vertexto="completo"]').click();
    U.renderExtractionDetail();
    expect(texto()).toContain('senhor João');
  });
});

describe('o que sai para as outras ferramentas é o que está à vista', () => {
  /* O ponto que o usuário mais destacou. Antes desta mudança a barra mandava
   * sempre `e.text`; com o resumo aberto, o destino receberia o texto completo
   * — e o erro só apareceria depois, do outro lado. */
  /* CLICAR NO BOTÃO DE VERDADE. A primeira versão destes dois passava o texto
   * na mão para `sendTextTo` — o que provava apenas que a função guarda o que
   * recebe. A mutação que devolvia `e.text` ao envio passou incólume por eles.
   * O que precisa ser exercitado é a FIAÇÃO: `wireSendTo` lendo o texto ativo. */
  const clicarEnviarPara = (destino) => {
    const b = document.querySelector(`#e-detail-content [data-sendto="${destino}"]`);
    expect(b, `botão "enviar para ${destino}" não está na tela`).toBeTruthy();
    b.click();
  };

  it('com o resumo aberto, envia o RESUMO', () => {
    U.State.extractions = [item({ resumo: RESUMO, verResumo: true })];
    U.renderExtractionDetail();
    U.State.handoff = null;
    clicarEnviarPara('narrativa');
    expect(U.State.handoff.text).toBe(RESUMO);
  });

  it('com o texto completo aberto, envia o COMPLETO', () => {
    U.State.extractions = [item({ resumo: RESUMO, verResumo: false })];
    U.renderExtractionDetail();
    U.State.handoff = null;
    clicarEnviarPara('narrativa');
    expect(U.State.handoff.text).toBe(TEXTO);
  });

  it('trocar de aba muda o que o botão envia, sem precisar renderizar de novo', () => {
    U.State.extractions = [item({ resumo: RESUMO, verResumo: false })];
    U.renderExtractionDetail();
    document.querySelector('[data-vertexto="resumo"]').click();
    U.State.handoff = null;
    clicarEnviarPara('narrativa');
    expect(U.State.handoff.text).toBe(RESUMO);
  });

  it('a barra continua aparecendo com o resumo na tela', () => {
    U.State.extractions = [item({ resumo: RESUMO, verResumo: true })];
    U.renderExtractionDetail();
    expect($$('#e-detail-content [data-sendto]')).toBeTruthy();
  });
});

describe('quando a conferência do resumo reprova', () => {
  it('o aviso aparece junto do resumo, em vez de sumir', () => {
    U.State.extractions = [item({
      resumo: RESUMO, verResumo: true,
      resumoConferencia: { ok: false, problemas: ['nomes próprios continuam no resumo: joao'], palavras: 42, proporcao: 0.42, nomes: ['joao'] },
    })];
    U.renderExtractionDetail();
    const t = $$('#e-detail-content').textContent;
    expect(t).toMatch(/nomes próprios continuam/);
    // E não anuncia medida boa ao mesmo tempo — seria dizer duas coisas opostas.
    expect(t).not.toMatch(/sem nomes de pessoas/);
  });
});

describe('o passo de organizar está no código (conferência de FONTE, não de comportamento)', () => {
  /* SEJA CLARO SOBRE O QUE ISTO COBRE. O passo de organizar roda dentro do laço
   * de extração, que depende de FileReader, OCR e transcrição — não sobe em
   * jsdom. Estes dois casos leem o código-fonte, e portanto NÃO pegam a fiação
   * desligada: uma mutação que troque a condição por `false` passa por eles.
   *
   * Medi isso: a mutação passou. O nome do bloco diz isso agora, em vez de o
   * teste alegar uma cobertura que não tem. O comportamento é verificado no
   * navegador, e é lá que ele precisa ser reconferido quando mudar. */
  it('o passo preserva o original em textoCru', () => {
    const fonte = readFileSync(join(raiz, 'src/extract.js'), 'utf8');
    expect(fonte).toMatch(/extraction\.textoCru = extraction\.text/);
    expect(fonte).toMatch(/runLimpezaTranscricao/);
  });

  it('e a organização não derruba a extração quando falha', () => {
    const fonte = readFileSync(join(raiz, 'src/extract.js'), 'utf8');
    expect(fonte).toMatch(/catch \(_\) \{ \/\* segue com o texto cru \*\/ \}/);
  });
});

describe('o histórico saiu da tela principal', () => {
  /* Relato: "o histórico de extrações fica permanentemente visível na tela
   * inicial. Isso ocupa espaço e deixa a interface menos otimizada."
   *
   * Ele ocupava metade da tela — uma coluna inteira da grade — para uma coisa
   * que se consulta de vez em quando. Mesmo molde do Causos e do Julgador:
   * ícone no canto superior direito, gaveta por cima. */
  const drawer = () => document.getElementById('e-history-drawer');
  const backdrop = () => document.getElementById('e-history-backdrop');

  it('há um ícone de histórico no topo, e ele fica no canto das ações', () => {
    expect($$('#e-history-open')).toBeTruthy();
    expect($$('#view-extract .appbar-actions #e-history-open')).toBeTruthy();
  });

  it('o histórico vive numa gaveta, fechada ao abrir a ferramenta', () => {
    expect(drawer()).toBeTruthy();
    expect(drawer().classList.contains('open')).toBe(false);
    expect(backdrop().classList.contains('hidden')).toBe(true);
  });

  it('não sobrou nenhuma coluna de histórico na grade da tela', () => {
    // Sem isto, a gaveta poderia entrar e o painel antigo continuar lá.
    const grade = document.querySelector('#view-extract .grid-2');
    expect(grade, 'a grade de duas colunas devia ter saído').toBeNull();
  });

  it('o ícone abre e o fundo fecha', () => {
    $$('#e-history-open').click();
    expect(drawer().classList.contains('open')).toBe(true);
    expect(backdrop().classList.contains('hidden')).toBe(false);

    backdrop().click();
    expect(drawer().classList.contains('open')).toBe(false);
    expect(backdrop().classList.contains('hidden')).toBe(true);
  });

  it('escolher uma extração fecha a gaveta — quem clicou já foi aonde queria', () => {
    U.State.extractions = [item(), { ...item(), id: 'x2', title: 'Outra' }];
    U.renderExtractionDetail();
    $$('#e-history-open').click();
    const linha = document.querySelector('#e-history [data-eid="x2"]');
    expect(linha, 'a lista da gaveta não foi preenchida').toBeTruthy();
    linha.click();
    expect(drawer().classList.contains('open')).toBe(false);
    expect(U.State.activeExtractionId).toBe('x2');
  });
});
