// Fase 0 — rede de segurança: espelhamento unificado da chave/modelo Groq.
// Esta é a camada que entrega a chave às ferramentas embutidas; uma regressão
// aqui quebra silenciosamente o Replicador.
//
// O Detector Flop e o AutoPost IA saíram da plataforma no r227. Os nomes de
// chave deles ('df_groq_key', 'groq_api_key') continuam sendo LIDOS na adoção
// suave e APAGADOS na limpeza — quem já usava a plataforma tem essas chaves
// guardadas no aparelho, e sumir com a ferramenta não é motivo para perder a
// chave nem para deixá-la esquecida ali. O que deixou de existir é a escrita:
// nada mais é gravado nesses nomes.
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
  it('espelha a chave canônica para os slots das ferramentas que existem', () => {
    S.State.apiKeys.groq = 'gsk_teste';
    S.syncGroqKey();
    expect(localStorage.getItem('replicador_groq_api_key')).toBe('gsk_teste');
  });

  it('NÃO escreve mais nos slots das ferramentas removidas', () => {
    // Gravar a chave em nome de ferramenta que não existe é espalhar segredo
    // por espalhar: mais uma cópia em claro no aparelho, sem ninguém para ler.
    S.State.apiKeys.groq = 'gsk_teste';
    S.syncGroqKey();
    expect(localStorage.getItem('groq_api_key')).toBe(null);
    expect(localStorage.getItem('df_groq_key')).toBe(null);
  });

  it('adoção suave: sem chave no app, adota a de uma ferramenta já configurada', () => {
    S.State.apiKeys.groq = '';
    localStorage.setItem('replicador_groq_api_key', 'gsk_de_ferramenta');
    S.syncGroqKey();
    expect(S.State.apiKeys.groq).toBe('gsk_de_ferramenta');
  });

  it('a adoção suave NÃO adota o blob cifrado como se fosse chave', () => {
    // Ele guarda '{"v":1,...}', não um segredo utilizável: adotá-lo faria a
    // plataforma sair chamando a Groq com um JSON no lugar da chave.
    S.State.apiKeys.groq = '';
    localStorage.setItem('df_groq_key_enc', '{"cifrado":true}');
    S.syncGroqKey();
    expect(S.State.apiKeys.groq).toBe('');
  });

  it('a adoção suave ainda enxerga a chave deixada pelas ferramentas removidas', () => {
    // Quem tinha a chave só no AutoPost não pode ficar sem chave nenhuma só
    // porque a ferramenta saiu — a chave é da pessoa, não da ferramenta.
    S.State.apiKeys.groq = '';
    localStorage.setItem('groq_api_key', 'gsk_do_autopost');
    S.syncGroqKey();
    expect(S.State.apiKeys.groq).toBe('gsk_do_autopost');
  });
});

describe('syncGroqModel', () => {
  it('não escreve modelo em slot de ferramenta removida', () => {
    const validId = S.PROVIDER_MODELS.groq[0].id;
    S.State.models.groq = validId;
    S.syncGroqModel();
    expect(localStorage.getItem('groq_model')).toBe(null);
    expect(localStorage.getItem('df_model')).toBe(null);
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

  it('leva junto a versão cifrada do Detector, que não tem mais quem leia', () => {
    // Antes ela era preservada: era escolha local do usuário DENTRO daquela
    // ferramenta. Sem a ferramenta, é uma cópia ilegível de uma chave que o
    // usuário acabou de mandar apagar.
    localStorage.setItem('df_groq_key', 'k');
    localStorage.setItem('df_groq_key_enc', '{"cifrado":true}');
    S.clearGroqMirrors();
    expect(localStorage.getItem('df_groq_key')).toBe(null);
    expect(localStorage.getItem('df_groq_key_enc')).toBe(null);
  });

  it('a limpeza varre também os modelos que as ferramentas removidas liam', () => {
    localStorage.setItem('groq_model', 'm');
    localStorage.setItem('df_model', 'm');
    S.clearGroqMirrors();
    expect(localStorage.getItem('groq_model')).toBe(null);
    expect(localStorage.getItem('df_model')).toBe(null);
  });
});
