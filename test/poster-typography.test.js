// Tipografia por cartaz — o Agente de Design (ou o usuário) escolhe uma "voz"
// que troca PT.display/serif/cond. Cobre: aplicação junto com paleta, aplicação
// SÓ da fonte (sem cor) e ausência de fonte (mantém o tema).
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let P;
beforeEach(() => {
  clearStorage();
  P = loadModules(
    ['catalogs.js', 'core.js', 'poster-templates.js'],
    ['applyTheme', 'applyPosterCustom', 'PT', 'POSTER_FONTS', 'POSTER_PALETTES']
  );
});

describe('applyPosterCustom — voz tipográfica', () => {
  it('troca display/serif/cond ao escolher uma fonte (com paleta)', () => {
    P.applyTheme('municipios-bahia');
    P.applyPosterCustom({ palette: 'azul-institucional', font: 'fraunces', autoContrast: true });
    expect(P.PT.display).toBe(P.POSTER_FONTS['fraunces'].display);
    expect(P.PT.serif).toBe(P.POSTER_FONTS['fraunces'].serif);
    expect(P.PT.cond).toBe(P.POSTER_FONTS['fraunces'].cond);
  });

  it('aplica a fonte mesmo SEM mudança de cor (font-only)', () => {
    P.applyTheme('municipios-bahia');
    P.applyPosterCustom({ font: 'oswald' });
    expect(P.PT.display).toBe(P.POSTER_FONTS['oswald'].display);
    expect(P.PT.cond).toBe(P.POSTER_FONTS['oswald'].cond);
  });

  it('sem fonte custom mantém a tipografia do tema', () => {
    P.applyTheme('municipios-bahia');
    const before = P.PT.display;
    P.applyPosterCustom({ palette: 'verde-editorial', autoContrast: true });
    expect(P.PT.display).toBe(before);   // tema preservado (Poppins)
  });

  it('fonte inválida é ignorada (mantém o tema)', () => {
    P.applyTheme('municipios-bahia');
    const before = P.PT.display;
    P.applyPosterCustom({ font: 'fonte-que-nao-existe' });
    expect(P.PT.display).toBe(before);
  });
});
