// Cópia em UMA ação: a matéria e as hashtags saem juntas.
//
// Antes eram duas operações (botão "Copiar" para o texto, botão "Copiar
// hashtags" para o resto), e quem ia publicar precisava das duas. As hashtags
// continuam FORA de `g.content` de propósito — cartaz e carrossel consomem esse
// campo e não devem receber "#salvador" no meio do texto —, então a junção
// acontece na hora de copiar.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let G;
beforeAll(() => {
  clearStorage();
  G = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'handoff.js', 'generate.js'],
    ['generationFullText', 'pipelineExtrasHtml']
  );
});

describe('generationFullText', () => {
  it('junta matéria e hashtags num bloco só', () => {
    const g = { content: 'Título\n\nCorpo da matéria.', article: { hashtags: ['#salvador', '#calabar'] } };
    expect(G.generationFullText(g)).toBe('Título\n\nCorpo da matéria.\n\n#salvador #calabar');
  });

  it('sem hashtags, devolve a matéria intacta (sem linhas sobrando)', () => {
    const g = { content: 'Só o texto.', article: { hashtags: [] } };
    expect(G.generationFullText(g)).toBe('Só o texto.');
  });

  it('geração antiga (sem article) continua copiável', () => {
    expect(G.generationFullText({ content: 'Matéria antiga.' })).toBe('Matéria antiga.');
  });

  it('tolera geração vazia', () => {
    expect(G.generationFullText(null)).toBe('');
    expect(G.generationFullText({})).toBe('');
  });

  it('NÃO altera g.content — cartaz e carrossel leem esse campo limpo', () => {
    const g = { content: 'Corpo.', article: { hashtags: ['#a'] } };
    G.generationFullText(g);
    expect(g.content).toBe('Corpo.');
  });
});

describe('bloco de hashtags no resultado', () => {
  it('mostra as hashtags e avisa que já vão na cópia', () => {
    const html = G.pipelineExtrasHtml({ pipeline: true, article: { hashtags: ['#x', '#y'] } });
    expect(html).toContain('#x');
    expect(html).toContain('Incluídas ao copiar');
  });

  it('não oferece mais um botão separado de copiar hashtags', () => {
    const html = G.pipelineExtrasHtml({ pipeline: true, article: { hashtags: ['#x'] } });
    expect(html).not.toContain('data-gen-hashtags');
  });

  it('sem hashtags, não desenha bloco nenhum', () => {
    expect(G.pipelineExtrasHtml({ pipeline: true, article: { hashtags: [] } })).toBe('');
  });

  it('geração fora do pipeline não tem bloco', () => {
    expect(G.pipelineExtrasHtml({ pipeline: false, article: { hashtags: ['#x'] } })).toBe('');
  });
});

describe('o "Design sugerido" saiu da ferramenta', () => {
  it('nenhum resquício do agente de design no código de geração', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const raiz = path.resolve(__dirname, '..');
    ['src/agents.js', 'src/generate.js'].forEach((f) => {
      const txt = fs.readFileSync(path.join(raiz, f), 'utf8');
      expect(txt, f).not.toMatch(/runDesignAgent|DESIGN_TEMPLATE_MENU|design-suggest|Design sugerido/);
    });
  });

  it('cartaz e carrossel não aplicam mais design automático', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const raiz = path.resolve(__dirname, '..');
    ['src/posters.js', 'src/carousels.js'].forEach((f) => {
      const txt = fs.readFileSync(path.join(raiz, f), 'utf8');
      expect(txt, f).not.toMatch(/applyDesignToPoster/);
    });
  });
});
