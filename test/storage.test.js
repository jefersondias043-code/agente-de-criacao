// Fase 0 — rede de segurança: contrato de backup/restauração do workspace.
// Cobre a lógica crítica e propensa a regressão de storage.js (coleta seletiva
// de chaves, restauração só de chaves reconhecidas, merge vs replace e o
// round-trip completo incluindo imagens no IndexedDB — via mock em memória).
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';
import { installIdbMock, resetIdb } from './helpers/idb-mock.mjs';

let S;
beforeEach(() => {
  clearStorage();
  resetIdb();
  installIdbMock();
  S = loadModules(['core.js', 'crypto.js', 'storage.js'], [
    'isWorkspaceKey', 'collectWorkspace', 'storageUsageBytes',
    'importWorkspaceData', 'exportWorkspace', 'idbSet', 'idbGet', 'idbGetAll',
    'WORKSPACE_SECRET_KEYS', 'cryptoEncryptString', 'cryptoDecryptString',
    'saveGenerations', 'saveExtractions', 'hydrateHistories', 'State',
    'dataUrlToBlob', 'blobToDataUrl',
  ]);
});

describe('isWorkspaceKey', () => {
  it('reconhece os prefixos da plataforma e rejeita o resto', () => {
    expect(S.isWorkspaceKey('agp.posters')).toBe(true);
    expect(S.isWorkspaceKey('df_groq_key')).toBe(true);
    expect(S.isWorkspaceKey('rv_historico')).toBe(true);
    expect(S.isWorkspaceKey('replicador_x')).toBe(true);
    expect(S.isWorkspaceKey('groq_model')).toBe(true);
    expect(S.isWorkspaceKey('intruso')).toBe(false);
    expect(S.isWorkspaceKey(null)).toBe(false);
    expect(S.isWorkspaceKey(123)).toBe(false);
  });
});

describe('collectWorkspace', () => {
  it('coleta só as chaves da plataforma', () => {
    localStorage.setItem('agp.generations', '[1]');
    localStorage.setItem('df_nicho', 'geral');
    localStorage.setItem('intruso', 'x');
    const data = S.collectWorkspace();
    expect(data['agp.generations']).toBe('[1]');
    expect(data['df_nicho']).toBe('geral');
    expect(data.intruso).toBeUndefined();
  });
});

describe('importWorkspaceData', () => {
  it('restaura só chaves reconhecidas (modo merge)', async () => {
    const n = await S.importWorkspaceData({ data: { 'agp.x': '1', mal: '2' } }, 'merge');
    expect(localStorage.getItem('agp.x')).toBe('1');
    expect(localStorage.getItem('mal')).toBe(null);
    expect(n).toBe(1);
  });

  it('modo replace limpa as chaves antigas da plataforma', async () => {
    localStorage.setItem('agp.old', 'sai');
    await S.importWorkspaceData({ data: { 'agp.new': 'v' } }, 'replace');
    expect(localStorage.getItem('agp.old')).toBe(null);
    expect(localStorage.getItem('agp.new')).toBe('v');
  });

  it('rejeita payloads inválidos', async () => {
    await expect(S.importWorkspaceData(null)).rejects.toThrow();
    await expect(S.importWorkspaceData({})).rejects.toThrow();
  });
});

describe('backup protegido por senha (chaves cifradas)', () => {
  it('decifra as chaves com a senha certa e restaura junto com o resto', async () => {
    const subset = { 'agp.apiKeys': '{"groq":"gsk_secreto"}' };
    const secrets = await S.cryptoEncryptString(JSON.stringify(subset), 'minhasenha');
    const payload = { data: { 'agp.posters': '[]' }, secrets, encrypted: true };
    await S.importWorkspaceData(payload, 'merge', 'minhasenha');
    expect(localStorage.getItem('agp.apiKeys')).toBe('{"groq":"gsk_secreto"}');
    expect(localStorage.getItem('agp.posters')).toBe('[]');
  });

  it('senha errada lança e NÃO restaura a chave', async () => {
    const secrets = await S.cryptoEncryptString(JSON.stringify({ 'agp.apiKeys': 'k' }), 'certa');
    await expect(S.importWorkspaceData({ data: {}, secrets }, 'merge', 'errada')).rejects.toThrow();
    // o segredo 'k' não pode ter sido escrito (permanece o default vazio do State)
    expect(localStorage.getItem('agp.apiKeys')).not.toBe('k');
  });

  it('backup protegido sem senha é recusado', async () => {
    const secrets = await S.cryptoEncryptString('x', 'p');
    await expect(S.importWorkspaceData({ data: {}, secrets }, 'merge')).rejects.toThrow(/protegido/);
  });

  it('as chaves sensíveis estão listadas em WORKSPACE_SECRET_KEYS', () => {
    expect(S.WORKSPACE_SECRET_KEYS).toContain('agp.apiKeys');
    expect(S.WORKSPACE_SECRET_KEYS).toContain('groq_api_key');
    expect(S.WORKSPACE_SECRET_KEYS).toContain('df_groq_key');
  });
});

describe('imagens como Blob no IndexedDB', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('dataUrlToBlob ↔ blobToDataUrl preservam tipo e bytes', async () => {
    const blob = S.dataUrlToBlob(PNG);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(await S.blobToDataUrl(blob)).toBe(PNG);
  });

  it('import grava imagens (pimg:) como Blob; texto (gen:) continua string', async () => {
    await S.importWorkspaceData({ data: {}, idbData: { 'pimg:p1:image1': PNG, 'gen:1': 'corpo de texto' } }, 'merge');
    const img = await S.idbGet('pimg:p1:image1');
    const txt = await S.idbGet('gen:1');
    expect(img).toBeInstanceOf(Blob);
    expect(typeof txt).toBe('string');
    expect(await S.blobToDataUrl(img)).toBe(PNG);
  });
});

describe('históricos no IndexedDB (arquitetura escalável)', () => {
  it('saveGenerations persiste o array inteiro no IDB (hist:generations), não no localStorage', async () => {
    S.State.generations = [{ id: '1', content: 'x'.repeat(3000) }, { id: '2', content: 'curto' }];
    await S.saveGenerations();
    const stored = await S.idbGet('hist:generations');
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.length).toBe(2);
    expect(stored[0].content.length).toBe(3000);            // corpo completo, sem sentinela
    expect(localStorage.getItem('agp.generations')).toBe(null); // nada no localStorage
  });

  it('hydrateHistories carrega matérias/extrações do IDB para a memória', async () => {
    await S.idbSet('hist:generations', [{ id: '9', content: 'CONTEÚDO COMPLETO' }]);
    await S.idbSet('hist:extractions', [{ id: 'e1', text: 'EXTRAÇÃO' }]);
    S.State.generations = [];
    S.State.extractions = [];
    await S.hydrateHistories();
    expect(S.State.generations[0].content).toBe('CONTEÚDO COMPLETO');
    expect(S.State.extractions[0].text).toBe('EXTRAÇÃO');
  });

  it('hydrateHistories MIGRA o histórico antigo do localStorage (sentinela legada) para o IDB', async () => {
    await S.idbSet('gen:7', 'CORPO LONGO LEGADO');           // formato antigo (offload de corpo)
    S.State.generations = [{ id: '7', content: '@idb:gen:7' }]; // como veio do localStorage no init
    await S.hydrateHistories();
    expect(S.State.generations[0].content).toBe('CORPO LONGO LEGADO'); // sentinela resolvida
    const migrated = await S.idbGet('hist:generations');
    expect(migrated[0].content).toBe('CORPO LONGO LEGADO');  // movido para o IDB
  });
});

describe('round-trip export → import (localStorage + IndexedDB)', () => {
  it('preserva metadados e imagens entre "navegadores"', async () => {
    localStorage.setItem('agp.posters', '[{"id":1}]');
    localStorage.setItem('agp.apiKeys', '{"groq":"k"}');
    await S.idbSet('pimg:1:image1', 'data:abc');

    // Espelha o que exportWorkspace empacota (collect + idbGetAll).
    const payload = { data: S.collectWorkspace(), idbData: await S.idbGetAll() };

    // Simula outro navegador, totalmente limpo.
    clearStorage();
    resetIdb();

    const n = await S.importWorkspaceData(payload, 'merge');
    expect(localStorage.getItem('agp.posters')).toBe('[{"id":1}]');
    expect(localStorage.getItem('agp.apiKeys')).toBe('{"groq":"k"}');
    expect(await S.idbGet('pimg:1:image1')).toBe('data:abc');
    expect(n).toBeGreaterThanOrEqual(3);
  });
});
