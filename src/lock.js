'use strict';
/* ============================================================
   BLOQUEIO DO WORKSPACE (opcional) — chaves de API cifradas em repouso
   Proteção OPT-IN: por padrão nada muda (chaves em claro, espelhos como hoje).
   Quando ativado:
   - `agp.apiKeys` em claro é removido; `agp.apiKeys.enc` guarda o JSON das chaves
     cifrado (AES-GCM, via crypto.js). A senha NUNCA é salva.
   - As chaves reais só entram em `State.apiKeys` (memória) após o desbloqueio.
   - Os espelhos em claro das ferramentas não são gravados pelo app; a chave vai
     às embutidas só em memória, via a ponte postMessage (flag `locked`).
   Carregado após apikey-sync.js (usa State, crypto, sync*, pushConfigToTools).
   ============================================================ */

function isWorkspaceLocked() {
  return !!localStorage.getItem(STORAGE_KEYS.apiKeysEnc);
}

/** Ativa o bloqueio: cifra as chaves atuais e remove o texto puro + espelhos. */
async function lockWorkspace(password) {
  if (!password || password.length < 6) throw new Error('A senha precisa de ao menos 6 caracteres.');
  if (typeof cryptoEncryptString !== 'function') throw new Error('Cripto indisponível neste navegador.');
  const enc = await cryptoEncryptString(JSON.stringify(State.apiKeys || {}), password);
  localStorage.setItem(STORAGE_KEYS.apiKeysEnc, enc);
  try { localStorage.removeItem(STORAGE_KEYS.apiKeys); } catch (_) { /* */ }
  if (typeof clearGroqMirrors === 'function') clearGroqMirrors();
  State.locked = true;
  State.unlocked = true; // as chaves seguem em memória nesta sessão
  State._lockPass = password; // cache de sessão p/ re-encriptar ao salvar nova chave
  if (typeof pushConfigToTools === 'function') pushConfigToTools();
}

/** Desbloqueia (decifra para a memória). Lança se a senha estiver errada. */
async function unlockWorkspace(password) {
  const enc = localStorage.getItem(STORAGE_KEYS.apiKeysEnc);
  if (!enc) { State.locked = false; State.unlocked = true; return; }
  if (typeof cryptoDecryptString !== 'function') throw new Error('Cripto indisponível neste navegador.');
  let obj;
  try { obj = JSON.parse(await cryptoDecryptString(enc, password)); }
  catch (_) { throw new Error('Senha incorreta.'); }
  State.apiKeys = Object.assign({ groq: '', openai: '', anthropic: '' }, obj);
  State.locked = true;
  State.unlocked = true;
  // Propaga em MEMÓRIA para as ferramentas (sem gravar espelho em claro).
  if (typeof syncGroqKey === 'function') syncGroqKey();
  if (typeof syncGroqModel === 'function') syncGroqModel();
  if (typeof pushConfigToTools === 'function') pushConfigToTools();
}

/** Desativa o bloqueio: volta a gravar as chaves em claro (modo legado). */
async function disableWorkspaceLock(password) {
  if (!State.unlocked) await unlockWorkspace(password);
  saveJSON(STORAGE_KEYS.apiKeys, State.apiKeys);
  try { localStorage.removeItem(STORAGE_KEYS.apiKeysEnc); } catch (_) { /* */ }
  State.locked = false;
  State.unlocked = true;
  if (typeof syncGroqKey === 'function') syncGroqKey();     // reescreve os espelhos
  if (typeof pushConfigToTools === 'function') pushConfigToTools();
}

/** Recuperação: senha perdida → limpa as chaves cifradas e zera (reconfigurar). */
function forgotWorkspacePassword() {
  try { localStorage.removeItem(STORAGE_KEYS.apiKeysEnc); } catch (_) { /* */ }
  State.apiKeys = { groq: '', openai: '', anthropic: '' };
  State.locked = false;
  State.unlocked = true;
  saveJSON(STORAGE_KEYS.apiKeys, State.apiKeys);
  if (typeof clearGroqMirrors === 'function') clearGroqMirrors();
}

/** Salva as chaves respeitando o modo: cifrado (re-encripta) ou claro. */
async function persistApiKeys() {
  if (State.locked) {
    // Re-encripta com a mesma sessão. Precisamos da senha só na ativação; aqui,
    // como já estamos desbloqueados, regravamos exigindo a senha de novo seria
    // ruim de UX. Estratégia: manter a sessão e regravar via a senha em cache.
    if (State._lockPass) {
      const enc = await cryptoEncryptString(JSON.stringify(State.apiKeys || {}), State._lockPass);
      localStorage.setItem(STORAGE_KEYS.apiKeysEnc, enc);
    }
  } else {
    saveJSON(STORAGE_KEYS.apiKeys, State.apiKeys);
  }
}

/** Garante uma chave utilizável: se bloqueado e ainda não desbloqueado, pede a senha. */
async function ensureUnlocked() {
  if (!State.locked || State.unlocked) return true;
  const pass = (typeof prompt === 'function') ? prompt('Workspace protegido. Digite a senha para desbloquear as chaves:') : null;
  if (!pass) return false;
  try { await unlockWorkspace(pass); State._lockPass = pass; return true; }
  catch (e) { if (typeof toast === 'function') toast(e.message || 'Senha incorreta.', 'error'); return false; }
}
