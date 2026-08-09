// CATEGORIA DO VÍDEO no AutoPost IA — o nicho, informado antes de gerar.
//
// O pedido: deixar o usuário dizer a categoria do vídeo antes de montar o
// pacote, e favoritar as que mais usa.
//
// O que a leitura do código mostrou e que dá o tamanho real do ganho: o prompt
// do gerador SEMPRE teve uma linha "Nicho/palavras-chave do canal", e
// montarBriefing() mandava `niche: ''` — a linha era omitida em toda geração.
// Hashtag e palavra-chave saíam deduzidas só do texto transcrito, que muitas
// vezes não diz a que público aquilo se destina. A categoria preenche esse
// campo que já existia, e com CONTEXTO de nicho junto, não só o rótulo.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lerAuto = (rel) => fs.readFileSync(path.join(raiz, 'autopost-ia', rel), 'utf8');

let C;
beforeAll(() => {
  // Mesmo truque do helpers/load.mjs: script clássico avaliado no escopo global.
  const nomes = ['CATEGORIAS_VIDEO', 'categoriaPorId', 'categoriasFavoritas', 'alternarFavorita',
    'categoriaEhFavorita', 'categoriasOrdenadas', 'categoriaUltima', 'salvarCategoriaUltima',
    'categoriaParaBriefing', 'categoriaLabel', 'CATEGORIA_FAVS_KEY'];
  (0, eval)(lerAuto('js/categorias.js') + `\n;globalThis.__CAT__ = { ${nomes.join(', ')} };`);
  C = globalThis.__CAT__;
});

beforeEach(() => localStorage.clear());

describe('o catálogo de categorias', () => {
  it('cobre um leque de nichos que dê conta do que se publica', () => {
    expect(C.CATEGORIAS_VIDEO.length).toBeGreaterThanOrEqual(15);
  });

  it('cada categoria tem id, rótulo, emoji e CONTEXTO de nicho', () => {
    // O contexto é o que muda hashtag e palavra-chave. Rótulo sozinho
    // ("Culinária") acrescenta pouco ao que a IA já deduz do texto.
    C.CATEGORIAS_VIDEO.forEach((c) => {
      expect(c.id, JSON.stringify(c)).toMatch(/^[a-z_]+$/);
      expect(c.label, c.id).toBeTruthy();
      expect(c.emoji, c.id).toBeTruthy();
      expect(c.ctx.length, `${c.id}: contexto raso demais`).toBeGreaterThan(60);
    });
  });

  it('o contexto fala de PÚBLICO e de BUSCA, não é enfeite', () => {
    const comBusca = C.CATEGORIAS_VIDEO.filter((c) => /busca|procur|público/i.test(c.ctx));
    expect(comBusca.length).toBe(C.CATEGORIAS_VIDEO.length);
  });

  it('nenhum id repetido — dois chips iguais quebrariam a seleção', () => {
    const ids = C.CATEGORIAS_VIDEO.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('"auto" não é uma categoria do catálogo — é a ausência de escolha', () => {
    expect(C.categoriaPorId('auto')).toBeNull();
    expect(C.categoriaPorId('')).toBeNull();
    expect(C.categoriaPorId(null)).toBeNull();
    expect(C.categoriaPorId('inexistente')).toBeNull();
  });
});

describe('favoritas', () => {
  it('alternar liga e desliga, e persiste', () => {
    expect(C.categoriasFavoritas()).toEqual([]);
    expect(C.alternarFavorita('games')).toBe(true);
    expect(C.categoriasFavoritas()).toEqual(['games']);
    expect(C.categoriaEhFavorita('games')).toBe(true);
    expect(C.alternarFavorita('games')).toBe(false);
    expect(C.categoriasFavoritas()).toEqual([]);
  });

  it('não favorita o que não existe', () => {
    expect(C.alternarFavorita('categoria_extinta')).toBe(false);
    expect(C.categoriasFavoritas()).toEqual([]);
  });

  it('favoritas vão para o TOPO da ordem de exibição', () => {
    C.alternarFavorita('culinaria');
    C.alternarFavorita('pets');
    const ord = C.categoriasOrdenadas();
    expect(ord.slice(0, 2).map((c) => c.id)).toEqual(['culinaria', 'pets']);
    expect(ord.slice(0, 2).every((c) => c.fav)).toBe(true);
  });

  it('a ordem mantém TODAS as categorias, sem sumir nem duplicar', () => {
    C.alternarFavorita('games');
    const ord = C.categoriasOrdenadas();
    expect(ord.length).toBe(C.CATEGORIAS_VIDEO.length);
    expect(new Set(ord.map((c) => c.id)).size).toBe(ord.length);
  });

  it('favorito órfão (categoria removida do catálogo) some sozinho', () => {
    localStorage.setItem(C.CATEGORIA_FAVS_KEY, JSON.stringify(['games', 'categoria_extinta']));
    expect(C.categoriasFavoritas()).toEqual(['games']);
    expect(C.categoriasOrdenadas().length).toBe(C.CATEGORIAS_VIDEO.length);
  });

  it('localStorage corrompido não derruba a tela', () => {
    localStorage.setItem(C.CATEGORIA_FAVS_KEY, 'isto não é json');
    expect(C.categoriasFavoritas()).toEqual([]);
    localStorage.setItem(C.CATEGORIA_FAVS_KEY, '{"nao":"array"}');
    expect(C.categoriasFavoritas()).toEqual([]);
  });
});

describe('a última categoria usada', () => {
  it('volta pré-selecionada na próxima geração', () => {
    C.salvarCategoriaUltima('viagem');
    expect(C.categoriaUltima()).toBe('viagem');
  });

  it('"auto" limpa a memória em vez de guardar lixo', () => {
    C.salvarCategoriaUltima('viagem');
    C.salvarCategoriaUltima('auto');
    expect(C.categoriaUltima()).toBe('auto');
  });

  it('categoria que saiu do catálogo não volta', () => {
    localStorage.setItem('autopost_categoria_ultima', 'categoria_extinta');
    expect(C.categoriaUltima()).toBe('auto');
  });
});

describe('o que a IA recebe', () => {
  it('o briefing leva rótulo E contexto — não só o nome', () => {
    const n = C.categoriaParaBriefing('culinaria');
    expect(n).toContain('Culinária');
    expect(n.length).toBeGreaterThan(70);
    expect(n).toMatch(/busca/i);
  });

  it('o checklist e o juiz levam o rótulo curto', () => {
    expect(C.categoriaLabel('games')).toBe('Games');
    expect(C.categoriaLabel('auto')).toBe('');
  });

  it('sem categoria, nada é injetado — o comportamento anterior fica intacto', () => {
    expect(C.categoriaParaBriefing('auto')).toBe('');
    expect(C.categoriaParaBriefing(null)).toBe('');
  });
});

describe('a ligação com o gerador', () => {
  const app = () => lerAuto('js/app.js');

  it('o campo `niche`, que ia SEMPRE vazio, passa a ser preenchido', () => {
    expect(app()).not.toMatch(/niche:\s*''/);
    expect(app()).toMatch(/niche:.*categoriaParaBriefing/);
  });

  it('a categoria entra no checklist e no contexto do juiz', () => {
    expect(app()).toMatch(/checklist\['Categoria do vídeo'\]/);
    expect(app()).toMatch(/prefs\.push\('Categoria do vídeo: '/);
  });

  it('é lida junto das outras opções e viaja no histórico', () => {
    // opcoes é salvo inteiro no item; sem isso, regenerar um card devolveria
    // hashtag fora do nicho no meio de um pacote coerente.
    expect(app()).toMatch(/categoria: _categoriaSel/);
    expect(app()).toMatch(/objetivo: 'auto', categoria: 'auto'/);
  });

  it('a estrela de favoritar é tratada ANTES do clique de seleção', () => {
    // A estrela vive DENTRO do chip: na ordem inversa, favoritar selecionaria
    // a categoria de tabela.
    const js = app();
    expect(js.indexOf('data-cat-fav')).toBeLessThan(js.indexOf("closest('[data-cat]')"));
    expect(js).toMatch(/stopPropagation/);
  });

  it('os chips respondem ao teclado — são focáveis', () => {
    const js = app();
    expect(js).toMatch(/tabindex="0"/);
    expect(js).toMatch(/addEventListener\('keydown'/);
  });
});

describe('a versão embutida na plataforma acompanha', () => {
  it('o módulo é carregado no standalone', () => {
    expect(lerAuto('index.html')).toContain('js/categorias.js');
  });

  it('e está assado dentro do autopost-ia.html', () => {
    // O embutido é o que roda dentro do app pai; se ficar para trás, o recurso
    // existe só no standalone.
    const assado = fs.readFileSync(path.join(raiz, 'autopost-ia.html'), 'utf8');
    expect(assado).toContain('CATEGORIAS_VIDEO');
    expect(assado).toContain('catGrid');
    expect(assado).not.toContain('src="js/categorias.js"');
  });

  it('a grade fica FORA do bloco recolhido de opções', () => {
    // Recolhida, ninguém escolheria — e o sinal de nicho é o que mais muda
    // hashtag e palavra-chave.
    const html = lerAuto('index.html');
    expect(html.indexOf('id="catGrid"')).toBeLessThan(html.indexOf('id="review-options"'));
  });
});
