// MÍDIA GRANDE — a fiação que faz o compressor ser CHAMADO
//
// Relato do usuário depois da remoção do AutoPost IA (r227): "acabou também
// excluindo uma funcionalidade importante, que era a transcrição de arquivos
// grandes… as outras ferramentas foram comprometidas."
//
// MEDIDO, e o relato não se confirmou: `src/media-transcode.js` é um PORT do
// AutoPost para a plataforma, feito antes da remoção, e o r227 só mudou
// comentários nele. No Chromium, um WAV de 25,2 MB anexado no Causos passou
// pelo cartão de gesto, foi comprimido para 2,29 MB em 10,8 s e virou uma única
// chamada à Whisper, com o texto entregue no campo.
//
// MAS A LACUNA ERA REAL E ESTÁ AQUI. O único teste que existia
// (media-transcode.test.js) cobre `planejarPartes`, que é aritmética pura, e o
// `_comTimeout`. NADA cobria a fiação: se `media-transcode.js` saísse do
// manifesto, se o `lamejs` deixasse de ser carregado, ou se `transcribeMedia`
// parasse de desviar o arquivo grande para o compressor, todos os testes
// continuariam verdes e a ferramenta mandaria 25 MB direto para uma API que
// aceita 25 MB — falhando exatamente como o usuário descreveu.
//
// O demux e o encoder dependem de Web Audio e não rodam em jsdom; o que roda
// aqui é a DECISÃO de chamá-los, que é o que a remoção poderia ter quebrado.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (f) => readFileSync(join(raiz, f), 'utf8');

let M;
beforeAll(() => {
  clearStorage();
  M = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'media-transcode.js', 'ingest.js'],
    ['WHISPER_SAFE_BYTES', 'WHISPER_MAX_BYTES', 'otimizarArquivo', 'transcreverPartes',
      'planejarPartes', 'ingestEhMidiaGrande', 'FALLBACK_MAX_BYTES']);
});

const arquivo = (bytes, nome = 'audio.mp3', tipo = 'audio/mpeg') => {
  const f = new Blob(['x'], { type: tipo });
  Object.defineProperty(f, 'size', { value: bytes });
  Object.defineProperty(f, 'name', { value: nome });
  return f;
};

describe('o compressor está carregado na plataforma', () => {
  it('media-transcode.js está no manifesto de scripts', () => {
    expect(ler('scripts/scripts.manifest.mjs')).toContain("'media-transcode.js'");
  });

  it('o index.html carrega o encoder MP3 ANTES do módulo que o usa', () => {
    // `otimizarArquivo` estoura com "o compactador não carregou" se o lamejs
    // não estiver de pé — e a ordem das tags é o que garante isso.
    // As TAGS, não as menções: o index.html cita "src/media-transcode.js" num
    // comentário ANTES de carregar o lamejs, e a primeira versão deste teste
    // comparou a posição do comentário — reprovando um HTML correto.
    const html = ler('index.html');
    const lame = html.indexOf('<script src="vendor/lamejs.js">');
    const mt = html.indexOf('<script src="src/media-transcode.js">');
    expect(lame, 'vendor/lamejs.js sumiu do index.html').toBeGreaterThan(-1);
    expect(mt, 'src/media-transcode.js sumiu do index.html').toBeGreaterThan(-1);
    expect(lame).toBeLessThan(mt);
  });

  it('o service worker guarda os dois para funcionar offline', () => {
    const sw = ler('service-worker.js');
    expect(sw).toContain('./vendor/lamejs.js');
    expect(sw).toContain('./src/media-transcode.js');
  });

  it('as funções que a ingestão chama existem', () => {
    expect(typeof M.otimizarArquivo).toBe('function');
    expect(typeof M.transcreverPartes).toBe('function');
    expect(typeof M.WHISPER_SAFE_BYTES).toBe('number');
  });
});

describe('arquivo grande NÃO vai direto para a API', () => {
  /* `transcribeMedia` decide entre mandar direto e comprimir. A decisão é uma
   * ligação léxica dentro do eval dos módulos, então a única forma honesta de
   * observá-la é substituir `otimizarArquivo` e `transcribeMediaDirect` DENTRO
   * do mesmo eval — mesma técnica do r225. */
  const carregarCom = (sabotagem) => loadModules(
    ['core.js', 'media-transcode.js', 'ingest.js'],
    ['transcribeMedia', 'WHISPER_SAFE_BYTES', 'WHISPER_MAX_BYTES', '__espiao'],
    sabotagem);

  it('acima do limite seguro, passa pelo compressor', async () => {
    const M2 = carregarCom(`
      globalThis.__espiao = { otimizou: 0, direto: 0, partes: 0 };
      ingestGroqKey = () => 'chave';
      otimizarArquivo = async (f) => { __espiao.otimizou++; return { arquivos: [f, f] }; };
      transcreverPartes = async (a) => { __espiao.partes = a.length; return 'texto das partes'; };
      transcribeMediaDirect = async () => { __espiao.direto++; return 'direto'; };
    `);
    const texto = await M2.transcribeMedia(arquivo(M2.WHISPER_SAFE_BYTES + 1));
    expect(M2.__espiao.otimizou).toBe(1);
    expect(M2.__espiao.direto).toBe(0);
    expect(M2.__espiao.partes).toBe(2);
    expect(texto).toBe('texto das partes');
  });

  it('abaixo do limite, vai direto — comprimir à toa custa tempo do usuário', async () => {
    const M2 = carregarCom(`
      globalThis.__espiao = { otimizou: 0, direto: 0 };
      ingestGroqKey = () => 'chave';
      otimizarArquivo = async (f) => { __espiao.otimizou++; return { arquivos: [f] }; };
      transcribeMediaDirect = async () => { __espiao.direto++; return 'direto'; };
    `);
    const texto = await M2.transcribeMedia(arquivo(1024 * 1024));
    expect(M2.__espiao.otimizou).toBe(0);
    expect(M2.__espiao.direto).toBe(1);
    expect(texto).toBe('direto');
  });

  it('sem compressor, o que ainda cabe na API vai direto', async () => {
    /* 23 MB é o limite SEGURO, não o da API (25 MB). Sem compressor, mandar
     * direto é a degradação certa — e a primeira versão deste teste exigia
     * recusa aqui, reprovando o comportamento correto. */
    const M2 = carregarCom(`
      globalThis.__espiao = { direto: 0 };
      ingestGroqKey = () => 'chave';
      otimizarArquivo = undefined;
      transcreverPartes = undefined;
      transcribeMediaDirect = async () => { __espiao.direto++; return 'direto'; };
    `);
    expect(await M2.transcribeMedia(arquivo(M2.WHISPER_SAFE_BYTES + 1))).toBe('direto');
    expect(M2.__espiao.direto).toBe(1);
  });

  it('sem compressor, o que NÃO cabe é recusado com mensagem — não jogado na API', async () => {
    // É o cenário que o usuário descreveu: o compressor some e o arquivo grande
    // bate na API. O certo é dizer que não dá, não tentar e falhar por HTTP.
    const M2 = carregarCom(`
      globalThis.__espiao = { direto: 0 };
      ingestGroqKey = () => 'chave';
      otimizarArquivo = undefined;
      transcreverPartes = undefined;
      transcribeMediaDirect = async () => { __espiao.direto++; return 'direto'; };
    `);
    await expect(M2.transcribeMedia(arquivo(M2.WHISPER_MAX_BYTES + 1)))
      .rejects.toThrow(/muito grande/i);
    expect(M2.__espiao.direto).toBe(0);
  });
});

describe('o plano de compressão cabe no que a API aceita', () => {
  it('uma parte no bitrate planejado nunca passa do limite seguro', () => {
    // A conta que sustenta tudo: se ela errar, a compressão "funciona" e a
    // API recusa mesmo assim.
    for (const dur of [60, 600, 3600, 7200, 20000]) {
      const p = M.planejarPartes(dur);
      const bytesPorParte = (p.kbps * 1000 * (dur / p.partes)) / 8;
      expect(bytesPorParte, `${dur}s → ${p.partes} parte(s) a ${p.kbps} kbps`)
        .toBeLessThanOrEqual(M.WHISPER_SAFE_BYTES * 1.02);
    }
  });

  it('mídia grande é reconhecida como grande pela tela', () => {
    expect(M.ingestEhMidiaGrande(arquivo(M.WHISPER_SAFE_BYTES + 1))).toBe(true);
    expect(M.ingestEhMidiaGrande(arquivo(1024))).toBe(false);
  });
});

describe('quando não dá, a mensagem diz POR QUE', () => {
  /* O relato que abriu esta investigação foi a mensagem genérica:
   * "Não foi possível abrir este arquivo neste aparelho. Pode ser um formato
   * incompatível — tente MP3, M4A, WAV, MP4 ou MOV — ou um arquivo longo demais
   * para a memória."
   *
   * Ela listava quatro causas e não dizia qual era, porque `otimizarArquivo`
   * trocava QUALQUER erro por esse texto. Medido no Chromium: um M4A gravado
   * pelo próprio navegador é recusado pelo leitor em partes ("sem trilha de
   * áudio AAC" — é um MP4 fragmentado) e caía no caminho que abre o arquivo
   * inteiro na memória. Num vídeo de celular de centenas de megas, esse caminho
   * derruba a aba — e a pessoa recebia "formato incompatível" sobre um formato
   * perfeitamente compatível. */
  const comFonte = (corpo) => loadModules(
    ['core.js', 'media-transcode.js', 'ingest.js'],
    ['otimizarArquivo', 'FALLBACK_MAX_BYTES', 'WHISPER_SAFE_BYTES'],
    `globalThis.lamejs = { Mp3Encoder: function () {} };\n abrirFonteAudio = async () => { ${corpo} };`);

  it('o motivo real sobe até o usuário, em vez de virar palpite', async () => {
    const M2 = comFonte(`throw new Error('isobmff: sem trilha de áudio AAC');`);
    await expect(M2.otimizarArquivo(arquivo(M2.WHISPER_SAFE_BYTES + 1)))
      .rejects.toThrow(/sem trilha de áudio AAC/);
  });

  it('o genérico de quatro causas não é mais a resposta padrão', async () => {
    const M2 = comFonte(`throw new Error('decodeAudioData falhou: EncodingError');`);
    await expect(M2.otimizarArquivo(arquivo(M2.WHISPER_SAFE_BYTES + 1)))
      .rejects.toThrow(/EncodingError/);
  });

  it('estouro de tempo tem mensagem própria, não "formato incompatível"', async () => {
    // 45 s esperando é quase sempre tamanho, não formato. Dizer "formato
    // incompatível" aqui mandava a pessoa converter um arquivo que estava bom.
    const M2 = comFonte(`throw new Error('timeout');`);
    await expect(M2.otimizarArquivo(arquivo(M2.WHISPER_SAFE_BYTES + 1)))
      .rejects.toThrow(/passou de 45 segundos/i);
  });

  it('há um teto para o caminho que abre o arquivo inteiro na memória', () => {
    // Sem teto, o fallback tenta carregar centenas de megas e a aba morre sem
    // explicação — que é como o defeito relatado terminava.
    expect(typeof M.FALLBACK_MAX_BYTES).toBe('number');
    expect(M.FALLBACK_MAX_BYTES).toBeGreaterThan(M.WHISPER_SAFE_BYTES);
  });
});

describe('o leitor em partes diz ONDE desistiu', () => {
  /* "isobmff: sem trilha de áudio AAC" era a única saída de cinco pontos de
   * desistência diferentes, e não distinguia "o arquivo não tem áudio" de "tem
   * áudio, mas as tabelas estão nos fragmentos" ou "o áudio não é AAC". São
   * problemas com soluções diferentes.
   *
   * Medido: um M4A gravado pelo MediaRecorder do Chromium traz áudio OPUS
   * dentro de contêiner MP4 — a mensagem antiga chamava isso de "sem trilha de
   * áudio AAC" e escondia o fato. A nova diz `áudio em "Opus", que não é AAC`.
   *
   * Aqui rodam só as FRASES: montar um ISOBMFF de verdade em jsdom não cabe, e
   * o parser em si está coberto pela sonda de navegador. O que estes testes
   * impedem é a mensagem voltar a ser genérica. */
  const fonte = ler('src/media-transcode.js');

  it('a frase antiga, que servia para tudo, não existe mais', () => {
    expect(fonte).not.toContain("sem trilha de áudio AAC'");
  });

  it('cada ponto de desistência tem a sua frase', () => {
    for (const pedaco of ['trilha sem mdia', 'trilha sem hdlr', 'trilha de ${tipoTrilha}',
      'trilha de áudio sem stbl', 'MP4 fragmentado?', 'que não é AAC']) {
      expect(fonte, pedaco).toContain(pedaco);
    }
  });

  it('a mensagem final conta quantas trilhas achou e por que recusou cada uma', () => {
    expect(fonte).toMatch(/nenhuma trilha de áudio AAC utilizável em \$\{trilhas\}/);
    expect(fonte).toMatch(/recusas\.join/);
  });

  it('moov sem trilha nenhuma tem mensagem própria', () => {
    // "0 trilhas" e "1 trilha que não serve" são arquivos diferentes.
    expect(fonte).toContain('não tem nenhuma trilha (moov vazio)');
  });
});
