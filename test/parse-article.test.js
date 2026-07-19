// Regra ÚNICA de autopreenchimento (Gerar/Detector/Replicador → Cartaz/Carrossel).
// Garante que título, subtítulo E corpo completo são extraídos — o bug era a
// description (texto longo) vir vazia/parcial, com só o título preenchendo.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let P;
beforeEach(() => {
  clearStorage();
  document.body.innerHTML = '<div id="toast-stack"></div>';
  globalThis.goTo = () => {};                 // createPosterFromGeneration navega no fim
  P = loadModules(['catalogs.js', 'core.js', 'posters.js'], [
    'parseArticle', 'createPosterFromGeneration', 'State',
  ]);
});

const ARTIGO_COM_SUBTITULO = `Prefeitura entrega 200 casas em Ilhéus
Investimento beneficia famílias do bairro Nelson Costa
A Prefeitura de Ilhéus entregou nesta quinta-feira 200 unidades habitacionais.
As casas fazem parte do programa habitacional municipal e custaram R$ 20 milhões.
A expectativa é entregar mais 300 moradias até dezembro deste ano.`;

const ARTIGO_SEM_SUBTITULO = `Cidade investe em saúde com novo hospital regional
A administração municipal anunciou nesta semana a construção de um novo hospital regional que vai atender mais de cinquenta mil moradores com urgência e emergência.
O investimento total é de R$ 80 milhões e as obras começam em março.`;

const ARTIGO_COM_ROTULOS = `Título: Festival movimenta o centro
Subtítulo: Três dias de shows gratuitos
Lead: O festival começa na sexta-feira com atrações locais.
Hashtags: #festival #cultura`;

describe('parseArticle', () => {
  it('extrai título, subtítulo curto e CORPO COMPLETO (vários parágrafos)', () => {
    const a = P.parseArticle(ARTIGO_COM_SUBTITULO);
    expect(a.title).toMatch(/Prefeitura entrega 200 casas/i);
    expect(a.subtitle).toMatch(/Nelson Costa/i);
    expect(a.subtitle.length).toBeLessThanOrEqual(160);
    // corpo completo: contém o lead E os parágrafos seguintes
    expect(a.body).toContain('200 unidades habitacionais');
    expect(a.body).toContain('R$ 20 milhões');
    expect(a.body).toContain('300 moradias');
    expect(a.bodyParagraphs.length).toBeGreaterThanOrEqual(3);
    // local não pode atravessar a quebra de linha (bug "IlhéusInvestimento")
    expect(a.location).toBe('Ilhéus, BA');
  });

  it('deriva um subtítulo quando a matéria não tem um, sem perder o corpo', () => {
    const a = P.parseArticle(ARTIGO_SEM_SUBTITULO);
    expect(a.title).toMatch(/novo hospital regional/i);
    expect(a.subtitle.length).toBeGreaterThanOrEqual(5);   // derivado da 1ª frase
    expect(a.body).toContain('cinquenta mil moradores');    // lead permanece no corpo
    expect(a.body).toContain('R$ 80 milhões');
  });

  it('respeita rótulos e descarta metadados (hashtags)', () => {
    const a = P.parseArticle(ARTIGO_COM_ROTULOS);
    expect(a.title).toMatch(/Festival movimenta o centro/i);
    expect(a.subtitle).toMatch(/shows gratuitos/i);
    expect(a.body).toContain('sexta-feira');
    expect(a.body).not.toMatch(/#festival/);                // metadado descartado
  });
});

describe('createPosterFromGeneration (autopreenchimento)', () => {
  it('preenche headline, subtitle E description (corpo completo)', () => {
    P.createPosterFromGeneration({ id: 'g1', content: ARTIGO_COM_SUBTITULO });
    const poster = P.State.posters[0];
    expect(poster.headline).toMatch(/Prefeitura entrega 200 casas/i);
    expect(poster.subtitle.length).toBeGreaterThan(5);
    expect(poster.description).toContain('200 unidades habitacionais');
    expect(poster.description).toContain('300 moradias');     // corpo completo, não só o lead
    expect(poster.category).toBeTruthy();
    expect(poster.location).toBeTruthy();
  });
});
