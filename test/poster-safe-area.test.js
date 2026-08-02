// ÁREA SEGURA DAS REDES — a família de modelos que compõe fora das faixas
// cobertas pela interface do aplicativo.
//
// O problema real: publicado em Reels, Stories ou TikTok, o cartaz não é visto
// inteiro. O app desenha por cima a barra de topo, a legenda, o perfil, o áudio
// e a coluna de botões da direita. Título posto ali some na publicação.
//
// A promessa desta família é estreita e verificável: TODO o texto vive dentro
// do retângulo seguro da plataforma escolhida; só o fundo sangra o cartaz
// inteiro. É exatamente isso que estes testes conferem — mais a garantia de que
// nenhum modelo antigo foi tocado.
import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadModules, clearStorage } from './helpers/load.mjs';

let P;
const portal = {
  name: 'Portal Exemplo', acronym: 'PE', handle: '@portalexemplo',
  tagline: 'Notícias que conectam.', location: 'Salvador, BA', theme: 'municipios-bahia',
};

function makePoster(template, format, safeZone) {
  return {
    id: 'test-' + template, template, format, safeZone,
    headline: 'Prefeitura entrega novas obras na capital baiana',
    category: 'CIDADES', location: 'Salvador, BA',
    subtitle: 'Investimento beneficia milhares de famílias na região metropolitana',
    description: 'Primeiro item da lista.\nSegundo item.\nTerceiro item.\nQuarto item.',
    figure: '47%', labelA: 'Antes', labelB: 'Depois',
    personName: 'Maria Silva', personRole: 'Prefeita',
    image1: null, image2: null, image3: null, image4: null, avatar: null,
    portalSnapshot: portal,
  };
}

beforeAll(() => {
  clearStorage();
  P = loadModules(['catalogs.js', 'core.js', 'posters.js', 'poster-templates.js'], [
    'POSTER_TEMPLATES', 'POSTER_CATEGORIES', 'POSTER_FORMATS', 'POSTER_SAFE_ZONES',
    'POSTER_SAFE_DEFAULT', 'ptSafeZone', 'ptSafeRect', 'ptSafeBoxCss', 'ptSafeAtiva',
    'posterEhModeloDeRede', 'applyTheme',
  ]);
  P.applyTheme('municipios-bahia');
});

const idsRedes = () => Object.entries(P.POSTER_TEMPLATES)
  .filter(([, t]) => t.cat === 'redes').map(([id]) => id);

describe('catálogo de zonas', () => {
  it('cobre as plataformas que o usuário citou, mais o feed', () => {
    ['livre', 'universal', 'reels', 'stories', 'tiktok', 'feed']
      .forEach((id) => expect(P.POSTER_SAFE_ZONES[id], id).toBeTruthy());
    expect(P.POSTER_SAFE_DEFAULT).toBe('universal');
    expect(P.POSTER_SAFE_ZONES.livre.livre).toBe(true);
  });

  it('toda zona traz rótulo, dica e as quatro margens', () => {
    Object.entries(P.POSTER_SAFE_ZONES).forEach(([id, z]) => {
      expect(z.label, id).toBeTruthy();
      expect(z.hint, id).toBeTruthy();
      ['top', 'bottom', 'left', 'right'].forEach((k) => {
        expect(typeof z[k], `${id}.${k}`).toBe('number');
        expect(z[k], `${id}.${k}`).toBeGreaterThanOrEqual(0);
        expect(z[k], `${id}.${k}`).toBeLessThan(40);
      });
      // Sobra área útil de verdade em qualquer zona.
      expect(100 - z.top - z.bottom, id).toBeGreaterThan(35);
      expect(100 - z.left - z.right, id).toBeGreaterThan(50);
    });
  });

  it('"universal" é o pior caso de cada borda — é isso que a torna segura em todas', () => {
    const u = P.POSTER_SAFE_ZONES.universal;
    ['reels', 'stories', 'tiktok'].forEach((id) => {
      const z = P.POSTER_SAFE_ZONES[id];
      ['top', 'bottom', 'left', 'right'].forEach((k) => {
        expect(u[k], `${id}.${k} não cabe em universal`).toBeGreaterThanOrEqual(z[k]);
      });
    });
  });

  it('as faixas refletem a interface real: base maior que topo nos vídeos', () => {
    // Legenda + perfil + áudio + navegação ocupam muito mais que o cabeçalho.
    ['reels', 'tiktok'].forEach((id) => {
      const z = P.POSTER_SAFE_ZONES[id];
      expect(z.bottom, id).toBeGreaterThan(z.top);
      expect(z.right, `${id} precisa reservar a coluna de botões`).toBeGreaterThan(10);
    });
    // Stories não tem coluna de ações — reservar seria desperdiçar largura.
    expect(P.POSTER_SAFE_ZONES.stories.right).toBeLessThan(10);
  });
});

describe('o retângulo seguro em pixels', () => {
  const fmt = { w: 1080, h: 1920 };

  it('converte percentual em pixel do formato', () => {
    const r = P.ptSafeRect({ safeZone: 'reels' }, fmt);
    expect(r.top).toBe(Math.round(1920 * 13 / 100));
    expect(r.bottom).toBe(Math.round(1920 * 22 / 100));
    expect(r.left).toBe(Math.round(1080 * 5 / 100));
    expect(r.right).toBe(Math.round(1080 * 16 / 100));
    expect(r.w).toBe(1080 - r.left - r.right);
    expect(r.h).toBe(1920 - r.top - r.bottom);
  });

  it('acompanha o formato — a mesma zona vale em 9:16, 4:5 e 1:1', () => {
    Object.values(P.POSTER_FORMATS).forEach((f) => {
      const r = P.ptSafeRect({ safeZone: 'universal' }, f);
      expect(r.w, `${f.w}x${f.h}`).toBeGreaterThan(0);
      expect(r.h, `${f.w}x${f.h}`).toBeGreaterThan(0);
      expect(r.left + r.w + r.right).toBe(f.w);
      expect(r.top + r.h + r.bottom).toBe(f.h);
    });
  });

  it('o padrão depende do modelo: redes nasce na área segura, o resto nasce livre', () => {
    // Contrato deliberado (r189): a adaptação passou a valer para a biblioteca
    // inteira, então o padrão fora da família precisa ser NÃO MEXER — cartaz
    // salvo antes desta versão não pode mudar de aparência sozinho.
    const rede = P.ptSafeRect({ template: 'redes-manchete' }, fmt);
    expect(rede).toEqual(P.ptSafeRect({ safeZone: 'universal', template: 'redes-manchete' }, fmt));
    expect(P.ptSafeZone({ template: 'manchete' }).livre).toBe(true);
    expect(P.ptSafeZone(null).livre).toBe(true);
    expect(P.ptSafeZone({}).livre).toBe(true);
  });

  it('zona inválida não quebra', () => {
    const r = P.ptSafeRect({ safeZone: 'inexistente', template: 'manchete' }, fmt);
    expect(r.top).toBe(0);
    expect(P.ptSafeRect({ safeZone: 'inexistente', template: 'redes-manchete' }, fmt))
      .toEqual(P.ptSafeRect({ safeZone: 'universal', template: 'redes-manchete' }, fmt));
  });

  it('"livre" não vale para a família de redes — nela a área segura É a composição', () => {
    expect(P.ptSafeZone({ safeZone: 'livre', template: 'redes-cartao' }).livre).toBeFalsy();
    expect(P.ptSafeAtiva({ safeZone: 'livre', template: 'redes-cartao' })).toBe(true);
    expect(P.ptSafeAtiva({ safeZone: 'livre', template: 'manchete' })).toBe(false);
    expect(P.ptSafeAtiva({ safeZone: 'reels', template: 'manchete' })).toBe(true);
    expect(P.ptSafeAtiva({ template: 'manchete' })).toBe(false);
  });
});

describe('os modelos compõem DENTRO da área segura', () => {
  it('a família existe e está numa aba própria do seletor', () => {
    expect(idsRedes().length).toBeGreaterThanOrEqual(6);
    expect(P.POSTER_CATEGORIES.some((c) => c.id === 'redes')).toBe(true);
    idsRedes().forEach((id) => expect(P.posterEhModeloDeRede(id), id).toBe(true));
    expect(P.posterEhModeloDeRede('manchete')).toBe(false);
    expect(P.posterEhModeloDeRede('inexistente')).toBe(false);
  });

  // O coração da funcionalidade: todo texto tem de estar dentro do retângulo.
  for (const zona of ['universal', 'reels', 'stories', 'tiktok']) {
    it(`${zona}: nenhum texto escapa do retângulo seguro`, () => {
      const fmt = P.POSTER_FORMATS['9:16'];
      for (const id of idsRedes()) {
        const p = makePoster(id, '9:16', zona);
        const html = P.POSTER_TEMPLATES[id].render(p, fmt, portal);
        const doc = new JSDOM(`<body>${html}</body>`).window.document;
        const raiz = doc.querySelector('.poster-1440');
        expect(raiz, id).toBeTruthy();

        const r = P.ptSafeRect(p, fmt);
        const seguro = Array.from(raiz.children).find((el) => {
          const st = el.getAttribute('style') || '';
          return st.includes(`left:${r.left}px`) && st.includes(`right:${r.right}px`)
            && st.includes(`top:${r.top}px`) && st.includes(`bottom:${r.bottom}px`);
        });
        expect(seguro, `${id}/${zona}: falta o contêiner encaixado na área segura`).toBeTruthy();

        // Todo o resto do cartaz é FUNDO: pode sangrar, mas não pode ter texto.
        Array.from(raiz.children).forEach((el) => {
          if (el === seguro) return;
          const txt = (el.textContent || '').replace(/\s+/g, '');
          expect(txt, `${id}/${zona}: há texto fora da área segura`).toBe('');
        });

        // E o texto está mesmo lá dentro (não é um contêiner vazio).
        expect((seguro.textContent || '').trim().length, `${id}/${zona}`).toBeGreaterThan(0);
      }
    });
  }

  it('o título aparece dentro da área segura, não só um contêiner vazio', () => {
    const fmt = P.POSTER_FORMATS['9:16'];
    idsRedes().forEach((id) => {
      const p = makePoster(id, '9:16', 'universal');
      const html = P.POSTER_TEMPLATES[id].render(p, fmt, portal);
      const doc = new JSDOM(`<body>${html}</body>`).window.document;
      const r = P.ptSafeRect(p, fmt);
      const seguro = Array.from(doc.querySelector('.poster-1440').children).find((el) =>
        (el.getAttribute('style') || '').includes(`top:${r.top}px`));
      // Citação e número têm texto próprio; os demais levam a headline.
      const dentro = seguro.textContent;
      expect(dentro.length, id).toBeGreaterThan(10);
    });
  });

  it('trocar de plataforma reposiciona o conteúdo — não é enfeite', () => {
    const fmt = P.POSTER_FORMATS['9:16'];
    const id = idsRedes()[0];
    const a = P.POSTER_TEMPLATES[id].render(makePoster(id, '9:16', 'reels'), fmt, portal);
    const b = P.POSTER_TEMPLATES[id].render(makePoster(id, '9:16', 'tiktok'), fmt, portal);
    expect(a).not.toBe(b);
    const rr = P.ptSafeRect({ safeZone: 'reels' }, fmt);
    const rt = P.ptSafeRect({ safeZone: 'tiktok' }, fmt);
    expect(a).toContain(`top:${rr.top}px`);
    expect(b).toContain(`top:${rt.top}px`);
  });

  it('renderiza em todos os formatos, com e sem campos preenchidos', () => {
    Object.entries(P.POSTER_FORMATS).forEach(([fid, fmt]) => {
      idsRedes().forEach((id) => {
        const cheio = P.POSTER_TEMPLATES[id].render(makePoster(id, fid, 'universal'), fmt, portal);
        expect(cheio, `${id}/${fid}`).toContain('poster-1440');
        const vazio = P.POSTER_TEMPLATES[id].render(
          { id: 'v', template: id, format: fid, portalSnapshot: portal }, fmt, portal);
        expect(vazio, `${id}/${fid} vazio`).toContain('poster-1440');
      });
    });
  });
});

describe('os modelos antigos não foram tocados', () => {
  it('nenhum modelo fora da família usa área segura', () => {
    const fmt = P.POSTER_FORMATS['9:16'];
    const antigos = Object.entries(P.POSTER_TEMPLATES).filter(([, t]) => t.cat !== 'redes');
    expect(antigos.length).toBeGreaterThan(30);
    const r = P.ptSafeRect({ safeZone: 'universal' }, fmt);
    antigos.forEach(([id, t]) => {
      const html = t.render(makePoster(id, '9:16'), fmt, portal);
      expect(html, `${id} passou a usar o encaixe da área segura`)
        .not.toContain(`left:${r.left}px;right:${r.right}px;top:${r.top}px`);
    });
  });

  it('as categorias antigas continuam todas lá', () => {
    ['todos', 'noticia', 'foto', 'citacao', 'dados', 'conteudo', 'promo', 'evento',
      'institucional', 'social'].forEach((c) => {
      expect(P.POSTER_CATEGORIES.some((x) => x.id === c), c).toBe(true);
    });
  });

  it('o campo safeZone é opcional — cartaz antigo abre sem ele', () => {
    const fmt = P.POSTER_FORMATS['9:16'];
    idsRedes().forEach((id) => {
      const antigo = makePoster(id, '9:16');      // sem safeZone
      delete antigo.safeZone;
      const html = P.POSTER_TEMPLATES[id].render(antigo, fmt, portal);
      const r = P.ptSafeRect({ template: id }, fmt);   // família → universal
      expect(html, id).toContain(`top:${r.top}px`);
    });
  });

  it('modelo antigo sem zona não recebe adaptação nenhuma', () => {
    // O retângulo de um modelo comum sem escolha é o cartaz inteiro: a
    // adaptação central checa ptSafeAtiva() e devolve sem tocar em nada.
    const fmt = P.POSTER_FORMATS['9:16'];
    const r = P.ptSafeRect({ template: 'manchete' }, fmt);
    expect([r.top, r.bottom, r.left, r.right]).toEqual([0, 0, 0, 0]);
    expect(r.w).toBe(fmt.w);
    expect(r.h).toBe(fmt.h);
  });
});
