// TEMA DO AUTOPOST — o padrão depende de onde a ferramenta está aberta.
//
// Relato: "Ele está sempre iniciando no tema escuro, mesmo que o aplicativo
// esteja no tema claro."
//
// Causa: o padrão do tema tinha DUAS FONTES que discordavam. O script inline do
// <head> (que pinta antes do primeiro frame) já sabia distinguir embutida de
// avulsa; `temaAtual()` em js/config.js não sabia — devolvia 'dark' para
// qualquer coisa não guardada. E o boot chama `aplicarTema(temaAtual(), false)`,
// então o config desfazia o acerto do inline no primeiro frame. O usuário via o
// escuro porque a segunda fonte era a que tinha a última palavra.
//
// Por isso estes testes NÃO conferem o texto dos dois arquivos: eles EXECUTAM as
// duas fontes, na mesma janela e na mesma ordem do navegador, e comparam o
// [data-theme] que sobra. Conferir só uma das duas era exatamente o que deixava
// o bug passar; conferir o código-fonte de cada uma deixaria passar de novo se
// as duas continuassem discordando em silêncio.
//
// O VALOR do padrão embutido veio de MEDIÇÃO, não de raciocínio. Escrevi
// primeiro 'system', achando que a plataforma-mãe seguisse `prefers-color-scheme`.
// No Chromium ela não segue: com o sistema no escuro o pai continua claro
// (rgb(247,246,242)) — é um app de tema único. Com 'system' a ferramenta iria
// para o escuro dentro de um app claro, que é o relato de novo, do avesso. Daí
// 'light', e daí também o teste que vigia essa premissa lá embaixo.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(raiz, 'autopost-ia/index.html'), 'utf8');
const config = fs.readFileSync(path.join(raiz, 'autopost-ia/js/config.js'), 'utf8');

// O bootstrap inline é o PRIMEIRO <script> sem src do <head>.
const INLINE = (() => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  return m ? m[1] : '';
})();

function janela({ embutida = false, guardado = null, sistemaEscuro = false } = {}) {
  // `outside-only`: os <script> do documento NÃO rodam sozinhos — quem decide a
  // ordem é o teste, que roda inline e config na sequência do navegador.
  const dom = new JSDOM(html, { url: 'https://exemplo.test/autopost-ia/', runScripts: 'outside-only' });
  const w = dom.window;
  // Embutida = dentro do <iframe> da plataforma (src/autopost.js → mountToolFrame).
  if (embutida) Object.defineProperty(w, 'parent', { value: { embutida: true }, configurable: true });
  w.matchMedia = (q) => ({
    matches: /dark/.test(q) ? !!sistemaEscuro : !sistemaEscuro,
    addEventListener() {}, addListener() {},
  });
  if (guardado !== null) w.localStorage.setItem('autopost:tema', guardado);
  w.document.documentElement.removeAttribute('data-theme');
  return w;
}

const temaNoHtml = (w) => w.document.documentElement.getAttribute('data-theme');

/** Roda o bootstrap inline do <head> — o que pinta antes do primeiro frame. */
function rodarInline(w) {
  w.eval(INLINE);
  return temaNoHtml(w);
}

/** Roda js/config.js e repete o que `initThemeUI()` faz no boot.
 *
 * `temaPadrao` é capturado com `typeof` de propósito: numa versão do config que
 * não tenha a função, a captura estourava um ReferenceError e TODOS os testes
 * quebravam por falta de símbolo — escondendo quais tinham quebrado pelo TEMA.
 * Um controle negativo que reprova por outro motivo não mede nada. A existência
 * da função tem teste próprio, abaixo. */
function rodarConfig(w) {
  w.eval(`${config}\n;window.__CAP__ = { temaAtual, aplicarTema,` +
    ` temaPadrao: (typeof temaPadrao === 'function' ? temaPadrao : null) };`);
  const cap = w.__CAP__;
  cap.aplicarTema(cap.temaAtual(), false);
  return {
    tema: temaNoHtml(w),
    padrao: cap.temaPadrao ? cap.temaPadrao() : null,
    atual: cap.temaAtual(),
  };
}

const CENARIOS = [
  // Nada guardado: é aqui que o padrão manda — e era aqui que as duas fontes
  // discordavam.
  { nome: 'avulsa, nada guardado', opcoes: { embutida: false, guardado: null }, esperado: 'dark' },
  { nome: 'embutida, nada guardado', opcoes: { embutida: true, guardado: null }, esperado: 'light' },
  // Embutida, o aparelho não decide: a plataforma é clara sempre (medido no
  // Chromium), então acompanhar o aparelho seria acompanhar a coisa errada.
  { nome: 'embutida, nada guardado, sistema escuro', opcoes: { embutida: true, guardado: null, sistemaEscuro: true }, esperado: 'light' },
  // Escolha explícita do usuário manda nos dois lugares, dentro e fora.
  { nome: 'embutida, escolheu escuro', opcoes: { embutida: true, guardado: 'dark' }, esperado: 'dark' },
  { nome: 'embutida, escolheu claro', opcoes: { embutida: true, guardado: 'light' }, esperado: 'light' },
  { nome: 'embutida, escolheu sistema', opcoes: { embutida: true, guardado: 'system' }, esperado: 'system' },
  { nome: 'avulsa, escolheu claro', opcoes: { embutida: false, guardado: 'light' }, esperado: 'light' },
  // Valor estragado no localStorage cai no padrão do lugar — nos dois iguais.
  { nome: 'embutida, valor inválido guardado', opcoes: { embutida: true, guardado: 'roxo' }, esperado: 'light' },
  { nome: 'avulsa, valor inválido guardado', opcoes: { embutida: false, guardado: 'roxo' }, esperado: 'dark' },
];

describe('AutoPost · tema: as duas fontes do padrão precisam concordar', () => {
  it('o bootstrap inline existe e é o que escreve o data-theme', () => {
    expect(INLINE).toContain('data-theme');
    expect(INLINE).toContain('autopost:tema');
  });

  it('o config expõe uma função de padrão — a fonte única que faltava', () => {
    const w = janela({ embutida: true });
    w.eval(`${config}\n;window.__CAP__ = { tem: typeof temaPadrao };`);
    expect(w.__CAP__.tem).toBe('function');
  });

  for (const c of CENARIOS) {
    it(`${c.nome}: inline e config chegam ao mesmo tema (${c.esperado})`, () => {
      const inline = rodarInline(janela(c.opcoes));
      const cfg = rodarConfig(janela(c.opcoes));
      // A igualdade é o invariante; o valor esperado impede que as duas fontes
      // concordem no valor ERRADO (era 'dark' nos dois que o usuário não queria).
      expect(inline).toBe(cfg.tema);
      expect(inline).toBe(c.esperado);
    });
  }

  it('o config NÃO desfaz o inline: rodando os dois em sequência, o tema não muda', () => {
    // Reprodução exata do bug: no navegador as duas coisas acontecem na MESMA
    // janela, o inline primeiro e o config no boot. Antes da correção, o config
    // sobrescrevia com 'dark' aqui.
    for (const c of CENARIOS) {
      const w = janela(c.opcoes);
      const depoisDoInline = rodarInline(w);
      const depoisDoConfig = rodarConfig(w).tema;
      expect(`${c.nome}: ${depoisDoConfig}`).toBe(`${c.nome}: ${depoisDoInline}`);
    }
  });

  it('embutida e sem escolha, não inicia no escuro (o relato)', () => {
    const w = janela({ embutida: true, guardado: null, sistemaEscuro: false });
    rodarInline(w);
    const cfg = rodarConfig(w);
    expect(temaNoHtml(w)).not.toBe('dark');
    // A barra do navegador acompanha a mesma decisão — senão a moldura fica
    // escura em volta de uma tela clara.
    const meta = w.document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#faf8f4');
    expect(cfg.padrao).toBe('light');
  });

  it('embutida, o aparelho no escuro NÃO arrasta a ferramenta para o escuro', () => {
    // 'system' pareceria a escolha esperta e é a errada: medido no Chromium, a
    // plataforma-mãe fica clara mesmo com prefers-color-scheme: dark (ela é um
    // app de tema único). Seguir o aparelho seria repetir o desencontro
    // relatado, virado do avesso — ferramenta escura dentro de app claro.
    const w = janela({ embutida: true, guardado: null, sistemaEscuro: true });
    rodarInline(w);
    rodarConfig(w);
    expect(temaNoHtml(w)).toBe('light');
    const meta = w.document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#faf8f4');
  });

  it('a plataforma-mãe é de tema único e claro — a premissa do padrão acima', () => {
    // Se um dia a plataforma ganhar tema escuro de verdade, este teste cai e
    // avisa que o padrão do embutido precisa ser revisto. É a premissa do
    // 'light' virada em alarme, para ela não envelhecer calada.
    const estilos = fs.readFileSync(path.join(raiz, 'styles.css'), 'utf8');
    const raizEscura = /:root\s*\[data-theme="dark"\]|html\[data-theme="dark"\]/.test(estilos);
    expect(raizEscura, 'a plataforma ganhou seletor de tema escuro').toBe(false);
  });

  it('avulsa (file:// ou aba própria) continua escura — é a cara da ferramenta', () => {
    const w = janela({ embutida: false, guardado: null, sistemaEscuro: false });
    rodarInline(w);
    rodarConfig(w);
    expect(temaNoHtml(w)).toBe('dark');
  });

  it('o CSS sabe pintar [data-theme="system"] — é opção do seletor', () => {
    // 'system' não é mais o padrão de lugar nenhum, mas continua sendo uma das
    // três opções do seletor. Sem regra no CSS, escolher "⚙ Sistema" deixaria a
    // tela sem tokens de cor.
    const css = fs.readFileSync(path.join(raiz, 'autopost-ia/css/app.css'), 'utf8');
    expect(css).toMatch(/\[data-theme="system"\]/);
  });
});
