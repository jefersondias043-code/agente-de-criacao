// EXPORTAÇÃO COM O ESPAÇO DAS FOTOS TRANSPARENTE (moldura para vídeo).
//
// O arquivo é o export NORMAL menos uma coisa: o campo onde entram as imagens
// do usuário vira buraco. O FUNDO DO CARTAZ NÃO SAI — nem a tarja, nem o painel
// de texto, nem o cabeçalho. Errar o corte para qualquer lado quebra o recurso
// de um jeito silencioso:
//   · corte de menos → a moldura sai com um retângulo opaco onde deveria
//     aparecer o vídeo (foi o caso do polaroid, cujo card branco ficava atrás
//     da foto, e das faixas de mídia sem foto);
//   · corte de mais → some o fundo e o cartaz deixa de ser o que o usuário viu
//     no preview. A primeira versão deste recurso vazava a raiz e as camadas
//     que a repetiam, e o cabeçalho ficava boiando sobre o vídeo.
//
// A verificação de pixel roda no navegador de verdade (html2canvas 1.4.1,
// palco de verdade), que o jsdom não reproduz. Aqui ficam trancados os
// CONTRATOS que sustentam aquele resultado, porque são eles que um refactor
// derruba sem ninguém perceber.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const posters = readFileSync(join(raiz, 'src/posters.js'), 'utf8');
const templates = readFileSync(join(raiz, 'src/poster-templates.js'), 'utf8');
const carousels = readFileSync(join(raiz, 'src/carousels.js'), 'utf8');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');

/** Corpo de uma função top-level, do `function nome` até a próxima em coluna 0. */
function corpo(fonte, nome) {
  const i = fonte.indexOf(`function ${nome}(`);
  if (i < 0) throw new Error(`função ${nome} não encontrada`);
  const resto = fonte.slice(i + 1);
  const j = resto.search(/\n(?:async )?function /);
  return resto.slice(0, j < 0 ? undefined : j);
}

describe('marcadores de mídia do usuário nos modelos', () => {
  // Os 60 modelos passam por três helpers para desenhar imagem. Marcar os
  // helpers cobre todos eles; marcar modelo a modelo não sobreviveria ao
  // próximo template novo.
  it('a camada de foto arrastável é marcada', () => {
    expect(corpo(templates, 'posterImageLayer')).toMatch(/data-user-media="photo"/);
  });

  it('o placeholder (vaga de foto vazia) é marcado', () => {
    expect(corpo(templates, 'posterPhotoPlaceholder')).toMatch(/data-user-media="placeholder"/);
  });

  it('o bloco de cor que o comparison usa no lugar da foto também é marcado', () => {
    // Único modelo que troca a foto ausente por cor sólida em vez do
    // placeholder: sem marcador, a metade sem foto saía opaca enquanto a
    // outra vazava.
    expect(corpo(templates, 'tplComparison')).toMatch(/data-user-media="fill"/);
  });

  it('a faixa de mídia é marcada à parte, porque não pode ser escondida', () => {
    // pílula de local e @portal moram dentro da faixa e são desenho
    expect(templates).toMatch(/data-media-band="1"/);
    expect(corpo(templates, 'posterPhotoMosaic')).toMatch(/data-media-band="1"/);
  });
});

describe('_applyAlphaFill mexe APENAS no campo das fotos', () => {
  const fn = corpo(posters, '_applyAlphaFill');

  it('pinta a mídia do usuário com a cor do passe e some com o que há dentro', () => {
    expect(fn).toMatch(/\[data-user-media\]/);
    expect(fn).toMatch(/pintar\(media\)/);
    expect(fn).toMatch(/esconderFilhos\(media\)/);
  });

  it('pinta a faixa reservada à imagem mas deixa os filhos visíveis', () => {
    // pílula de local e @portal moram dentro dela; é por continuarem pintados
    // que sobrevivem ao recorte
    const i = fn.indexOf("[data-media-band]");
    expect(i).toBeGreaterThan(-1);
    const bloco = fn.slice(i);
    expect(bloco).toMatch(/pintar\(band\)/);
    expect(bloco).not.toMatch(/esconderFilhos\(band\)/);
  });

  it('pinta avatar e camadas soltas de imagem', () => {
    expect(fn).toMatch(/\[data-pt="avatar-overlay"\], \[data-pt="layer"\]/);
  });

  it('NÃO toca no fundo da raiz — o cartaz sai com a base que tem', () => {
    // a raiz só aparece como ponto de partida de busca, nunca como alvo
    expect(fn).not.toMatch(/pintar\(target\)/);
    expect(fn).not.toMatch(/limparFundo/);
  });

  it('não varre a árvore procurando camada de fundo para vazar', () => {
    // a versão anterior vazava a raiz e tudo que repetisse a cor dela; o
    // resultado era um cartaz sem base, com o cabeçalho boiando sobre o vídeo.
    // (o `querySelectorAll('*')` que existe é escopado à faixa de mídia)
    expect(fn).not.toMatch(/target\.querySelectorAll\('\*'\)/);
    expect(fn).not.toMatch(/corFundo|imgFundo|telaCheia/);
  });

  it('some por visibility, não por display', () => {
    // display:none tira o elemento do fluxo e os vizinhos se reacomodam; os
    // dois passes precisam da MESMA geometria, senão o alfa sai fora do lugar
    expect(fn).toMatch(/f\.style\.visibility = 'hidden'/);
    expect(fn).not.toMatch(/style\.display = 'none'/);
  });
});

describe('a máscara é reversível — o preview volta ao que era', () => {
  const fn = corpo(posters, '_applyAlphaFill');

  it('guarda o estado de cada elemento UMA vez só', () => {
    // um elemento pode cair em mais de uma regra. Guardar de novo gravaria o
    // inline JÁ alterado, e o desfazer — que aplica os registros em ordem —
    // deixaria o preview com o estado da exportação.
    expect(fn).toMatch(/const vistos = new Map\(\)/);
    expect(fn).toMatch(/if \(vistos\.has\(el\)\) return;/);
  });

  it('guarda visibility + background + backgroundColor + backgroundImage', () => {
    expect(fn).toMatch(/visibility: el\.style\.visibility/);
    expect(fn).toMatch(/background: el\.style\.background/);
    expect(fn).toMatch(/backgroundColor: el\.style\.backgroundColor/);
    expect(fn).toMatch(/backgroundImage: el\.style\.backgroundImage/);
  });

  it('o desfazer reaplica todos os campos, sem condicional', () => {
    // `if (r.x !== undefined)` deixava passar o campo que a outra regra não
    // gravou — e o elemento ficava com o estado da exportação
    const u = corpo(posters, '_undoAlphaFill');
    expect(u).toMatch(/r\.el\.style\.visibility = r\.visibility;/);
    expect(u).toMatch(/r\.el\.style\.background = r\.background;/);
    expect(u).toMatch(/r\.el\.style\.backgroundImage = r\.backgroundImage;/);
    expect(u).not.toMatch(/!== undefined/);
  });

  it('o achatamento de imagem/logo restaura o display ORIGINAL, não ""', () => {
    // o wrapper de posterImageLayer é `display:flex` inline: restaurar com ''
    // o rebaixava a `block` e o preview ficava diferente do que era
    const cap = corpo(posters, 'captureStageCanvas');
    expect(cap).toMatch(/display: wrapEl\.style\.display/);
    expect(cap).toMatch(/display: logo\.style\.display/);
    expect(cap).toMatch(/s\.wrapEl\.style\.display = s\.display \|\| ''/);
  });
});

describe('o alfa vem da diferença entre dois passes', () => {
  const cap = corpo(posters, 'captureStageCanvas');

  it('as duas cores são os extremos do intervalo', () => {
    // é a distância entre elas que vira o alfa; qualquer outro par encolheria
    // a escala e o degradê sairia com translucidez errada
    expect(posters).toMatch(/const ALPHA_FILL_BLACK = '#000000'/);
    expect(posters).toMatch(/const ALPHA_FILL_WHITE = '#ffffff'/);
  });

  it('o 1º passe é preto e o 2º é branco, com o 1º desfeito antes', () => {
    expect(cap).toMatch(/_applyAlphaFill\(target, ALPHA_FILL_BLACK\)/);
    expect(cap.indexOf('_undoAlphaFill(alphaRestores)'))
      .toBeLessThan(cap.indexOf('_applyAlphaFill(target, ALPHA_FILL_WHITE)'));
  });

  it('o 2º passe é desfeito mesmo se o html2canvas estourar', () => {
    const i = cap.indexOf('_applyAlphaFill(target, ALPHA_FILL_WHITE)');
    expect(cap.slice(i, i + 420)).toMatch(/finally \{\s*_undoAlphaFill/);
    expect(cap).toMatch(/alphaRestores = \[\];/);   // não desfazer duas vezes no finally
  });

  it('desenho opaco fica intocado, e só ele', () => {
    const c = corpo(posters, '_composeAlphaFromPasses');
    // diferença ~0 entre os passes = nada ali depende da foto
    expect(c).toMatch(/if \(d <= 2\) continue;/);
    expect(c).toMatch(/const a = 255 - Math\.round\(d\)/);
  });

  it('recupera a cor real do que é semitransparente', () => {
    // o passe preto entrega a cor JÁ multiplicada pelo alfa; sem dividir, o
    // degradê de leitura sairia escuro demais sobre o vídeo
    const c = corpo(posters, '_composeAlphaFromPasses');
    expect(c).toMatch(/const k = 255 \/ a;/);
    expect(c).toMatch(/Math\.min\(255, Math\.round\(p\[i\] \* k\)\)/);
    expect(c).toMatch(/p\[i \+ 3\] = a;/);
  });

  it('recusa canvases de tamanhos diferentes em vez de embaralhar o pixel', () => {
    const c = corpo(posters, '_composeAlphaFromPasses');
    expect(c).toMatch(/cvPreto\.width !== cvBranco\.width/);
    expect(c).toMatch(/return cvPreto;/);
  });

  it('não faz o 2º passe quando não há mídia nenhuma para vazar', () => {
    // sem mídia o arquivo é idêntico ao export normal, que é o correto
    expect(cap).toMatch(/const temMidia =/);
    expect(cap).toMatch(/if \(!temMidia\) return canvas;/);
    expect(cap).toMatch(/temMidia = target\.querySelector\('\[data-user-media\], \[data-media-band\]/);
  });

  it('os dois passes usam as MESMAS opções (têm de coincidir pixel a pixel)', () => {
    expect(cap).toMatch(/branco = await html2canvas\(target, opcoes\)/);
  });
});

describe('o modo moldura manda no arquivo entregue', () => {
  it('captureStageCanvas continua pintando base branca — o fundo do cartaz fica', () => {
    // `backgroundColor: null` vazava tudo que o html2canvas não pintasse,
    // inclusive o fundo do modelo. A transparência vem só do recorte.
    const cap = corpo(posters, 'captureStageCanvas');
    expect(cap).toMatch(/backgroundColor: '#FFFFFF',/);
    expect(cap).not.toMatch(/backgroundColor: alpha \? null/);
  });

  it('não achata as fotos no modo alfa (reinseriria o pixel que acabou de sair)', () => {
    expect(corpo(posters, 'captureStageCanvas')).toMatch(/const imgs = alpha \? \[\] : \[/);
  });

  it('exportPoster força PNG — JPG não tem canal alfa', () => {
    const fn = corpo(posters, 'exportPoster');
    expect(fn).toMatch(/const jpg = !alpha && \(/);
    expect(fn).toMatch(/-transparente/);
  });

  it('exportCarousel força PNG e nomeia os slides como transparentes', () => {
    const fn = corpo(carousels, 'exportCarousel');
    expect(fn).toMatch(/const jpg = !alpha && \(/);
    expect(fn).toMatch(/alpha \? '-transparente' : ''/);
    // e repassa a opção adiante quando o "carrossel" é um cartaz só
    expect(fn).toMatch(/return exportPoster\(p, scale, fileType, opts\)/);
  });
});

describe('a escolha aparece no diálogo de exportação', () => {
  const fn = corpo(posters, 'openPosterExportSettings');

  it('o grupo fala do ESPAÇO DAS FOTOS, não do fundo do cartaz', () => {
    expect(fn).toMatch(/data-seg="bg"/);
    expect(fn).toMatch(/data-v="solid"/);
    expect(fn).toMatch(/data-v="alpha"/);
    expect(fn).toMatch(/Espaço das fotos/);
    // rotular de "Fundo" prometia o que o recurso não faz
    expect(fn).not.toMatch(/exps-label">Fundo</);
  });

  it('desabilita o JPG e salta a seleção para PNG no modo transparente', () => {
    // escolher JPG + transparente devolveria o fundo em silêncio
    expect(fn).toMatch(/btnJpg\.disabled = alpha/);
    expect(fn).toMatch(/selFile = 'png'/);
  });

  it('explica o que o modo faz, em vez de deixar o rótulo sozinho', () => {
    expect(fn).toMatch(/exps-bg-note/);
    expect(fn).toMatch(/O modelo continua igual/);
  });

  it('a opção chega ao exportador', () => {
    expect(fn).toMatch(/const opts = \{ alpha: selBg === 'alpha' \}/);
    expect(fn).toMatch(/exportCarousel\(p, selMode, selScale, selFile, opts\)/);
    expect(fn).toMatch(/exportPoster\(p, selScale, selFile, opts\)/);
  });

  it('o botão desabilitado não responde ao clique', () => {
    expect(fn).toMatch(/if \(btn\.disabled\) return;/);
  });

  it('o CSS do segmento desabilitado existe (senão parece clicável)', () => {
    const css = readFileSync(join(raiz, 'styles.css'), 'utf8');
    expect(css).toMatch(/\.exps-seg button:disabled/);
  });

  it('o diálogo é montado por JS — o index.html não duplica esse markup', () => {
    expect(html).not.toMatch(/data-seg="bg"/);
  });
});
