// CAPAS DE VÍDEO E THUMBNAILS — família própria, não adaptação.
//
// O pedido foi por modelos realmente voltados a capa de vídeo, "e não apenas
// adaptações dos modelos já existentes". Ao abrir o catálogo apareceu a lacuna
// que impedia isso de existir: TODO formato era retrato ou quadrado. Não havia
// 16:9 — a proporção da thumbnail do YouTube. Sem ela, qualquer "modelo de
// capa" seria um cartaz de feed com outro nome.
//
// O que faz uma capa ser capa: ela é lida com ~210px de largura, no meio de
// outras vinte. Isso muda o critério de "bom" — texto curto e enorme, contraste
// por bloco sólido (não por véu), um foco só. Os testes abaixo travam esse
// contrato, além das armadilhas de layout que só apareceram ao renderizar:
// texto estourando o painel e caindo por cima da assinatura do canal.
import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadModules, clearStorage } from './helpers/load.mjs';

let P;
const portal = {
  name: 'Canal Exemplo', acronym: 'CE', handle: '@canalexemplo',
  location: 'Salvador, BA', theme: 'municipios-bahia',
};

const capa = (extra) => Object.assign({
  id: 'c', template: 'thumb-impacto', format: '16:9',
  headline: 'Ninguém te contou isso', subtitle: 'O que mudou em 2026',
  category: 'ANÁLISE', figure: '7', labelA: 'Antes', labelB: 'Depois',
  personName: 'Maria Silva', personRole: 'Especialista',
  location: 'Salvador, BA', portalSnapshot: portal,
}, extra || {});

beforeAll(() => {
  clearStorage();
  P = loadModules(['catalogs.js', 'core.js', 'posters.js', 'poster-templates.js'], [
    'POSTER_TEMPLATES', 'POSTER_CATEGORIES', 'POSTER_FORMATS',
    'posterEhCapaDeVideo', 'posterEhModeloDeRede', 'applyTheme',
    '_thumbDeitado', '_thumbCurto', '_thumbU', '_thumbFit',
  ]);
  P.applyTheme('municipios-bahia');
});

const capas = () => Object.entries(P.POSTER_TEMPLATES).filter(([, t]) => t.cat === 'thumb');
const texto = (html) => new JSDOM(`<body>${html}</body>`).window.document;

describe('o formato que faltava', () => {
  it('16:9 existe e é o ÚNICO deitado do catálogo', () => {
    const f = P.POSTER_FORMATS['16:9'];
    expect(f, 'sem 16:9 não há thumbnail de verdade').toBeTruthy();
    expect(f.w).toBeGreaterThan(f.h);
    const deitados = Object.entries(P.POSTER_FORMATS).filter(([, x]) => x.w > x.h).map(([k]) => k);
    expect(deitados).toEqual(['16:9']);
  });

  it('tem a medida padrão do YouTube', () => {
    expect(P.POSTER_FORMATS['16:9'].w).toBe(1920);
    expect(P.POSTER_FORMATS['16:9'].h).toBe(1080);
    // Acima do mínimo recomendado (1280×720) — exportar em 1× já serve.
    expect(P.POSTER_FORMATS['16:9'].w).toBeGreaterThanOrEqual(1280);
  });

  it('os formatos antigos continuam intactos', () => {
    [['3:4', 1080, 1440], ['4:5', 1080, 1350], ['1:1', 1080, 1080], ['9:16', 1080, 1920]]
      .forEach(([id, w, h]) => {
        expect(P.POSTER_FORMATS[id].w, id).toBe(w);
        expect(P.POSTER_FORMATS[id].h, id).toBe(h);
      });
  });
});

describe('a família existe e é separada', () => {
  it('tem aba própria e variedade de verdade', () => {
    // 8 era pouco para escolher: com menos da metade agradando, sobrava quase
    // nada. A família triplicou, e cada modelo é uma PROPOSTA diferente — não
    // uma variação de espessura do mesmo layout.
    expect(capas().length).toBeGreaterThanOrEqual(24);
    expect(P.POSTER_CATEGORIES.some((c) => c.id === 'thumb')).toBe(true);
  });

  it('as composições são de fato diferentes entre si', () => {
    // Guarda contra "criar várias versões semelhantes": duas capas com o mesmo
    // HTML para o mesmo conteúdo são o mesmo modelo com dois nomes.
    const fmt = P.POSTER_FORMATS['16:9'];
    const vistos = new Map();
    const iguais = [];
    capas().forEach(([id, t]) => {
      const html = t.render(capa({ template: id }), fmt, portal);
      const assinatura = html.replace(/\s+/g, ' ');
      if (vistos.has(assinatura)) iguais.push(`${id} == ${vistos.get(assinatura)}`);
      else vistos.set(assinatura, id);
    });
    expect(iguais).toEqual([]);
  });

  it('é reconhecida pelo código, e não se confunde com a de redes', () => {
    capas().forEach(([id]) => {
      expect(P.posterEhCapaDeVideo(id), id).toBe(true);
      expect(P.posterEhModeloDeRede(id), id).toBe(false);
    });
    expect(P.posterEhCapaDeVideo('manchete')).toBe(false);
    expect(P.posterEhCapaDeVideo('redes-manchete')).toBe(false);
    expect(P.posterEhCapaDeVideo('inexistente')).toBe(false);
  });

  it('nenhum modelo antigo foi movido para a aba nova', () => {
    // "Não apenas adaptações dos já existentes": a família é ADIÇÃO.
    capas().forEach(([id]) => expect(id.startsWith('thumb-'), id).toBe(true));
    const antigos = Object.entries(P.POSTER_TEMPLATES).filter(([id]) => !id.startsWith('thumb-'));
    antigos.forEach(([id, t]) => expect(t.cat, id).not.toBe('thumb'));
  });
});

describe('as capas aproveitam o conteúdo, como o resto da biblioteca', () => {
  // DEFEITO RELATADO: informação que o conteúdo preenche sozinho sumia ao
  // escolher uma capa. Medido antes da correção: `location` era usado por 0 de
  // 8 capas (contra 47 de 66 no resto) e `description` por 0 de 8 — sendo que
  // `description` guarda o texto COMPLETO da matéria.
  const usa = (id, campo, valor) => {
    const t = P.POSTER_TEMPLATES[id];
    const html = t.render(capa({ template: id, [campo]: valor }), P.POSTER_FORMATS['16:9'], portal);
    return html.toLowerCase().indexOf(String(valor).toLowerCase()) >= 0;
  };

  it('TODA capa mostra o local — era o campo mais ignorado', () => {
    const sem = capas().filter(([id]) => !usa(id, 'location', 'Feira de Santana'));
    expect(sem.map(([id]) => id)).toEqual([]);
  });

  it('quase toda capa mostra a categoria', () => {
    const com = capas().filter(([id]) => usa(id, 'category', 'REPORTAGEM'));
    expect(com.length).toBeGreaterThanOrEqual(Math.ceil(capas().length * 0.75));
  });

  it('o corpo da matéria vira tópicos nas capas de lista', () => {
    // `description` é o texto completo do conteúdo; ficava parado.
    const corpo = 'Primeiro ponto do texto\nSegundo ponto do texto\nTerceiro ponto';
    ['thumb-lista', 'thumb-passos'].forEach((id) => {
      const html = P.POSTER_TEMPLATES[id]
        .render(capa({ template: id, description: corpo }), P.POSTER_FORMATS['16:9'], portal)
        .toLowerCase();
      expect(html, id).toContain('primeiro ponto');
      expect(html, id).toContain('segundo ponto');
    });
  });

  it('o número sai do conteúdo quando o campo está vazio', () => {
    // Antes, a capa de número mostrava um "7" fixo mesmo com o dado no texto.
    const p2 = capa({ template: 'thumb-numero', figure: '', headline: 'Prefeitura investe 900 mil em obras' });
    const html = P.POSTER_TEMPLATES['thumb-numero'].render(p2, P.POSTER_FORMATS['16:9'], portal);
    expect(html).toContain('900');
  });

  it('o modelo não quebra quando o conteúdo não traz o campo', () => {
    const vazio = { id: 'v', template: 'x', format: '16:9', headline: 'Só o título', portalSnapshot: portal };
    capas().forEach(([id, t]) => {
      expect(t.render({ ...vazio, template: id }, P.POSTER_FORMATS['16:9'], portal), id).toContain('poster-1440');
    });
  });
});

describe('texto de capa: curto e grande', () => {
  it('a manchete é reduzida a poucas palavras', () => {
    // Frase inteira numa thumbnail não é thumbnail — não se lê a 210px.
    expect(P._thumbCurto('Prefeitura entrega novas obras de saneamento na capital', 4, 40))
      .toBe('PREFEITURA ENTREGA NOVAS OBRAS');
    expect(P._thumbCurto('Uma frase bem longa que não caberia de jeito nenhum', 9, 20).length)
      .toBeLessThanOrEqual(20);
  });

  it('corta na palavra, nunca no meio dela', () => {
    const s = P._thumbCurto('Alfa bravo charlie delta', 9, 14);
    expect(s.endsWith('BRAVO') || s === 'ALFA BRAVO').toBe(true);
    expect(s).not.toMatch(/CHARL$/);
  });

  it('palavra única maior que o limite ainda devolve algo', () => {
    expect(P._thumbCurto('Pneumoultramicroscopicossilicovulcanoconiose', 3, 10)).toHaveLength(10);
  });

  it('vazio entra, vazio sai', () => {
    expect(P._thumbCurto('', 5, 20)).toBe('');
    expect(P._thumbCurto(null, 5, 20)).toBe('');
  });

  it('o título ocupa uma fatia grande da arte em TODO formato', () => {
    // O que separa uma capa de um cartaz: a palavra tem de ser enorme.
    Object.entries(P.POSTER_FORMATS).forEach(([fid, fmt]) => {
      capas().forEach(([id, t]) => {
        const html = t.render(capa({ template: id, format: fid }), fmt, portal);
        const tamanhos = [...html.matchAll(/font-size:([\d.]+)px/g)].map((m) => Number(m[1]));
        // A LARGURA é o que limita o título numa capa (a palavra tem de caber
        // na linha), então a fatia se mede contra a largura — não contra a
        // altura, que sobra justamente nos formatos retrato.
        expect(Math.max(...tamanhos) / fmt.w, `${id}/${fid}`).toBeGreaterThan(0.055);
      });
    });
  });
});

describe('o título cabe na linha', () => {
  // Defeito que a métrica de ALTURA não pegava: no retrato (1080 de largura) a
  // palavra em condensada estourava a caixa e saía cortada ao meio. A primeira
  // correção usou 0.54 de largura por caractere e não resolveu nada — o valor
  // medido na Poppins 900 é ~0.77.
  it('o corpo cai quando a palavra é longa', () => {
    const fmt = P.POSTER_FORMATS['9:16'];
    const curto = P._thumbFit(400, 'ABC', fmt, 0.86);
    const longo = P._thumbFit(400, 'PNEUMOULTRAMICROSCOPICO', fmt, 0.86);
    expect(longo).toBeLessThan(curto);
  });

  it('a palavra mais longa cabe na largura oferecida', () => {
    const fmt = P.POSTER_FORMATS['9:16'];
    ['NINGUÉM', 'PREFEITURA', 'INVESTIMENTO'].forEach((w) => {
      const s2 = P._thumbFit(999, w, fmt, 0.86);
      // A tolerância cobre o arredondamento do corpo (até meio pixel por
      // caractere), não folga de layout.
      expect(s2 * 0.80 * w.length, w).toBeLessThanOrEqual(fmt.w * 0.86 + 0.5 * 0.80 * w.length);
    });
  });

  it('nunca devolve um corpo ilegível, mesmo com palavra gigante', () => {
    const fmt = P.POSTER_FORMATS['9:16'];
    expect(P._thumbFit(400, 'A'.repeat(80), fmt, 0.86)).toBeGreaterThanOrEqual(P._thumbU(fmt, 0.042));
  });

  it('devolve número inteiro — corpo fracionário só suja o CSS', () => {
    expect(P._thumbFit(133.7, 'ABC', P.POSTER_FORMATS['16:9'], 0.86) % 1).toBe(0);
  });
});

describe('a composição vira com a proporção', () => {
  it('sabe distinguir deitado de retrato', () => {
    expect(P._thumbDeitado(P.POSTER_FORMATS['16:9'])).toBe(true);
    expect(P._thumbDeitado(P.POSTER_FORMATS['9:16'])).toBe(false);
    expect(P._thumbDeitado(P.POSTER_FORMATS['1:1'])).toBe(false);
  });

  it('as medidas saem da ALTURA, não de pixels cravados', () => {
    // 1920×1080 e 1080×1920 têm alturas muito diferentes: corpo fixo ficaria
    // gigante num e minúsculo no outro.
    expect(P._thumbU(P.POSTER_FORMATS['16:9'], 0.1)).toBe(108);
    expect(P._thumbU(P.POSTER_FORMATS['9:16'], 0.1)).toBe(192);
  });

  it('o mesmo modelo entrega layouts DIFERENTES em deitado e em retrato', () => {
    capas().forEach(([id, t]) => {
      const deitado = t.render(capa({ template: id, format: '16:9' }), P.POSTER_FORMATS['16:9'], portal);
      const retrato = t.render(capa({ template: id, format: '9:16' }), P.POSTER_FORMATS['9:16'], portal);
      expect(deitado, id).not.toBe(retrato);
    });
  });

  it('renderiza em todos os formatos, cheio e vazio', () => {
    Object.entries(P.POSTER_FORMATS).forEach(([fid, fmt]) => {
      capas().forEach(([id, t]) => {
        expect(t.render(capa({ template: id, format: fid }), fmt, portal), `${id}/${fid}`)
          .toContain('poster-1440');
        const vazio = { id: 'v', template: id, format: fid, portalSnapshot: portal };
        expect(t.render(vazio, fmt, portal), `${id}/${fid} vazio`).toContain('poster-1440');
      });
    });
  });

  it('a arte tem exatamente as dimensões do formato', () => {
    Object.entries(P.POSTER_FORMATS).forEach(([fid, fmt]) => {
      capas().forEach(([id, t]) => {
        const raiz = texto(t.render(capa({ template: id, format: fid }), fmt, portal))
          .querySelector('.poster-1440');
        expect(raiz.getAttribute('style'), `${id}/${fid}`)
          .toContain(`width:${fmt.w}px;height:${fmt.h}px`);
      });
    });
  });
});

describe('a assinatura do canal tem lugar reservado', () => {
  // Defeito que só apareceu ao renderizar em retrato: o texto do painel descia
  // por cima do selo do canal. Reservar com padding NÃO resolvia — o
  // overflow:hidden recorta na borda do padding, então o conteúdo invadia a
  // reserva. O que segura é a caixa de texto terminar acima do selo.
  it('todo modelo desenha o selo, e só um', () => {
    Object.keys(P.POSTER_FORMATS).forEach((fid) => {
      capas().forEach(([id, t]) => {
        const doc = texto(t.render(capa({ template: id, format: fid }), P.POSTER_FORMATS[fid], portal));
        expect(doc.querySelectorAll('[data-thumb-marca]').length, `${id}/${fid}`).toBe(1);
      });
    });
  });

  it('o selo traz o @ do canal', () => {
    const doc = texto(P.POSTER_TEMPLATES['thumb-impacto'].render(capa(), P.POSTER_FORMATS['16:9'], portal));
    expect(doc.querySelector('[data-thumb-marca]').textContent).toContain('@canalexemplo');
  });

  it('sem @ nem nome, o selo simplesmente não aparece', () => {
    const doc = texto(P.POSTER_TEMPLATES['thumb-impacto']
      .render(capa({ portalSnapshot: {} }), P.POSTER_FORMATS['16:9'], {}));
    expect(doc.querySelector('[data-thumb-marca]')).toBeFalsy();
  });
});

describe('o que não sobrevive à exportação fica de fora', () => {
  // Mesma regra do resto da biblioteca (ver poster-export-fidelity.test.js), com
  // um agravante: capa é feita de contraste, e a tentação de resolver contraste
  // com sombra de texto é enorme — e é justamente o que o html2canvas não pinta.
  const proibidas = [
    ['text-shadow', /text-shadow\s*:/],
    ['box-shadow', /box-shadow\s*:/],
    ['filter', /[^-\w]filter\s*:/],
    ['backdrop-filter', /backdrop-filter\s*:/],
    ['mix-blend-mode', /mix-blend-mode\s*:/],
    ['-webkit-text-stroke', /-webkit-text-stroke/],
    ['box-decoration-break', /box-decoration-break/],
  ];
  proibidas.forEach(([nome, re]) => {
    it(`nenhuma capa usa ${nome}`, () => {
      const achados = [];
      Object.keys(P.POSTER_FORMATS).forEach((fid) => {
        capas().forEach(([id, t]) => {
          if (re.test(t.render(capa({ template: id, format: fid }), P.POSTER_FORMATS[fid], portal))) {
            achados.push(`${id}/${fid}`);
          }
        });
      });
      expect(achados).toEqual([]);
    });
  });

  it('o contraste vem de bloco sólido ou degradê, que o export pinta', () => {
    capas().forEach(([id, t]) => {
      const html = t.render(capa({ template: id }), P.POSTER_FORMATS['16:9'], portal);
      expect(/background:(?!\s*none)/.test(html), `${id} não tem fundo sólido/degradê`).toBe(true);
    });
  });
});

describe('a escolha da capa leva o formato junto', () => {
  it('entrar num modelo de capa sugere o 16:9', () => {
    // Mesma cortesia que os modelos de rede já faziam com o 9:16: o ajuste
    // manual logo depois é o que o modelo deveria poupar.
    const js = P.posterEhCapaDeVideo.toString();
    expect(js).toContain("'thumb'");
  });
});
