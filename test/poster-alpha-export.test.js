// EXPORTAÇÃO COM FUNDO TRANSPARENTE (sticker / moldura para vídeo).
//
// O PNG alfa não é um "cartaz sem fundo": é um cartaz em que DUAS coisas viram
// buraco — o fundo e as fotos do usuário — e todo o resto continua pintado.
// Errar o corte para qualquer lado quebra o recurso de um jeito silencioso:
//   · corte de menos → o sticker sai com um retângulo opaco onde deveria
//     aparecer o vídeo (foi o caso do polaroid, cujo card branco ficava atrás
//     da foto, e das faixas de mídia sem foto);
//   · corte de mais → some a tarja, o painel de texto ou o degradê de leitura,
//     e o cartaz deixa de ser o que o usuário viu no preview.
//
// A verificação de pixel roda no navegador de verdade (html2canvas 1.4.1,
// palco de verdade), que o jsdom não reproduz: 60/60 modelos sem a foto-teste,
// 59/60 sem a cor de fundo — o restante é a placa de título do `comparison`,
// desenho e não fundo. Aqui ficam trancados os CONTRATOS que sustentam aquele
// resultado, porque são eles que um refactor derruba sem ninguém perceber.
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

describe('_applyAlphaMask separa fundo de desenho', () => {
  const fn = corpo(posters, '_applyAlphaMask');

  it('vaza o fundo da raiz', () => {
    expect(fn).toMatch(/limparFundo\(target\)/);
  });

  it('lê a assinatura do fundo ANTES de limpar a raiz', () => {
    // depois de limpar não há mais como reconhecer quem repete o fundo
    expect(fn.indexOf('const corFundo')).toBeLessThan(fn.indexOf('limparFundo(target)'));
    expect(fn).toMatch(/const imgFundo/);
  });

  it('vaza também as camadas que apenas REPETEM o fundo mais abaixo', () => {
    // meia dúzia de modelos monta a base num div interno; zerar só a raiz
    // deixava o sticker opaco assim mesmo
    expect(fn).toMatch(/cs\.backgroundColor === corFundo/);
    expect(fn).toMatch(/img === imgFundo/);
  });

  it('só faz isso com camadas GRANDES — chip e badge na cor do fundo ficam', () => {
    expect(fn).toMatch(/const grande =/);
    expect(fn).toMatch(/if \(!grande\) return;/);
  });

  it('preserva degradê de tela cheia (é tratamento de leitura, não fundo)', () => {
    // é ele que segura o contraste do texto quando o vídeo passa por baixo
    expect(fn).toMatch(/if \(!telaCheia \|\| temImg\) return;/);
  });

  it('esconde a mídia do usuário e limpa a célula que a abriga', () => {
    expect(fn).toMatch(/\[data-user-media\]/);
    expect(fn).toMatch(/esconder\(media\)/);
    // subida GEOMÉTRICA: só ancestral com praticamente a mesma caixa da foto
    expect(fn).toMatch(/mesmaCaixa/);
    expect(fn).toMatch(/if \(!mesmaCaixa\) break;/);
  });

  it('limpa a faixa de mídia sem escondê-la', () => {
    const i = fn.indexOf('[data-media-band]');
    expect(i).toBeGreaterThan(-1);
    const bloco = fn.slice(i, i + 600);
    expect(bloco).toMatch(/limparFundo\(band\)/);
    expect(bloco).not.toMatch(/esconder\(band\)/);
  });

  it('esconde avatar e camadas soltas de imagem', () => {
    expect(fn).toMatch(/\[data-pt="avatar-overlay"\], \[data-pt="layer"\]/);
  });
});

describe('a máscara é reversível — o preview volta ao que era', () => {
  const fn = corpo(posters, '_applyAlphaMask');
  const probe = corpo(posters, '_applyAlphaProbe');

  it('guarda o estado de cada elemento UMA vez só', () => {
    // um elemento cai em mais de uma regra (célula de foto que também forra a
    // faixa). Guardar de novo gravaria o inline JÁ zerado, e o desfazer —
    // que aplica os registros em ordem — deixaria o preview sem fundo.
    for (const f of [fn, probe]) {
      expect(f).toMatch(/const vistos = new Map\(\)/);
      expect(f).toMatch(/if \(vistos\.has\(el\)\) return;/);
    }
  });

  it('guarda display + background + backgroundColor + backgroundImage', () => {
    for (const f of [fn, probe]) {
      expect(f).toMatch(/display: el\.style\.display/);
      expect(f).toMatch(/background: el\.style\.background/);
      expect(f).toMatch(/backgroundColor: el\.style\.backgroundColor/);
      expect(f).toMatch(/backgroundImage: el\.style\.backgroundImage/);
    }
  });

  it('o desfazer reaplica todos os campos, sem condicional', () => {
    // `if (r.x !== undefined)` deixava passar o campo que a outra regra não
    // gravou — e o elemento ficava com o estado da exportação
    for (const nome of ['_undoAlphaMask', '_undoAlphaProbe']) {
      const u = corpo(posters, nome);
      expect(u).toMatch(/r\.el\.style\.display = r\.display;/);
      expect(u).toMatch(/r\.el\.style\.background = r\.background;/);
      expect(u).toMatch(/r\.el\.style\.backgroundImage = r\.backgroundImage;/);
      expect(u).not.toMatch(/!== undefined/);
    }
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

describe('2º passe: onde a foto de fato aparecia', () => {
  const cap = corpo(posters, 'captureStageCanvas');

  it('existe um marcador que nenhum tema usa', () => {
    expect(posters).toMatch(/const ALPHA_MARK = 'rgb\(255,0,255\)'/);
  });

  it('o passe do marcador roda com a máscara JÁ desfeita', () => {
    // senão o fundo vazado se confundiria com o buraco da foto
    expect(cap.indexOf('_undoAlphaMask(alphaRestores)')).toBeLessThan(cap.indexOf('_applyAlphaProbe(target)'));
    expect(cap).toMatch(/alphaRestores\.length = 0;/);   // não desfazer duas vezes no finally
  });

  it('o passe do marcador é desfeito mesmo se o html2canvas estourar', () => {
    const i = cap.indexOf('_applyAlphaProbe(target)');
    expect(cap.slice(i, i + 420)).toMatch(/finally \{\s*_undoAlphaProbe/);
  });

  it('só fura onde o magenta sobreviveu (texto por cima da foto continua)', () => {
    const punch = corpo(posters, '_punchAlphaHoles');
    expect(punch).toMatch(/P\[i\] > 246 && P\[i \+ 1\] < 9 && P\[i \+ 2\] > 246/);
    expect(punch).toMatch(/a\[i \+ 3\] = 0/);
  });

  it('não faz o 2º passe quando não há mídia nenhuma para vazar', () => {
    expect(cap).toMatch(/const temMidia =/);
    expect(cap).toMatch(/if \(!temMidia\) return canvas;/);
  });
});

describe('o modo sticker manda no arquivo entregue', () => {
  it('captureStageCanvas não pinta base branca no modo alfa', () => {
    expect(corpo(posters, 'captureStageCanvas')).toMatch(/backgroundColor: alpha \? null : '#FFFFFF'/);
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

  it('tem o grupo Fundo com Completo e Transparente', () => {
    expect(fn).toMatch(/data-seg="bg"/);
    expect(fn).toMatch(/data-v="solid"/);
    expect(fn).toMatch(/data-v="alpha"/);
  });

  it('desabilita o JPG e salta a seleção para PNG no modo transparente', () => {
    // escolher JPG + transparente devolveria o fundo em silêncio
    expect(fn).toMatch(/btnJpg\.disabled = alpha/);
    expect(fn).toMatch(/selFile = 'png'/);
  });

  it('explica o que o modo faz, em vez de deixar o rótulo sozinho', () => {
    expect(fn).toMatch(/exps-bg-note/);
    expect(fn).toMatch(/camada sobre vídeo/);
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
