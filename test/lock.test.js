// Fase 1b — segurança: bloqueio do workspace (chaves cifradas em repouso).
// Garante o invariante central: com bloqueio ativo, NENHUMA chave em texto puro
// permanece no localStorage; as chaves só vivem em memória após o desbloqueio.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let L;
beforeEach(() => {
  clearStorage();
  L = loadModules(['catalogs.js', 'core.js', 'crypto.js', 'apikey-sync.js', 'lock.js'], [
    'State', 'isWorkspaceLocked', 'lockWorkspace', 'unlockWorkspace',
    'disableWorkspaceLock', 'forgotWorkspacePassword', 'STORAGE_KEYS',
  ]);
});

const noPlaintextKeys = () => {
  expect(localStorage.getItem('agp.apiKeys')).toBe(null);
  expect(localStorage.getItem('groq_api_key')).toBe(null);
  expect(localStorage.getItem('df_groq_key')).toBe(null);
  expect(localStorage.getItem('replicador_groq_api_key')).toBe(null);
};

describe('lockWorkspace', () => {
  it('cifra as chaves e remove todo texto puro do localStorage', async () => {
    L.State.apiKeys.groq = 'gsk_secreto';
    await L.lockWorkspace('senha123');
    expect(L.isWorkspaceLocked()).toBe(true);
    expect(localStorage.getItem('agp.apiKeys.enc')).toBeTruthy();
    expect(localStorage.getItem('agp.apiKeys.enc')).not.toContain('gsk_secreto');
    noPlaintextKeys();
    expect(L.State.locked).toBe(true);
    expect(L.State.unlocked).toBe(true);
  });

  it('recusa senha curta', async () => {
    await expect(L.lockWorkspace('123')).rejects.toThrow();
  });
});

describe('unlockWorkspace', () => {
  it('decifra de volta para a memória com a senha certa', async () => {
    L.State.apiKeys.groq = 'gsk_secreto';
    await L.lockWorkspace('senha123');
    // simula nova sessão: chave fora da memória
    L.State.apiKeys = { groq: '', openai: '', anthropic: '' };
    L.State.unlocked = false;
    await L.unlockWorkspace('senha123');
    expect(L.State.apiKeys.groq).toBe('gsk_secreto');
    expect(L.State.unlocked).toBe(true);
    noPlaintextKeys(); // continua sem texto puro após desbloquear
  });

  it('senha errada lança e não expõe a chave', async () => {
    L.State.apiKeys.groq = 'gsk_secreto';
    await L.lockWorkspace('senha123');
    L.State.apiKeys = { groq: '', openai: '', anthropic: '' };
    L.State.unlocked = false;
    await expect(L.unlockWorkspace('errada')).rejects.toThrow();
    expect(L.State.apiKeys.groq).toBe('');
  });
});

describe('disableWorkspaceLock', () => {
  it('volta ao modo legado (chaves em claro, sem .enc)', async () => {
    L.State.apiKeys.groq = 'gsk_secreto';
    await L.lockWorkspace('senha123');
    L.State._lockPass = 'senha123';
    await L.disableWorkspaceLock('senha123');
    expect(localStorage.getItem('agp.apiKeys.enc')).toBe(null);
    expect(localStorage.getItem('agp.apiKeys')).toContain('gsk_secreto');
    expect(L.State.locked).toBe(false);
  });
});

describe('forgotWorkspacePassword', () => {
  it('apaga as chaves cifradas e zera o estado', async () => {
    L.State.apiKeys.groq = 'gsk_secreto';
    await L.lockWorkspace('senha123');
    L.forgotWorkspacePassword();
    expect(localStorage.getItem('agp.apiKeys.enc')).toBe(null);
    expect(L.State.apiKeys.groq).toBe('');
    expect(L.State.locked).toBe(false);
  });
});
