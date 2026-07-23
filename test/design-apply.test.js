// applyDesignToPoster — a ponte entre a escolha do AGENTE DE DESIGN e o objeto
// cartaz/slide. Valida contra os catálogos reais e escreve em p.custom (paleta +
// tipografia) sem inventar campos inválidos.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let P;
beforeEach(() => {
  clearStorage();
  P = loadModules(
    ['catalogs.js', 'core.js', 'posters.js', 'poster-templates.js'],
    ['applyDesignToPoster', 'POSTER_TEMPLATES', 'POSTER_PALETTES', 'POSTER_FONTS']
  );
});

describe('applyDesignToPoster', () => {
  it('aplica modelo, formato, paleta e tipografia válidos', () => {
    const poster = { template: 'manchete', format: '3:4' };
    P.applyDesignToPoster(poster, { template: 'numbers-data', format: '1:1', palette: 'azul-institucional', font: 'jakarta' });
    expect(poster.template).toBe('numbers-data');
    expect(poster.format).toBe('1:1');
    expect(poster.custom.palette).toBe('azul-institucional');
    expect(poster.custom.font).toBe('jakarta');
    expect(poster.custom.autoContrast).toBe(true);
  });

  it('ignora ids inválidos sem quebrar o cartaz', () => {
    const poster = { template: 'manchete', format: '3:4' };
    P.applyDesignToPoster(poster, { template: 'xxx', format: '3:4', palette: 'yyy', font: 'zzz' });
    expect(poster.template).toBe('manchete');       // inalterado (template inválido)
    expect(poster.custom).toBeUndefined();          // nada válido → sem custom
  });

  it('aplica só a parte visual (paleta+fonte) quando template/formato ausentes — caso carrossel', () => {
    const poster = { template: 'destaque-foto', format: '1:1' };
    P.applyDesignToPoster(poster, { palette: 'verde-editorial', font: 'fraunces' });
    expect(poster.template).toBe('destaque-foto');  // preservado
    expect(poster.format).toBe('1:1');              // preservado
    expect(poster.custom.palette).toBe('verde-editorial');
    expect(poster.custom.font).toBe('fraunces');
  });

  it('preserva custom pré-existente e mescla', () => {
    const poster = { template: 'manchete', format: '3:4', custom: { bg: 'solid' } };
    P.applyDesignToPoster(poster, { palette: 'roxo-premium' });
    expect(poster.custom.bg).toBe('solid');         // mantido
    expect(poster.custom.palette).toBe('roxo-premium');
  });

  it('no-op quando design é nulo', () => {
    const poster = { template: 'manchete', format: '3:4' };
    P.applyDesignToPoster(poster, null);
    expect(poster.template).toBe('manchete');
    expect(poster.custom).toBeUndefined();
  });
});
