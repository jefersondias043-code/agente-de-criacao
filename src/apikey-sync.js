'use strict';
/* ============================================================
   CHAVE GROQ UNIFICADA
   O app principal (Configurações → Groq) é a fonte única da chave.
   Como tudo roda na mesma origem, as ferramentas embutidas leem o MESMO
   localStorage — só com nomes de chave diferentes. Esta camada espelha a
   chave canônica (State.apiKeys.groq) para esses nomes, SEM editar as
   ferramentas:
     - AutoPost IA   → 'groq_api_key'
     - Detector Flop → 'df_groq_key'  (texto; o Detector só usa essa quando
                                       NÃO há versão cifrada 'df_groq_key_enc')
   ============================================================ */
const GROQ_KEY_SLOTS = {
  autopost: 'groq_api_key',
  detector: 'df_groq_key',
  detectorEnc: 'df_groq_key_enc',
  replicador: 'replicador_groq_api_key',
};

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
    key = (localStorage.getItem(GROQ_KEY_SLOTS.autopost) ||
           localStorage.getItem(GROQ_KEY_SLOTS.detector) ||
           localStorage.getItem(GROQ_KEY_SLOTS.replicador) || '').trim();
    if (key) {
      State.apiKeys.groq = key;
      saveJSON(STORAGE_KEYS.apiKeys, State.apiKeys);
    }
  }

  // Espelha a chave canônica para as ferramentas (só quando há uma chave).
  if (key) {
    if (localStorage.getItem(GROQ_KEY_SLOTS.autopost) !== key) {
      localStorage.setItem(GROQ_KEY_SLOTS.autopost, key);
    }
    // O Detector só lê a versão em texto quando não há versão cifrada salva.
    if (!localStorage.getItem(GROQ_KEY_SLOTS.detectorEnc) &&
        localStorage.getItem(GROQ_KEY_SLOTS.detector) !== key) {
      localStorage.setItem(GROQ_KEY_SLOTS.detector, key);
    }
    if (localStorage.getItem(GROQ_KEY_SLOTS.replicador) !== key) {
      localStorage.setItem(GROQ_KEY_SLOTS.replicador, key);
    }
  }
}

/** Modelo Groq unificado: espelha o modelo escolhido no app (State.models.groq)
 *  para os slots que as ferramentas leem. AutoPost lê 'groq_model'; o Detector lê
 *  'df_model' (na hora da chamada). Todas usam o mesmo endpoint de chat da Groq,
 *  então o mesmo ID de modelo serve para todas. */
const GROQ_MODEL_SLOTS = { autopost: 'groq_model', detector: 'df_model' };

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
  if (!model) return;
  if (localStorage.getItem(GROQ_MODEL_SLOTS.autopost) !== model) {
    localStorage.setItem(GROQ_MODEL_SLOTS.autopost, model);
  }
  if (localStorage.getItem(GROQ_MODEL_SLOTS.detector) !== model) {
    localStorage.setItem(GROQ_MODEL_SLOTS.detector, model);
  }
}

/** Remover a chave no app principal remove também dos espelhos das ferramentas
 *  (sem isso, o boot readotaria a chave antiga). Não toca na versão cifrada do
 *  Detector — isso é uma escolha local explícita do usuário lá. */
function clearGroqMirrors() {
  localStorage.removeItem(GROQ_KEY_SLOTS.autopost);
  localStorage.removeItem(GROQ_KEY_SLOTS.replicador);
  if (!localStorage.getItem(GROQ_KEY_SLOTS.detectorEnc)) {
    localStorage.removeItem(GROQ_KEY_SLOTS.detector);
  }
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
const TOOL_FRAME_SELECTORS = ['#detectorFrame', '#autopostFrame', '#replicadorFrame', '#videograbFrame', '#removedorFrame'];

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
  ['#detectorFrame', '#autopostFrame', '#replicadorFrame'].forEach((sel) => {
    const f = $(sel);
    if (f && f.dataset.loaded) injectConfigInto(f);
  });
}
