// JULGADOR — os perfis de peso por formato
//
// `JULG_FORMATOS` é o registro que deixa a nota ponderada saber que retenção
// não vale a mesma coisa num Short e num vídeo informativo. Cada perfil é uma
// OPINIÃO EDITORIAL, não uma verdade — mas os números têm que somar 100 (senão
// a nota ponderada de dois formatos deixaria de ser comparável) e os perfis
// precisam ser de fato diferentes entre si (senão o seletor da tela seria
// decoração).
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let J;
beforeAll(() => {
  clearStorage();
  J = loadModules(
    ['catalogs.js', 'core.js', 'poster-templates.js', 'agents.js', 'narrativa-motor.js',
      'causos-motor.js', 'embalagem.js', 'julgador-motor.js'],
    ['JULG_FORMATOS', 'JULG_DIMENSOES', 'julgFormato']);
});

describe('cada perfil de formato', () => {
  it('soma exatamente 100 de peso', () => {
    J.JULG_FORMATOS.forEach((f) => {
      const soma = Object.values(f.pesos).reduce((acc, p) => acc + p, 0);
      expect(soma, `${f.id} não soma 100`).toBe(100);
    });
  });

  it('dá peso a toda dimensão que existe — nenhuma fica de fora do formulário', () => {
    const ids = J.JULG_DIMENSOES.map((d) => d.id);
    J.JULG_FORMATOS.forEach((f) => {
      ids.forEach((id) => {
        expect(f.pesos[id], `${f.id} sem peso para ${id}`).toBeGreaterThan(0);
      });
      // E não sobra peso para dimensão que não existe.
      expect(Object.keys(f.pesos).sort()).toEqual(ids.slice().sort());
    });
  });

  it('tem id e label, e nenhum se repete', () => {
    const ids = J.JULG_FORMATOS.map((f) => f.id);
    expect(new Set(ids).size, 'id de formato repetido').toBe(ids.length);
    J.JULG_FORMATOS.forEach((f) => {
      expect(f.label, `${f.id} sem rótulo`).toBeTruthy();
      expect(f.contexto, `${f.id} sem contexto`).toBeTruthy();
    });
  });

  it('geral é o primeiro item — é o default neutro', () => {
    expect(J.JULG_FORMATOS[0].id).toBe('geral');
  });

  it('os perfis são de fato distintos — guarda contra copiar-colar esquecido', () => {
    const chave = (f) => J.JULG_DIMENSOES.map((d) => f.pesos[d.id]).join(',');
    const assinaturas = J.JULG_FORMATOS.map(chave);
    expect(new Set(assinaturas).size, 'dois formatos com a mesma tabela de pesos').toBe(assinaturas.length);
  });
});

describe('julgFormato', () => {
  it('acha o formato pelo id', () => {
    expect(J.julgFormato('curto').id).toBe('curto');
    expect(J.julgFormato('informativo').label).toMatch(/Informativo/);
  });

  it('cai no geral para id ausente', () => {
    expect(J.julgFormato(undefined).id).toBe('geral');
    expect(J.julgFormato('').id).toBe('geral');
  });

  it('cai no geral para id desconhecido', () => {
    expect(J.julgFormato('nao-existe').id).toBe('geral');
  });
});
