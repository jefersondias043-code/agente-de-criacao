// DESIGN SYSTEM — trava a identidade única da plataforma.
//
// A plataforma já conviveu com 4 cores de marca, 4 vocabulários de token e 3
// famílias tipográficas: trocar de ferramenta parecia trocar de aplicativo.
// Estes testes existem para que isso não volte por descuido — qualquer valor
// cru de marca reintroduzido numa ferramenta quebra a suíte.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const DS = ler('design-system.css');

/** Remove comentários CSS/HTML — o que sobra é o que realmente pinta a tela. */
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

// Ferramentas embutidas + o shell. autopost-ia.html é gerado; autopost-ia/ é a fonte.
const SUPERFICIES = ['index.html', 'styles.css', 'removedor.html', 'detector-flop.html',
  'replicador.html', 'autopost-ia.html', 'autopost-ia/css/app.css', 'autopost-ia/index.html'];

describe('fonte única de tokens', () => {
  it('define a marca, a tipografia e o movimento num lugar só', () => {
    for (const token of ['--ds-accent', '--ds-paper', '--ds-surface', '--ds-ink',
      '--ds-font-sans', '--ds-font-display', '--ds-font-mono', '--ds-ease', '--ds-radius']) {
      expect(DS, token).toContain(token + ':');
    }
  });

  it('a marca da plataforma é um vermelho só', () => {
    expect(DS).toMatch(/--ds-accent:\s*#cf3418/);
  });

  it('todas as superfícies carregam o design system', () => {
    for (const f of ['index.html', 'removedor.html', 'detector-flop.html', 'replicador.html', 'autopost-ia.html']) {
      expect(ler(f), f).toMatch(/<link[^>]+design-system\.css/);
    }
  });
});

describe('nenhuma ferramenta tem marca própria', () => {
  // Cores de marca que cada ferramenta trazia antes da unificação.
  const MARCAS_ANTIGAS = {
    '#ff5b1f': 'laranja do AutoPost',
    '#ff7a3d': 'laranja claro do AutoPost',
    '#ff6f3a': 'laranja hover do AutoPost',
    '#c9762f': 'âmbar do Detector',
    '#d4a574': 'dourado do Replicador',
    '#b8341c': 'vermelho improvisado dos temas claros',
    '#d68b48': 'âmbar suave do Detector',
  };

  for (const f of SUPERFICIES) {
    it(`${f} não reintroduz cor de marca antiga`, () => {
      const css = semComentarios(ler(f)).toLowerCase();
      const achados = Object.keys(MARCAS_ANTIGAS).filter((hex) => css.includes(hex));
      expect(achados.map((h) => `${h} (${MARCAS_ANTIGAS[h]})`)).toEqual([]);
    });
  }
});

describe('tipografia unificada', () => {
  it('as ferramentas usam a fonte da plataforma, não uma própria', () => {
    for (const f of ['removedor.html', 'detector-flop.html', 'replicador.html', 'autopost-ia/css/app.css']) {
      expect(semComentarios(ler(f)), f).toContain('--ds-font-sans');
    }
  });

  it('o shell aponta as próprias famílias para as canônicas', () => {
    const css = ler('styles.css');
    expect(css).toMatch(/--sans:\s*var\(--ds-font-sans\)/);
    expect(css).toMatch(/--serif:\s*var\(--ds-font-display\)/);
    expect(css).toMatch(/--mono:\s*var\(--ds-font-mono\)/);
  });
});

describe('vocabulários locais viram aliases', () => {
  const CASOS = [
    ['styles.css', '--paper', '--ds-paper'],
    ['styles.css', '--accent', '--ds-accent'],
    ['removedor.html', '--accent', '--ds-accent'],
    ['detector-flop.html', '--text', '--ds-ink'],
    ['replicador.html', '--bg', '--ds-paper'],
    ['autopost-ia/css/app.css', '--bg-card', '--ds-surface'],
  ];
  for (const [arquivo, local, canonico] of CASOS) {
    it(`${arquivo}: ${local} aponta para ${canonico}`, () => {
      const re = new RegExp(local.replace(/-/g, '\\-') + '\\s*:\\s*var\\(' + canonico.replace(/-/g, '\\-') + '\\)');
      expect(semComentarios(ler(arquivo))).toMatch(re);
    });
  }
});

describe('comportamentos universais', () => {
  it('anel de foco, seleção e rolagem valem para a plataforma inteira', () => {
    expect(DS).toContain(':focus-visible');
    expect(DS).toContain('::selection');
    expect(DS).toContain('::-webkit-scrollbar');
  });

  it('respeita quem pediu menos movimento', () => {
    expect(DS).toContain('prefers-reduced-motion');
  });
});

describe('o design system é cacheado offline', () => {
  it('está na lista do service worker', () => {
    expect(ler('service-worker.js')).toContain("'./design-system.css'");
  });
});
