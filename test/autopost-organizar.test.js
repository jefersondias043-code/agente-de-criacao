// AUTOPOST — organizar o texto extraído de um arquivo, como Causos e Julgador.
//
// Pedido: "seria bom que toda vez que eu extraísse também no AutoPost IA um
// texto, ele fizesse o tratamento, a correção, como ele já faz nas outras duas
// ferramentas — Narrativa, Causos e Julgar."
//
// COMO ISTO É MEDIDO. O app inteiro do AutoPost sobe no jsdom — os mesmos
// arquivos, na mesma ordem do <script> do index.html — e a ÚNICA coisa dublada
// é o `fetch`. Assim o caminho medido é o caminho real: `iniciarRevisao` →
// `obterTextoDoArquivo` → `organizarTexto` → `runLimpezaTranscricao` →
// `callLLM` → rede. Dublar `organizarTexto` provaria apenas que eu sei chamar a
// função que acabei de escrever; dublar a rede prova que ela está LIGADA.
//
// O que precisa continuar valendo:
//   1. texto vindo de ARQUIVO passa pela organização;
//   2. texto COLADO não passa — é do usuário, escrito como ele quis;
//   3. a organização é melhoria, não requisito: se a IA falhar ou a conferência
//      reprovar, o texto cru chega inteiro à revisão. Perder a transcrição por
//      causa de um enfeite seria trocar o certo pelo bonito.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
const html = ler('autopost-ia/index.html');

// A ordem de carga sai do próprio HTML: se um <script> for acrescentado ou
// removido lá, este teste carrega o novo conjunto sem precisar de manutenção —
// e é assim que ele percebe se js/transcricao.js sumir do index.
const SCRIPTS = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);

// Transcrição crua como o Whisper devolve: sem pontuação, sem quem fala, número
// em algarismo, nome próprio em minúscula. Precisa passar de 200 caracteres,
// senão `transcricaoVale` diz (com razão) que não há o que organizar.
const CRU =
  'então eu tava lá no mercado sabe e o seu joão chegou perto de mim e falou ' +
  'olha eu comprei esse relógio por 350 reais e eu falei nossa mas isso é muito ' +
  'caro e ele disse não é não porque esse relógio aqui ele é original e eu olhei ' +
  'e vi que tava escrito rolexx com dois xis aí eu não falei nada só fiquei ' +
  'olhando pra cara dele esperando ele perceber sozinho e ele não percebeu';

const ORGANIZADO =
  '— Então eu estava lá no mercado, sabe? E o seu João chegou perto de mim e falou:\n\n' +
  '— Olha, eu comprei esse relógio por trezentos e cinquenta reais.\n\n' +
  '— Nossa, mas isso é muito caro!\n\n' +
  '— Não é não, porque esse relógio aqui é original.\n\n' +
  'Eu olhei e vi que estava escrito "Rolexx", com dois xis. Aí eu não falei nada, ' +
  'só fiquei olhando para a cara dele, esperando ele perceber sozinho. E ele não percebeu.';

/** Sobe o AutoPost inteiro no jsdom com o `fetch` dublado.
 *
 * `quebrarEtapa` troca `runLimpezaTranscricao` por uma que estoura. Precisa ser
 * feito DENTRO do mesmo eval: os arquivos são scripts clássicos e as declarações
 * ficam no escopo do eval, não no `window` — de fora não há como alcançá-las. */
function subirApp({ resposta, quebrarEtapa } = {}) {
  const dom = new JSDOM(html, { url: 'https://exemplo.test/autopost-ia/', runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  w.scrollTo = () => {};
  w.alert = (m) => { w.__alertas.push(m); };
  w.__alertas = [];
  w.__chamadas = [];
  w.localStorage.setItem('groq_api_key', 'chave-de-teste');

  // `resposta(prompt, n)` devolve o texto do modelo, ou lança para simular
  // falha de rede. Sem dublê, nenhuma chamada é permitida.
  w.fetch = async (_url, opcoes) => {
    const corpo = JSON.parse(opcoes.body);
    const prompt = corpo.messages[corpo.messages.length - 1].content;
    w.__chamadas.push(prompt);
    if (typeof resposta !== 'function') throw new Error('chamada de rede inesperada');
    const texto = await resposta(prompt, w.__chamadas.length);
    return {
      ok: true, status: 200,
      headers: { get: () => null },
      json: async () => ({ choices: [{ message: { content: texto } }] }),
      text: async () => texto,
    };
  };

  const codigo = SCRIPTS.map((f) => ler(path.join('autopost-ia', f))).join('\n;\n');
  const sabotagem = quebrarEtapa
    ? `\n;runLimpezaTranscricao = function () { throw new Error('defeito na etapa'); };`
    : '';
  w.eval(`${codigo}${sabotagem}\n;window.__CAP__ = { iniciarRevisao };`);
  return w;
}

/** Põe um .txt no input de arquivo (jsdom não deixa atribuir `files`). */
function anexarTxt(w, conteudo, nome = 'transcricao.txt') {
  const arquivo = new w.File([conteudo], nome, { type: 'text/plain' });
  Object.defineProperty(w.document.getElementById('transcricaoFile'), 'files', {
    value: [arquivo], configurable: true,
  });
}

const textoDaRevisao = (w) => w.document.getElementById('reviewText').value;
const erroNaTela = (w) => (w.document.getElementById('review-loading').textContent || '');

describe('AutoPost · organizar o texto extraído', () => {
  beforeEach(() => { /* cada teste sobe a sua própria janela */ });

  it('o index.html carrega js/transcricao.js — sem isso nada disto liga', () => {
    expect(SCRIPTS).toContain('js/transcricao.js');
    // Depois de extract.js (de onde vem o texto) e antes de app.js (quem chama).
    expect(SCRIPTS.indexOf('js/transcricao.js')).toBeGreaterThan(SCRIPTS.indexOf('js/extract.js'));
    expect(SCRIPTS.indexOf('js/transcricao.js')).toBeLessThan(SCRIPTS.indexOf('js/app.js'));
  });

  it('texto vindo de ARQUIVO chega organizado à revisão', async () => {
    const w = subirApp({ resposta: () => ORGANIZADO });
    anexarTxt(w, CRU);
    await w.__CAP__.iniciarRevisao();

    expect(w.__chamadas.length).toBe(1);
    expect(textoDaRevisao(w)).toBe(ORGANIZADO);
    // O que o usuário vê de diferente: pontuação, quem fala, número por extenso.
    expect(textoDaRevisao(w)).toContain('trezentos e cinquenta');
    expect(textoDaRevisao(w)).not.toBe(CRU);
  });

  it('a IA recebe o texto cru e a instrução de ORGANIZAR, não de reescrever', async () => {
    const w = subirApp({ resposta: () => ORGANIZADO });
    anexarTxt(w, CRU);
    await w.__CAP__.iniciarRevisao();

    const prompt = w.__chamadas[0];
    expect(prompt).toContain('mercado');           // o texto cru foi junto
    expect(prompt.toLowerCase()).toContain('organiz');
    expect(prompt.toLowerCase()).toMatch(/não (invent|acrescent|reescrev)/);
  });

  it('texto COLADO não passa pela organização — é do usuário', async () => {
    const w = subirApp({ resposta: () => ORGANIZADO });
    w.document.getElementById('transcricaoTexto').value = CRU;
    await w.__CAP__.iniciarRevisao();

    expect(w.__chamadas.length).toBe(0);
    expect(textoDaRevisao(w)).toBe(CRU);
  });

  it('IA fora do ar: o texto cru chega inteiro (melhoria, não requisito)', async () => {
    // Erro de rede é tratado DENTRO de runLimpezaTranscricao, fatia por fatia:
    // a fatia que falhou volta crua e a função devolve texto normalmente.
    const w = subirApp({ resposta: () => { throw new Error('sem rede'); } });
    anexarTxt(w, CRU);
    await w.__CAP__.iniciarRevisao();

    expect(w.__chamadas.length).toBe(1);
    expect(textoDaRevisao(w)).toBe(CRU);
    expect(erroNaTela(w)).not.toMatch(/Não foi possível concluir/);
  });

  it('defeito NA PRÓPRIA etapa: a extração não cai junto', async () => {
    // Este é o caso que o `try/catch` de `organizarTexto` cobre, e o de cima
    // NÃO cobre: um erro que escapa de `runLimpezaTranscricao` inteira (um bug
    // dentro dela, não uma chamada que falhou). Sem a rede, a etapa opcional
    // levaria a transcrição do usuário junto — e ela é o trabalho de verdade.
    const w = subirApp({ resposta: () => ORGANIZADO, quebrarEtapa: true });
    anexarTxt(w, CRU);
    await w.__CAP__.iniciarRevisao();

    expect(textoDaRevisao(w)).toBe(CRU);
    expect(erroNaTela(w)).not.toMatch(/Não foi possível concluir/);
  });

  it('sem chave da API: o texto cru chega inteiro, sem travar a tela', async () => {
    const w = subirApp({ resposta: () => ORGANIZADO });
    w.localStorage.removeItem('groq_api_key');
    anexarTxt(w, CRU);
    await w.__CAP__.iniciarRevisao();

    expect(w.__chamadas.length).toBe(0);
    expect(textoDaRevisao(w)).toBe(CRU);
  });

  it('IA inventando conteúdo: a conferência reprova e fica o texto cru', async () => {
    // O estrago que a conferência existe para evitar: o texto fica ótimo e está
    // errado. Aqui a "organização" inventa uma cena inteira que ninguém disse.
    const inventado =
      'Seu João comprou um relógio falsificado numa banca do centro da cidade. ' +
      'Ele havia sido enganado por um vendedor ambulante que fugiu logo em seguida. ' +
      'A polícia foi chamada e prendeu o golpista na tarde do mesmo dia, ' +
      'recuperando quinze relógios idênticos escondidos numa mochila azul. ' +
      'O delegado disse que a quadrilha agia há meses naquela região movimentada.';
    const w = subirApp({ resposta: () => inventado });
    anexarTxt(w, CRU);
    await w.__CAP__.iniciarRevisao();

    expect(w.__chamadas.length).toBe(1);
    expect(textoDaRevisao(w)).toBe(CRU);
    expect(textoDaRevisao(w)).not.toContain('delegado');
  });

  it('texto curto demais não gasta uma chamada de IA', async () => {
    const w = subirApp({ resposta: () => ORGANIZADO });
    anexarTxt(w, 'oi tudo bem então é isso aí valeu pessoal até a próxima');
    await w.__CAP__.iniciarRevisao();

    expect(w.__chamadas.length).toBe(0);
    expect(textoDaRevisao(w)).toBe('oi tudo bem então é isso aí valeu pessoal até a próxima');
  });
});

describe('AutoPost · js/transcricao.js é cópia declarada de src/transcricao.js', () => {
  // O AutoPost é pacote fechado (tem de abrir por file:// sem a plataforma em
  // volta), então a implementação vive em duas casas. Este teste é o que impede
  // as duas de virarem duas implementações diferentes com o tempo: só o cabeçalho
  // pode divergir — dali para baixo, byte a byte.
  const corpo = (s) => s.slice(s.indexOf('*/') + 2);

  it('o código é idêntico do fim do cabeçalho em diante', () => {
    expect(corpo(ler('autopost-ia/js/transcricao.js')))
      .toBe(corpo(ler('src/transcricao.js')));
  });

  it('a cópia do AutoPost está declarada como cópia no cabeçalho', () => {
    const cabecalho = ler('autopost-ia/js/transcricao.js').split('*/')[0];
    expect(cabecalho).toContain('CÓPIA DECLARADA');
    expect(cabecalho).toContain('src/transcricao.js');
  });

  it('o corpo comparado não está vazio — a comparação precisa comparar algo', () => {
    // Sem isto, apagar os dois arquivos deixaria o teste acima verde.
    const c = corpo(ler('autopost-ia/js/transcricao.js'));
    expect(c.length).toBeGreaterThan(3000);
    expect(c).toContain('function runLimpezaTranscricao');
    expect(c).toContain('function conferirTranscricao');
  });
});
