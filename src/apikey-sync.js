'use strict';
/* ============================================================
   CHAVE GROQ UNIFICADA
   O app principal (Configurações → Groq) é a fonte única da chave.
   Como tudo roda na mesma origem, as ferramentas embutidas leem o MESMO
   localStorage — só com nomes de chave diferentes. Esta camada espelha a
   chave canônica (State.apiKeys.groq) para esses nomes, SEM editar as
   ferramentas:
     - Replicador → 'replicador_groq_api_key'

   O AutoPost IA ('groq_api_key') e o Detector Flop ('df_groq_key') saíram da
   plataforma no r227. Os nomes deles continuam sendo LIDOS na migração suave
   abaixo, e apagados junto com os outros: quem já usava a plataforma tem essas
   chaves guardadas no aparelho, e sumir com a ferramenta não é motivo para
   perder a chave nem para deixá-la esquecida no localStorage.
   ============================================================ */
const GROQ_KEY_SLOTS = {
  replicador: 'replicador_groq_api_key',
};

/* Espelhos de ferramentas que não existem mais: entram na adoção e na limpeza,
   nunca mais recebem escrita nova. */
const GROQ_KEY_SLOTS_LEGADO = ['groq_api_key', 'df_groq_key'];

/* A versão CIFRADA do Detector é só para APAGAR — fora da lista de cima de
   propósito. Ela guarda um blob ('{"v":1,...}'), não uma chave: adotá-la faria
   a plataforma sair chamando a Groq com um JSON no lugar do segredo. */
const GROQ_KEY_LEGADO_CIFRADO = 'df_groq_key_enc';

/** Espelha a chave Groq canônica para todas as ferramentas. Se o app principal
 *  ainda não tiver chave, adota a de uma ferramenta (migração suave). */
function syncGroqKey() {
  let key = (State.apiKeys && State.apiKeys.groq) ? String(State.apiKeys.groq).trim() : '';

  // Workspace bloqueado: NÃO gravamos espelhos em claro no localStorage. A chave
  // (já em memória após o desbloqueio) vai às ferramentas só via a ponte
  // postMessage (pushConfigToTools), que carrega o flag `locked`.
  if (State.locked) return;

  // Migração suave: app principal sem chave → adota a de uma ferramenta já configurada.
  if (!key) {
    key = (localStorage.getItem(GROQ_KEY_SLOTS.replicador) ||
           GROQ_KEY_SLOTS_LEGADO.map((k) => localStorage.getItem(k)).find(Boolean) || '').trim();
    if (key) {
      State.apiKeys.groq = key;
      saveJSON(STORAGE_KEYS.apiKeys, State.apiKeys);
    }
  }

  // Espelha a chave canônica para as ferramentas (só quando há uma chave).
  if (key) {
    if (localStorage.getItem(GROQ_KEY_SLOTS.replicador) !== key) {
      localStorage.setItem(GROQ_KEY_SLOTS.replicador, key);
    }
  }
}

/** Modelo Groq unificado: espelha o modelo escolhido no app (State.models.groq)
 *  para os slots que as ferramentas leem. Hoje nenhuma ferramenta embutida lê
 *  modelo do localStorage — o Replicador recebe pela ponte postMessage —, então
 *  a função só normaliza o modelo do app contra o catálogo. Os nomes antigos
 *  ('groq_model', 'df_model') ficam na lista de limpeza, não na de escrita. */
const GROQ_MODEL_SLOTS_LEGADO = ['groq_model', 'df_model'];

function syncGroqModel() {
  let model = (State.models && State.models.groq) ? String(State.models.groq).trim() : '';
  // Se o modelo salvo não existir no catálogo atual, volta ao padrão (evita ID inválido
  // após o alinhamento dos catálogos entre as ferramentas).
  const validIds = (typeof PROVIDER_MODELS !== 'undefined' && PROVIDER_MODELS.groq)
    ? PROVIDER_MODELS.groq.map((m) => m.id) : [];
  if (validIds.length && !validIds.includes(model)) {
    model = validIds[0];
    if (State.models) { State.models.groq = model; saveJSON(STORAGE_KEYS.models, State.models); }
  }
}

/** Remover a chave no app principal remove também dos espelhos das ferramentas
 *  (sem isso, o boot readotaria a chave antiga). Varre também os espelhos das
 *  ferramentas removidas — senão a chave apagada continuaria no aparelho, e a
 *  migração suave a readotaria no boot seguinte.
 *
 *  A versão CIFRADA do Detector ('df_groq_key_enc') era preservada aqui: era
 *  uma escolha local do usuário DENTRO daquela ferramenta, e o app não passava
 *  por cima dela. Sem a ferramenta, não há escolha a respeitar nem quem leia —
 *  é uma cópia ilegível de uma chave que o usuário acabou de mandar apagar. Vai
 *  junto. */
function clearGroqMirrors() {
  localStorage.removeItem(GROQ_KEY_SLOTS.replicador);
  GROQ_KEY_SLOTS_LEGADO.forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem(GROQ_KEY_LEGADO_CIFRADO);
  GROQ_MODEL_SLOTS_LEGADO.forEach((k) => localStorage.removeItem(k));
}

/** Configuração Groq canônica (chave + modelo) — fonte única para TODAS as ferramentas. */
function currentGroqConfig() {
  return {
    groqKey: (State.apiKeys && State.apiKeys.groq) ? String(State.apiKeys.groq) : '',
    groqModel: (State.models && State.models.groq) ? String(State.models.groq) : '',
    // Em modo bloqueado, as ferramentas mantêm a chave SÓ em memória (não persistem).
    locked: !!State.locked,
  };
}

/* ===== Segurança do canal postMessage =====
   A config (inclui a CHAVE de API) e os demais comandos só podem trafegar
   entre o app e os IFRAMES DAS NOSSAS FERRAMENTAS — nunca com janelas
   arbitrárias que consigam nos enviar mensagens. */
const TOOL_FRAME_SELECTORS = ['#replicadorFrame', '#removedorFrame'];

/** A mensagem veio de um dos iframes de ferramenta da plataforma? */
function isToolFrameSource(e) {
  if (!e || !e.source) return false;
  return TOOL_FRAME_SELECTORS.some((sel) => {
    const f = $(sel);
    try { return !!(f && f.contentWindow && f.contentWindow === e.source); }
    catch (_) { return false; }
  });
}

/** targetOrigin para postMessage: em file:// a origem é opaca ('null') e só
 *  '*' funciona; hospedado (ex.: GitHub Pages), restringe à própria origem. */
function toolTargetOrigin() {
  return location.protocol === 'file:' ? '*' : location.origin;
}

/** Injeta a config AO VIVO no iframe de uma ferramenta (mesma origem): define
 *  window.__AGENTE_CONFIG__ e dispara o evento 'agente:config' para a ferramenta
 *  reagir na hora — SEM recarregar o iframe (preserva o trabalho em andamento). */
function injectConfigInto(f) {
  if (!f) return;
  try {
    if (f.contentWindow) {
      // postMessage funciona ENTRE file:// também (acesso direto ao iframe é bloqueado lá).
      f.contentWindow.postMessage(Object.assign({ type: 'agente:config' }, currentGroqConfig()), toolTargetOrigin());
    }
  } catch (e) { /* */ }
}

// Handshake: cada ferramenta, ao carregar, pede a config (postMessage); respondemos
// com a config atual. Funciona em file:// e em servidor.
// SEGURANÇA: a resposta contém a CHAVE de API — só respondemos aos iframes das
// nossas ferramentas (qualquer outra janela é ignorada).
if (typeof window !== 'undefined') {
  window.addEventListener('message', function (e) {
    if (e && e.data && e.data.type === 'agente:config-request' && isToolFrameSource(e)) {
      try {
        e.source.postMessage(Object.assign({ type: 'agente:config' }, currentGroqConfig()), toolTargetOrigin());
      } catch (_) { /* */ }
    }
  });
}

/** Propaga a config para TODAS as ferramentas já carregadas, ao vivo. */
function pushConfigToTools() {
  ['#replicadorFrame'].forEach((sel) => {
    const f = $(sel);
    if (f && f.dataset.loaded) injectConfigInto(f);
  });
}
