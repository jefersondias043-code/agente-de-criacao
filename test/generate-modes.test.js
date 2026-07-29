// Modo de geração (Agentes vs Rápido) — cobre as funções PURAS de montagem do
// objeto de geração para cada modo. O toggle em si (setGenMode/wireGenMode) é
// wiring de DOM; aqui o foco é o CONTRATO de dados que cada modo produz, que é
// o que o resto do app (cartaz/carrossel/histórico) consome.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let G;
beforeAll(() => {
  clearStorage();
  G = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js', 'generate.js'],
    ['assembleAgentsGeneration', 'assembleFastGeneration', 'MAX_CONTENT_CHARS', 'setGenMode', 'wireGenMode', 'State']
  );
});

describe('assembleAgentsGeneration', () => {
  const baseResult = {
    content: 'Título\n\nCorpo.',
    interpretation: { categoria: 'GERAL' },
    article: { titulo: 'Título', hashtags: ['#x'] },
    agents: { interpreter: { ok: true } },
    model: 'stub-model',
    promptTokens: 10,
    completionTokens: 20,
  };

  it('marca pipeline:true e carrega os campos estruturados', () => {
    const g = G.assembleAgentsGeneration({
      style: 'Jornalístico', tone: 'Neutro', manualText: 'texto', extractionId: '',
      combinedText: 'texto', result: baseResult, createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(g.pipeline).toBe(true);
    expect(g.article).toBe(baseResult.article);
    expect(g.interpretation).toBe(baseResult.interpretation);
    expect(g.agents).toBe(baseResult.agents);
    expect(g.content).toBe('Título\n\nCorpo.');
    expect(g.model).toBe('stub-model');
    expect(typeof g.id).toBe('string');
    expect(g.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('sem truncamento quando o texto cabe no limite', () => {
    const g = G.assembleAgentsGeneration({
      style: 'S', tone: 'T', manualText: 'x', extractionId: '', combinedText: 'texto curto', result: baseResult, createdAt: 'now',
    });
    expect(g.wasTruncated).toBe(false);
    expect(g.warnings).toEqual([]);
  });

  it('detecta truncamento quando o texto excede MAX_CONTENT_CHARS', () => {
    const long = 'a'.repeat(G.MAX_CONTENT_CHARS + 500);
    const g = G.assembleAgentsGeneration({
      style: 'S', tone: 'T', manualText: long, extractionId: '', combinedText: long, result: baseResult, createdAt: 'now',
    });
    expect(g.wasTruncated).toBe(true);
    expect(g.finalCharCount).toBe(G.MAX_CONTENT_CHARS);
    expect(g.warnings.length).toBe(1);
  });

  it('extractionId vazio vira null (não string vazia)', () => {
    const g = G.assembleAgentsGeneration({
      style: 'S', tone: 'T', manualText: '', extractionId: '', combinedText: 'x', result: baseResult, createdAt: 'now',
    });
    expect(g.extractionId).toBeNull();
    expect(g.manualText).toBeNull();
  });
});

describe('assembleFastGeneration', () => {
  const built = { originalCharCount: 100, finalCharCount: 100, wasTruncated: false };
  const result = { content: 'Matéria em texto corrido.', model: 'stub-model', promptTokens: 5, completionTokens: 8 };

  it('marca pipeline:false e NÃO carrega campos do pipeline', () => {
    const g = G.assembleFastGeneration({ style: 'S', tone: 'T', manualText: 'x', extractionId: '', built, result, createdAt: 'now' });
    expect(g.pipeline).toBe(false);
    expect(g.article).toBeUndefined();
    expect(g.interpretation).toBeUndefined();
    expect(g.content).toBe('Matéria em texto corrido.');
  });

  it('usa os contadores de caracteres vindos de buildPrompt (built)', () => {
    const truncBuilt = { originalCharCount: 15000, finalCharCount: 12000, wasTruncated: true };
    const g = G.assembleFastGeneration({ style: 'S', tone: 'T', manualText: 'x', extractionId: '', built: truncBuilt, result, createdAt: 'now' });
    expect(g.wasTruncated).toBe(true);
    expect(g.sourceCharCount).toBe(15000);
    expect(g.finalCharCount).toBe(12000);
    expect(g.warnings[0]).toContain('15.000');
  });
});

describe('toggle Modo de geração (setGenMode/wireGenMode — wiring de DOM)', () => {
  beforeEach(() => {
    clearStorage();
    document.body.innerHTML = `
      <div class="genmode-toggle" id="g-genmode">
        <button type="button" data-mode="agents" class="active">Agentes</button>
        <button type="button" data-mode="fast">Rápido</button>
      </div>`;
  });

  it('setGenMode troca a classe active e persiste no localStorage', () => {
    G.setGenMode('fast');
    expect(G.State.genMode).toBe('fast');
    expect(localStorage.getItem('agp.genMode')).toBe('fast');
    const buttons = document.querySelectorAll('#g-genmode button');
    expect(buttons[0].classList.contains('active')).toBe(false);
    expect(buttons[1].classList.contains('active')).toBe(true);
  });

  it('valor inválido cai para "agents" (default seguro)', () => {
    G.setGenMode('algo-invalido');
    expect(G.State.genMode).toBe('agents');
    expect(document.querySelector('[data-mode="agents"]').classList.contains('active')).toBe(true);
  });

  it('wireGenMode reflete o State atual (restaurado do boot) e liga os cliques', () => {
    // State é montado uma única vez no boot a partir do localStorage (mesmo padrão
    // de `provider`); wireGenMode reflete o State em memória, não relê o storage.
    G.State.genMode = 'fast';
    G.wireGenMode();
    expect(document.querySelector('[data-mode="fast"]').classList.contains('active')).toBe(true);
    // Clique no botão "Agentes" troca o modo de volta.
    document.querySelector('[data-mode="agents"]').onclick();
    expect(G.State.genMode).toBe('agents');
    expect(document.querySelector('[data-mode="agents"]').classList.contains('active')).toBe(true);
    expect(document.querySelector('[data-mode="fast"]').classList.contains('active')).toBe(false);
  });
});
