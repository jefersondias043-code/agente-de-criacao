// Fase 0 — rede de segurança: espelhamento unificado da chave/modelo Groq.
// Esta é a camada que entrega a chave às ferramentas embutidas; uma regressão
// aqui quebra silenciosamente Detector/AutoPost/Replicador.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let S;
beforeEach(() => {
  clearStorage();
  S = loadModules(['catalogs.js', 'core.js', 'apikey-sync.js'], [
    'syncGroqKey', 'syncGroqModel', 'clearGroqMirrors', 'currentGroqConfig',
    'State', 'PROVIDER_MODELS',
  ]);
});

describe('syncGroqKey', () => {
  it('espelha a chave canônica para todos os slots das ferramentas', () => {
    S.State.apiKeys.groq = 'gsk_teste';
    S.syncGroqKey();
    expect(localStorage.getItem('groq_api_key')).toBe('gsk_teste');
    expect(localStorage.getItem('df_groq_key')).toBe('gsk_teste');
    expect(localStorage.getItem('replicador_groq_api_key')).toBe('gsk_teste');
  });

  it('adoção suave: sem chave no app, adota a de uma ferramenta já configurada', () => {
    S.State.apiKeys.groq = '';
    localStorage.setItem('groq_api_key', 'gsk_de_ferramenta');
    S.syncGroqKey();
    expect(S.State.apiKeys.groq).toBe('gsk_de_ferramenta');
  });

  it('NÃO sobrescreve df_groq_key quando há versão cifrada do Detector', () => {
    S.State.apiKeys.groq = 'gsk_app';
    localStorage.setItem('df_groq_key_enc', '{"cifrado":true}');
    S.syncGroqKey();
    // chave em claro do Detector permanece intocada (escolha local do usuário lá)
    expect(localStorage.getItem('df_groq_key')).toBe(null);
    // os demais espelhos seguem normalmente
    expect(localStorage.getItem('groq_api_key')).toBe('gsk_app');
  });
});

describe('syncGroqModel', () => {
  it('espelha o modelo para AutoPost e Detector', () => {
    const validId = S.PROVIDER_MODELS.groq[0].id;
    S.State.models.groq = validId;
    S.syncGroqModel();
    expect(localStorage.getItem('groq_model')).toBe(validId);
    expect(localStorage.getItem('df_model')).toBe(validId);
  });

  it('normaliza modelo fora do catálogo para o padrão', () => {
    S.State.models.groq = 'modelo-que-nao-existe';
    S.syncGroqModel();
    expect(S.State.models.groq).toBe(S.PROVIDER_MODELS.groq[0].id);
  });
});

describe('clearGroqMirrors', () => {
  it('remove os espelhos em claro', () => {
    localStorage.setItem('groq_api_key', 'k');
    localStorage.setItem('df_groq_key', 'k');
    localStorage.setItem('replicador_groq_api_key', 'k');
    S.clearGroqMirrors();
    expect(localStorage.getItem('groq_api_key')).toBe(null);
    expect(localStorage.getItem('replicador_groq_api_key')).toBe(null);
    expect(localStorage.getItem('df_groq_key')).toBe(null);
  });

  it('preserva df_groq_key quando há versão cifrada', () => {
    localStorage.setItem('df_groq_key', 'k');
    localStorage.setItem('df_groq_key_enc', '{"cifrado":true}');
    S.clearGroqMirrors();
    expect(localStorage.getItem('df_groq_key')).toBe('k');
  });
});
