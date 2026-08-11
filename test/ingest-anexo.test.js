// ANEXAR — o gesto que faz a transcrição funcionar no celular
//
// Comprimir mídia grande usa Web Audio, e no iOS o AudioContext só sai de
// "suspended" a partir de um gesto do usuário. O evento `change` de um
// <input type=file> NÃO conta. Sem o gesto, `decodeAudioData` nunca resolve: o
// usuário espera 45 segundos e recebe "formato incompatível" — com o formato
// perfeitamente compatível o tempo todo.
//
// Por isso o cartão com o botão "Transcrever": o toque nele é o gesto.
//
// Este arquivo existe porque a plataforma tinha o cartão implementado quatro
// vezes e testado zero. Gerar e Narrativa tinham; Causos e Julgador, copiados da
// fiação sem cartão, não tinham — e falhavam exatamente assim no celular. O
// teste do predicado (`_genEhMidiaGrande`) passava nas quatro, porque o
// predicado nunca foi o problema: o problema era quem chamava o quê.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let I;
beforeAll(() => {
  clearStorage();
  I = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'media-transcode.js', 'ingest.js'],
    ['ingestAnexar', 'ingestLigarAnexo', 'ingestEhMidiaGrande', 'ingestKind',
      'INGEST_ACCEPT', 'WHISPER_SAFE_BYTES']);
});

const arquivo = (nome, bytes, tipo = '') => {
  const f = new Blob(['x'], { type: tipo });
  Object.defineProperty(f, 'size', { value: bytes });
  Object.defineProperty(f, 'name', { value: nome });
  return f;
};
const grande = () => I.WHISPER_SAFE_BYTES + 1024;
const pequeno = 1024 * 1024;

beforeEach(() => {
  document.body.innerHTML = `
    <div id="pendente"></div>
    <textarea id="campo"></textarea>
    <input type="file" id="entrada" />
    <button id="botao"></button>
    <div id="toast-stack"></div>`;
});

/* COMO SE SABE QUE A CONVERSÃO COMEÇOU.
 *
 * Substituir `ingestFileNative` por um espião não funciona aqui: os módulos
 * rodam em `'use strict'` dentro de um eval isolado, então a chamada resolve
 * pela ligação léxica e ignora qualquer coisa posta no global. A primeira
 * versão deste arquivo tentou isso e os espiões nunca eram chamados.
 *
 * A costura de verdade já existe no código: `ingestFileNative` monta o toast de
 * progresso ANTES de qualquer await. Contar os toasts prova que a função de
 * produção rodou — é mais forte que um espião, porque não substitui nada. */
const conversoesIniciadas = () => document.getElementById('toast-stack').children.length;

/** Um arquivo de texto DE VERDADE atravessa o pipeline inteiro sem dublê. */
const arquivoDeTexto = (nome, conteudo) => {
  const f = new Blob([conteudo], { type: 'text/plain' });
  Object.defineProperty(f, 'name', { value: nome });
  return f;
};
const esperar = () => new Promise((r) => setTimeout(r, 30));

describe('quem precisa de gesto', () => {
  it('vídeo e áudio acima do limite seguro precisam', () => {
    expect(I.ingestEhMidiaGrande(arquivo('clipe.mp4', grande(), 'video/mp4'))).toBe(true);
    expect(I.ingestEhMidiaGrande(arquivo('fala.m4a', grande(), 'audio/mp4'))).toBe(true);
  });

  it('mídia pequena não passa pelo compressor, então não precisa', () => {
    expect(I.ingestEhMidiaGrande(arquivo('curto.mp4', pequeno, 'video/mp4'))).toBe(false);
  });

  it('imagem e PDF não são mídia — OCR e pdf.js não usam Web Audio', () => {
    expect(I.ingestEhMidiaGrande(arquivo('foto.png', grande(), 'image/png'))).toBe(false);
    expect(I.ingestEhMidiaGrande(arquivo('doc.pdf', grande(), 'application/pdf'))).toBe(false);
  });
});

describe('o cartão de gesto', () => {
  it('mídia grande NÃO começa a converter sozinha — espera o toque', () => {
    I.ingestAnexar(arquivo('clipe.mp4', grande(), 'video/mp4'), () => {}, '#pendente');
    expect(conversoesIniciadas(), 'converteu sem gesto: é a falha do celular').toBe(0);
    expect(document.querySelector('[data-attach-go]'), 'sem botão, não há gesto possível').toBeTruthy();
  });

  it('o toque no botão é o que dispara a conversão', () => {
    I.ingestAnexar(arquivo('clipe.mp4', grande(), 'video/mp4'), () => {}, '#pendente');
    expect(conversoesIniciadas()).toBe(0);
    document.querySelector('[data-attach-go]').click();
    expect(conversoesIniciadas(), 'o gesto não destravou a conversão').toBe(1);
    expect(document.querySelector('#pendente').innerHTML, 'o cartão fica na tela depois de usado').toBe('');
  });

  it('o cartão diz de que arquivo se trata', () => {
    I.ingestAnexar(arquivo('entrevista longa.mp4', grande(), 'video/mp4'), () => {}, '#pendente');
    const t = document.querySelector('#pendente').textContent;
    expect(t).toMatch(/entrevista longa\.mp4/);
    expect(t).toMatch(/será comprimido e transcrito/);
  });

  it('dá para desistir sem converter', () => {
    I.ingestAnexar(arquivo('clipe.mp4', grande(), 'video/mp4'), () => {}, '#pendente');
    document.querySelector('[data-attach-cancel]').click();
    expect(document.querySelector('#pendente').innerHTML).toBe('');
    expect(conversoesIniciadas()).toBe(0);
  });

  it('arquivo pequeno converte direto, sem clique a mais', () => {
    I.ingestAnexar(arquivo('curto.mp4', pequeno, 'video/mp4'), () => {}, '#pendente');
    expect(conversoesIniciadas()).toBe(1);
    expect(document.querySelector('#pendente').innerHTML, 'não devia montar cartão').toBe('');
  });

  it('PDF converte direto mesmo sendo grande', () => {
    I.ingestAnexar(arquivo('livro.pdf', grande(), 'application/pdf'), () => {}, '#pendente');
    expect(conversoesIniciadas()).toBe(1);
  });

  it('sem container de cartão, converte direto em vez de engolir o anexo', () => {
    // Degradar assim é melhor do que não fazer nada: no desktop funciona igual.
    I.ingestAnexar(arquivo('clipe.mp4', grande(), 'video/mp4'), () => {}, '#nao-existe');
    expect(conversoesIniciadas()).toBe(1);
  });
});

describe('a fiação de um campo de anexo', () => {
  // Estes dois usam um .txt de verdade: ele atravessa `ingestFileNative` →
  // `ingestToText` → `readTextFile` sem nenhum dublê no caminho.
  it('o texto extraído entra no campo e avisa quem escuta', async () => {
    I.ingestLigarAnexo({ botao: '#botao', input: '#entrada', campo: '#campo', pendente: '#pendente' });
    const campo = document.getElementById('campo');
    let avisou = false;
    campo.addEventListener('input', () => { avisou = true; });
    campo.value = 'o que já estava lá';

    const inp = document.getElementById('entrada');
    Object.defineProperty(inp, 'files', { value: [arquivoDeTexto('a.txt', 'texto transcrito')], configurable: true });
    inp.onchange();
    await esperar();

    expect(campo.value).toBe('o que já estava lá\n\ntexto transcrito');
    expect(avisou, 'sem o evento, o rascunho não guarda o que foi transcrito').toBe(true);
  });

  it('o separador do modo Seleção mantém cada vídeo como um item', async () => {
    I.ingestLigarAnexo({ botao: '#botao', input: '#entrada', campo: '#campo',
      pendente: '#pendente', separador: '\n\n---\n\n' });
    const campo = document.getElementById('campo');
    campo.value = 'primeiro vídeo';
    const inp = document.getElementById('entrada');
    Object.defineProperty(inp, 'files', { value: [arquivoDeTexto('b.txt', 'segundo vídeo')], configurable: true });
    inp.onchange();
    await esperar();
    expect(campo.value).toBe('primeiro vídeo\n\n---\n\nsegundo vídeo');
  });

  it('o campo aceita os formatos que a plataforma sabe converter', () => {
    I.ingestLigarAnexo({ botao: '#botao', input: '#entrada', campo: '#campo' });
    expect(document.getElementById('entrada').accept).toBe(I.INGEST_ACCEPT);
    expect(I.INGEST_ACCEPT).toMatch(/\.mp4/);
    expect(I.INGEST_ACCEPT).toMatch(/\.m4a/);
  });
});
