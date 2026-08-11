// COPIAR — o botão que não fazia nada
//
// Duas ferramentas chamavam um `copyText` que NUNCA EXISTIU. O clique morria
// num ReferenceError: não copiava, não avisava, não deixava rastro. Para quem
// usava, o botão simplesmente não respondia.
//
// As outras duas chamavam `navigator.clipboard.writeText` direto, sem esperar e
// sem tratar erro, e anunciavam "copiado" na linha seguinte — tivesse dado
// certo ou não. Em `file://`, onde `navigator.clipboard` costuma não existir,
// isso é falha silenciosa com aviso de sucesso.
//
// POR QUE NENHUM TESTE PEGOU: havia teste de tela para as duas ferramentas, e
// nenhum deles CLICAVA no botão de copiar. Cobertura de arquivo não é cobertura
// de comportamento.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let C;
beforeAll(() => {
  clearStorage();
  C = loadModules(['catalogs.js', 'core.js'], ['copyText', 'copyTextComAviso']);
});

/** Deixa o ambiente sem `navigator.clipboard`, como num `file://`. */
const semClipboardModerno = () => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
};
/** Instala um `navigator.clipboard` que grava — ou que recusa. */
const comClipboard = (recusa) => {
  const caixa = { texto: null };
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: async (t) => {
        if (recusa) throw new Error('NotAllowedError');
        caixa.texto = t;
      },
    },
    configurable: true,
  });
  return caixa;
};

/** jsdom não implementa `execCommand`; instalamos um que registra o que copiou. */
const comExecCommand = (deuCerto) => {
  const caixa = { chamado: 0, texto: null };
  document.execCommand = (cmd) => {
    if (cmd !== 'copy') return false;
    caixa.chamado++;
    const ta = document.querySelector('textarea[readonly]');
    caixa.texto = ta ? ta.value : null;
    return deuCerto !== false;
  };
  return caixa;
};

beforeEach(() => {
  document.body.innerHTML = '<div id="toast-stack"></div>';
});

describe('a função existe — e é a mesma para a plataforma inteira', () => {
  it('`copyText` é uma função de verdade', () => {
    // O defeito relatado, na sua forma mais crua: a função nem existia, e todo
    // clique morria num ReferenceError.
    expect(typeof C.copyText).toBe('function');
  });

  it('nenhuma ferramenta copia por fora do helper', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
    const soltos = fs.readdirSync(src).filter((f) => f.endsWith('.js') && f !== 'core.js')
      .filter((f) => /clipboard\.writeText/.test(fs.readFileSync(path.join(src, f), 'utf8')));
    expect(soltos, 'copiar por fora perde o plano B do file://').toEqual([]);
  });
});

describe('o caminho moderno', () => {
  it('usa a área de transferência do navegador quando ela existe', async () => {
    const caixa = comClipboard();
    expect(await C.copyText('o diagnóstico inteiro')).toBe(true);
    expect(caixa.texto).toBe('o diagnóstico inteiro');
  });
});

describe('o plano B — que é o que faz funcionar em file://', () => {
  it('sem `navigator.clipboard`, copia pela textarea escondida', async () => {
    // Esta plataforma roda por `file://`, e ali a API moderna costuma não
    // existir. Sem o plano B, o botão volta a não fazer nada.
    semClipboardModerno();
    const exec = comExecCommand(true);
    expect(await C.copyText('texto do causo')).toBe(true);
    expect(exec.chamado).toBe(1);
    expect(exec.texto, 'copiou outra coisa que não o texto pedido').toBe('texto do causo');
  });

  it('quando a API moderna RECUSA, ainda tenta o plano B', async () => {
    // Permissão negada é o caso comum em aba não focada.
    comClipboard(true);
    const exec = comExecCommand(true);
    expect(await C.copyText('texto do causo')).toBe(true);
    expect(exec.chamado).toBe(1);
  });

  it('a textarea some depois de usada', async () => {
    semClipboardModerno();
    comExecCommand(true);
    await C.copyText('qualquer coisa');
    expect(document.querySelector('textarea[readonly]'), 'deixou lixo na tela').toBeNull();
  });

  it('falhando os dois caminhos, devolve false em vez de mentir', async () => {
    semClipboardModerno();
    comExecCommand(false);
    expect(await C.copyText('texto')).toBe(false);
  });

  it('texto vazio não é cópia', async () => {
    comClipboard();
    expect(await C.copyText('')).toBe(false);
    expect(await C.copyText(null)).toBe(false);
  });
});

describe('o aviso diz a verdade', () => {
  const avisos = () => [...document.getElementById('toast-stack').children].map((t) => t.textContent);

  it('copiou: confirma, com a mensagem de quem chamou', async () => {
    comClipboard();
    await C.copyTextComAviso('conteúdo', 'Diagnóstico copiado.');
    expect(avisos().join(' ')).toMatch(/Diagnóstico copiado\./);
  });

  it('NÃO copiou: diz que não copiou, em vez de anunciar sucesso', async () => {
    // O defeito das outras duas ferramentas: `writeText` sem await, e o toast
    // de sucesso na linha seguinte — desse ou não desse certo.
    semClipboardModerno();
    comExecCommand(false);
    const deu = await C.copyTextComAviso('conteúdo', 'Diagnóstico copiado.');
    expect(deu).toBe(false);
    const t = avisos().join(' ');
    expect(t, 'anunciou sucesso sem ter copiado').not.toMatch(/copiado/i);
    expect(t).toMatch(/Não foi possível copiar/);
    expect(t, 'sem saída, o aviso não ajuda').toMatch(/copie à mão/);
  });
});
