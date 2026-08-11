'use strict';
/* ============================================================
   STORAGE — persistência, medição de uso e BACKUP do workspace
   Carregado logo após core.js (usa toast/formatBytes/$ de lá).
   - loadJSON/saveJSON (core.js) seguem como a fonte SÍNCRONA do app — nada
     aqui muda o caminho quente de leitura/escrita das ferramentas.
   - Adiciona: medição de uso do localStorage + alerta proativo de cota;
     EXPORTAR/IMPORTAR todo o estado local (app pai + ferramentas embutidas)
     num único arquivo JSON; e helpers IndexedDB prontos para blobs grandes
     (substrato para evolução futura — não altera o comportamento atual).
   Privacidade: nada sai do navegador, exceto quando o usuário baixa o backup.
   ============================================================ */

const WORKSPACE_EXPORT_VERSION = 2;
// Prefixos de chaves que pertencem à plataforma (app pai + embutidos).
// 'rv_' = histórico do AutoPost (chave herdada 'rv_historico').
/* 'df_', 'groq_', 'autopost' e 'rv_' são do Detector Flop e do AutoPost IA, que
 * saíram no r227. Continuam aqui de propósito: é o que faz a exportação levar e
 * o bloqueio do workspace proteger o que essas ferramentas deixaram guardado. */
const WORKSPACE_KEY_PREFIXES = ['agp.', 'df_', 'groq_', 'replicador_', 'autopost', 'rv_'];

// Chaves de API em TEXTO PURO — o único segredo do workspace. No backup
// protegido por senha, estas são extraídas do bloco legível e cifradas à parte
// (AES-GCM via crypto.js), para que o arquivo exportado NUNCA carregue a chave
// em claro. 'df_groq_key_enc' já é cifrada pelo Detector → fica no bloco normal.
const WORKSPACE_SECRET_KEYS = ['agp.apiKeys', 'agp.apiKey', 'groq_api_key', 'df_groq_key', 'replicador_groq_api_key'];

function isWorkspaceKey(k) {
  return typeof k === 'string' && WORKSPACE_KEY_PREFIXES.some((p) => k.startsWith(p));
}

/** Coleta todas as chaves do workspace no localStorage como objeto simples. */
function collectWorkspace() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (isWorkspaceKey(k)) data[k] = localStorage.getItem(k);
  }
  return data;
}

/** Uso aproximado do localStorage em bytes (UTF-16 → ~2 bytes/char). */
function storageUsageBytes() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const v = localStorage.getItem(k) || '';
    total += (k.length + v.length) * 2;
  }
  return total;
}


/* ===== Conversão dataURL ↔ Blob =====
   As imagens são guardadas no IndexedDB como Blob (binário) em vez de base64 —
   ~⅓ menor em disco/memória, MESMA funcionalidade. O caminho quente (State,
   render, export, upload) continua usando dataURL; a conversão só acontece na
   fronteira do IDB (gravação/hidratação) e no backup (que precisa de string). */
function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  let bytes;
  if (m[2]) { // base64
    const bin = atob(m[3]);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(m[3]));
  }
  return new Blob([bytes], { type: mime });
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error || new Error('Falha ao ler o Blob'));
    r.readAsDataURL(blob);
  });
}

/** Exporta o workspace inteiro como arquivo .json (download local). Inclui as
 *  imagens guardadas no IndexedDB (cartazes/carrosséis) → backup completo.
 *  Se `password` for informada, as chaves de API são cifradas à parte (o arquivo
 *  não contém nenhuma chave em texto puro). */
async function exportWorkspace(password) {
  if (typeof toast === 'function') toast('Preparando backup…', 'info', 2000);
  let idbData = {};
  try { idbData = await idbGetAll(); } catch (_) { idbData = {}; }
  // Imagens vêm como Blob do IDB; no backup viram dataURL (JSON-serializável).
  try {
    for (const k of Object.keys(idbData)) {
      if (typeof Blob !== 'undefined' && idbData[k] instanceof Blob) idbData[k] = await blobToDataUrl(idbData[k]);
    }
  } catch (_) { /* */ }
  const data = collectWorkspace();
  let secrets = null;
  if (password && typeof cryptoEncryptString === 'function') {
    const subset = {};
    WORKSPACE_SECRET_KEYS.forEach((k) => { if (k in data) { subset[k] = data[k]; delete data[k]; } });
    if (Object.keys(subset).length) {
      try { secrets = await cryptoEncryptString(JSON.stringify(subset), password); }
      catch (_) { /* sem cripto → cai no backup simples (subset já foi removido; recoloca) */
        WORKSPACE_SECRET_KEYS.forEach((k) => { if (k in subset) data[k] = subset[k]; });
        secrets = null;
      }
    }
  }
  const payload = {
    app: 'agente-de-conteudo',
    version: WORKSPACE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    idbData,
    encrypted: !!secrets,
    secrets,
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `agente-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (typeof toast === 'function') toast('Backup exportado.', 'success');
}

/** Restaura o workspace de um objeto exportado. mode: 'merge' (default) | 'replace'.
 *  Por segurança, só grava chaves reconhecidas como da plataforma. Restaura
 *  também as imagens (idbData) no IndexedDB. */
async function importWorkspaceData(payload, mode, password) {
  if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
    throw new Error('Arquivo de backup inválido.');
  }
  // Backup protegido: decifra as chaves de API e devolve ao bloco de dados.
  if (payload.secrets) {
    if (!password) throw new Error('Este backup está protegido por senha.');
    if (typeof cryptoDecryptString !== 'function') throw new Error('Cripto indisponível neste navegador.');
    let subset;
    try { subset = JSON.parse(await cryptoDecryptString(payload.secrets, password)); }
    catch (_) { throw new Error('Senha incorreta — não foi possível abrir o backup.'); }
    Object.assign(payload.data, subset);
  }
  if (mode === 'replace') {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (isWorkspaceKey(k)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  }
  let count = 0;
  Object.keys(payload.data).forEach((k) => {
    if (!isWorkspaceKey(k)) return; // só restaura chaves da plataforma
    try { localStorage.setItem(k, String(payload.data[k])); count++; } catch (e) { /* cota */ }
  });
  // Imagens (cartazes/carrosséis) de volta ao IndexedDB. As imagens (chaves
  // 'pimg:') voltam como Blob; os corpos de texto ('gen:'/'ext:') ficam string.
  if (payload.idbData && typeof payload.idbData === 'object') {
    for (const k of Object.keys(payload.idbData)) {
      let val = payload.idbData[k];
      if (k.startsWith('pimg:') && typeof val === 'string' && val.startsWith('data:')) {
        const b = dataUrlToBlob(val); if (b) val = b;
      }
      try { await idbSet(k, val); count++; } catch (_) { /* */ }
    }
  }
  return count;
}

/** Lê um File JSON e restaura. Retorna Promise<número de chaves restauradas>. */
function importWorkspaceFromFile(file, mode) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      let payload;
      try { payload = JSON.parse(String(r.result || '{}')); }
      catch (e) { reject(new Error('Falha ao ler o backup.')); return; }
      let password = null;
      if (payload && payload.secrets) {
        password = (typeof prompt === 'function') ? prompt('Este backup está protegido. Digite a senha:') : null;
        if (!password) { reject(new Error('Senha necessária para restaurar este backup.')); return; }
      }
      importWorkspaceData(payload, mode, password).then(resolve).catch(reject);
    };
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    r.readAsText(file);
  });
}

/** Liga a UI de "Dados e backup" nas Configurações (chamado por renderSettings).
 *  O medidor inclui o uso do IndexedDB (imagens) além do localStorage. */
function wireStorageUI() {
  const pctEl = $('#s-storage-pct');
  const barEl = $('#s-storage-bar');
  const detailEl = $('#s-storage-detail');
  const breakEl = $('#s-storage-breakdown');
  if (pctEl && barEl && detailEl) {
    // O medidor reflete a cota REAL do dispositivo (IDB + localStorage), não mais
    // o teto de ~5 MB do localStorage. Fallback p/ navegadores sem a API estimate.
    Promise.all([deviceStorageInfo(), idbUsageBytes()]).then(([dev, idbBytes]) => {
      const lsUsed = storageUsageBytes();
      if (dev && dev.quota) {
        const pct = dev.pct;
        pctEl.textContent = pct + '%';
        barEl.style.width = pct + '%';
        barEl.style.background = pct >= 90 ? 'var(--accent)' : pct >= 70 ? 'var(--gold)' : 'var(--green)';
        detailEl.textContent = `${formatBytes(dev.usage)} usados de ~${formatBytes(dev.quota)} disponíveis no dispositivo · históricos no IndexedDB`;
      } else {
        // Sem estimate(): mostra o uso bruto, sem fingir um limite artificial.
        const totalUsed = lsUsed + idbBytes;
        pctEl.textContent = formatBytes(totalUsed);
        barEl.style.width = '8%';
        barEl.style.background = 'var(--green)';
        detailEl.textContent = `${formatBytes(totalUsed)} usados · históricos no IndexedDB (limitado pela capacidade do dispositivo)`;
      }
    });
  }
  if (breakEl) {
    storageBreakdown().then((rows) => {
      if (!rows.length) { breakEl.innerHTML = ''; return; }
      const max = rows[0].bytes || 1;
      breakEl.innerHTML = rows.map((r) => `
        <div class="flex items-center gap-2" style="margin-top:0.35rem;">
          <span class="text-xs" style="flex:0 0 9.5rem; color:var(--ink-soft);">${escapeHtml(r.label)}</span>
          <span style="flex:1; height:5px; background:var(--line-soft); border-radius:3px; overflow:hidden;">
            <span style="display:block; height:100%; width:${Math.max(3, Math.round((r.bytes / max) * 100))}%; background:var(--gold);"></span>
          </span>
          <span class="text-xs mono text-mute" style="flex:0 0 auto;">${formatBytes(r.bytes)}</span>
        </div>`).join('');
    });
  }
  const exp = $('#s-export');
  if (exp) exp.onclick = () => {
    // Há alguma chave de API salva? Então oferece proteger o backup com senha.
    const hasSecret = WORKSPACE_SECRET_KEYS.some((k) => {
      const v = localStorage.getItem(k);
      return v && v !== '{}' && v !== '{"groq":"","openai":"","anthropic":""}';
    });
    let password = null;
    if (hasSecret && typeof cryptoAvailable === 'function' && cryptoAvailable()) {
      if (confirm('Proteger as chaves de API do backup com senha? (Recomendado — sem isso, as chaves vão em texto puro no arquivo.)')) {
        password = prompt('Crie uma senha para o backup (mín. 6 caracteres):');
        if (password && password.length < 6) { toast('Senha muito curta — exportando sem proteção.', 'error'); password = null; }
      }
    }
    exportWorkspace(password);
  };
  const impBtn = $('#s-import-btn');
  const impFile = $('#s-import-file');
  if (impBtn && impFile) {
    impBtn.onclick = () => impFile.click();
    impFile.onchange = () => {
      const f = impFile.files && impFile.files[0];
      if (!f) return;
      if (!confirm('Importar este backup? As entradas do arquivo serão restauradas e sobrescrevem chaves de mesmo nome. A página será recarregada ao final.')) { impFile.value = ''; return; }
      importWorkspaceFromFile(f, 'merge')
        .then((n) => { toast(`${n} itens restaurados. Recarregando…`, 'success'); setTimeout(() => location.reload(), 1200); })
        .catch((e) => toast((e && e.message) || 'Falha ao importar o backup.', 'error', 6000));
      impFile.value = '';
    };
  }
  // "Reiniciar plataforma" — apaga TUDO (localStorage + IndexedDB) e volta ao zero.
  const resetBtn = $('#s-reset-all');
  if (resetBtn) resetBtn.onclick = async () => {
    if (!confirm('Apagar TODOS os dados da plataforma e reiniciar?\n\nIsso remove históricos de todas as ferramentas, memórias, cartazes, configurações e chaves de API. Não pode ser desfeito.')) return;
    const typed = prompt('Esta ação é irreversível. Digite REINICIAR para confirmar:');
    if (typed == null) return;
    if (typed.trim().toUpperCase() !== 'REINICIAR') { if (typeof toast === 'function') toast('Confirmação incorreta — nada foi apagado.', 'info'); return; }
    try { await wipeAllPlatformData(); } catch (_) { /* */ }
    if (typeof toast === 'function') toast('Plataforma reiniciada. Recarregando…', 'success');
    setTimeout(() => location.reload(), 1000);
  };
  if (typeof wireLockUI === 'function') wireLockUI();
}

/** Limpeza GLOBAL: apaga todos os dados persistentes do app — localStorage
 *  (config, chaves, presets) E o IndexedDB inteiro (TODOS os históricos: nativos
 *  e das ferramentas embutidas, imagens, corpos legados). Restaura ao estado
 *  inicial. Em http (mesma origem) cobre também as embutidas, que gravam no mesmo
 *  store 'agente-store'. */
async function wipeAllPlatformData() {
  try { localStorage.clear(); } catch (_) { /* */ }
  try { if (typeof sessionStorage !== 'undefined') sessionStorage.clear(); } catch (_) { /* */ }
  // Esvazia o store do IndexedDB (hist:*, pimg:, gen:/ext: e tudo mais).
  try {
    const db = await idbOpen();
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { try { db.close(); } catch (_) { /* */ } resolve(); };
    });
  } catch (_) { /* */ }
}

/** Liga a UI de "Proteção das chaves" (bloqueio do workspace). Aditivo e opt-in. */
function wireLockUI() {
  const statusEl = $('#s-lock-status');
  const btnEnable = $('#s-lock-enable');
  const btnDisable = $('#s-lock-disable');
  const btnUnlock = $('#s-lock-unlock');
  const btnForgot = $('#s-lock-forgot');
  if (!btnEnable) return;
  const locked = typeof isWorkspaceLocked === 'function' && isWorkspaceLocked();
  const unlocked = !!(State && State.unlocked);
  const cryptoOk = typeof cryptoAvailable === 'function' && cryptoAvailable();

  if (statusEl) statusEl.textContent = !locked ? 'Sem proteção' : (unlocked ? 'Protegido' : 'Bloqueado');
  const show = (el, on) => { if (el) el.classList.toggle('hidden', !on); };
  show(btnEnable, !locked);
  show(btnDisable, locked && unlocked);
  show(btnUnlock, locked && !unlocked);
  show(btnForgot, locked && !unlocked);
  if (!cryptoOk) { btnEnable.disabled = true; btnEnable.title = 'Cripto indisponível neste navegador.'; }

  const reRender = () => { if (typeof renderSettings === 'function') renderSettings(); };

  btnEnable.onclick = async () => {
    const p1 = prompt('Crie uma senha para proteger suas chaves (mín. 6 caracteres):');
    if (!p1) return;
    if (p1.length < 6) { toast('Senha muito curta (mín. 6).', 'error'); return; }
    const p2 = prompt('Confirme a senha:');
    if (p2 !== p1) { toast('As senhas não conferem.', 'error'); return; }
    try { await lockWorkspace(p1); toast('Chaves protegidas com senha.', 'success'); reRender(); }
    catch (e) { toast((e && e.message) || 'Não foi possível proteger as chaves.', 'error'); }
  };
  if (btnDisable) btnDisable.onclick = async () => {
    if (!confirm('Remover a proteção? As chaves voltarão a ficar em texto puro neste navegador.')) return;
    try { await disableWorkspaceLock(State._lockPass); toast('Proteção removida.', 'success'); reRender(); }
    catch (e) { toast((e && e.message) || 'Não foi possível remover a proteção.', 'error'); }
  };
  if (btnUnlock) btnUnlock.onclick = async () => {
    const pass = prompt('Digite a senha para desbloquear as chaves:');
    if (!pass) return;
    try { await unlockWorkspace(pass); State._lockPass = pass; toast('Workspace desbloqueado.', 'success'); reRender(); }
    catch (e) { toast((e && e.message) || 'Senha incorreta.', 'error'); }
  };
  if (btnForgot) btnForgot.onclick = () => {
    if (!confirm('Esqueceu a senha? As chaves cifradas serão apagadas e você reconfigura nas Configurações. Continuar?')) return;
    if (typeof forgotWorkspacePassword === 'function') forgotWorkspacePassword();
    toast('Chaves apagadas. Reconfigure nas Configurações.', 'success');
    reRender();
  };
}

/* ===== IndexedDB (substrato p/ blobs grandes — pronto, sem alterar o app) ===== */
const IDB_NAME = 'agente-store';
const IDB_STORE = 'kv';
function idbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponível')); return; }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Falha ao abrir IndexedDB'));
  });
}
async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
async function idbDel(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
/** Lê TODO o store IndexedDB como objeto { chave: valor }. */
async function idbGetAll() {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const out = {};
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) { out[cur.key] = cur.value; cur.continue(); }
      else { db.close(); resolve(out); }
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
/** Soma aproximada (bytes) das imagens guardadas no IndexedDB. */
async function idbUsageBytes() {
  try {
    const all = await idbGetAll();
    let total = 0;
    Object.keys(all).forEach((k) => {
      const v = all[k];
      if (typeof Blob !== 'undefined' && v instanceof Blob) total += v.size + k.length * 2;
      else total += (k.length + (typeof v === 'string' ? v.length : 0)) * 2;
    });
    return total;
  } catch (_) { return 0; }
}

/* ============================================================
   HISTÓRICOS NO INDEXEDDB — arquitetura escalável (limite = DISPOSITIVO)
   Os históricos (matérias geradas, extrações, cartazes) deixam de viver no
   localStorage (~5 MB, o gargalo) e passam a ser persistidos no IndexedDB, cujo
   teto é a capacidade REAL do disco do usuário (centenas de MB a vários GB).
   • A fonte SÍNCRONA da renderização continua sendo o array em memória (State.*);
     nada muda no caminho quente de leitura das ferramentas.
   • A gravação é assíncrona (IDB). Cada save persiste o array inteiro sob uma
     única chave ('hist:*') — simples e robusto para centenas/milhares de itens.
   • Boot: hydrateHistories() carrega do IDB e, na primeira vez, MIGRA o que ainda
     estiver no localStorage antigo (resolvendo as sentinelas '@idb:' do formato
     anterior) e remove a chave legada — sem perda de dados.
   • A mensagem de "cheio" só aparece no limite REAL do dispositivo (erro de cota
     do IDB), nunca mais por um teto artificial de 5 MB.
   O backup já leva esses arrays via idbData (idbGetAll). */
const HIST_KEYS = { generations: 'hist:generations', extractions: 'hist:extractions', posters: 'hist:posters' };

function _onHistSaveError(e, what) {
  const quota = !!e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota|exceeded/i.test((e && e.message) || ''));
  if (typeof toast === 'function') {
    toast(quota
      ? `Armazenamento do dispositivo cheio: a ${what} pode não ter sido salva. Exporte um backup e remova itens antigos do histórico.`
      : `Não foi possível salvar a ${what} neste navegador.`, 'error', 8000);
  }
}

function saveGenerations() {
  if (typeof idbSet !== 'function') return Promise.resolve();
  // Persiste o array inteiro no IDB (corpos inclusos). State já está atualizado.
  return idbSet(HIST_KEYS.generations, State.generations || []).catch((e) => _onHistSaveError(e, 'matéria'));
}
function saveExtractions() {
  if (typeof idbSet !== 'function') return Promise.resolve();
  return idbSet(HIST_KEYS.extractions, State.extractions || []).catch((e) => _onHistSaveError(e, 'extração'));
}

/** Resolve sentinelas "@idb:<chave>" (formato legado do offload de corpos) →
 *  texto real, lido do IDB. Usado apenas na migração do localStorage antigo. */
async function _resolveTextSentinels(arr, field) {
  for (const item of (arr || [])) {
    const v = item && item[field];
    if (typeof v === 'string' && v.startsWith('@idb:')) {
      try { const d = await idbGet(v.slice(5)); item[field] = (d != null) ? d : ''; }
      catch (_) { item[field] = ''; }
    }
  }
}

/** Boot: carrega matérias/extrações do IndexedDB. Migra do localStorage antigo
 *  (uma única vez) e limpa a chave legada. Re-renderiza a view atual se for um
 *  histórico (os dados chegam de forma assíncrona após o render inicial). */
async function hydrateHistories() {
  if (typeof idbGet !== 'function' || typeof idbSet !== 'function') return;
  const load = async (field, histKey, lsKey, textField) => {
    let arr = null;
    try { arr = await idbGet(histKey); } catch (_) { arr = null; }
    if (Array.isArray(arr)) {
      State[field] = arr;                                   // já no IDB (formato novo)
    } else if (Array.isArray(State[field]) && State[field].length) {
      // Migração: o array veio do localStorage no init. Resolve corpos e move p/ IDB.
      await _resolveTextSentinels(State[field], textField);
      try { await idbSet(histKey, State[field]); }
      catch (_) { return; }                                 // gravação falhou → mantém no LS (sem perda)
    }
    // O IDB é a fonte da verdade — remove a chave legada do localStorage (até vazia).
    try { localStorage.removeItem(lsKey); } catch (_) { /* */ }
  };
  await load('generations', HIST_KEYS.generations, STORAGE_KEYS.generations, 'content');
  await load('extractions', HIST_KEYS.extractions, STORAGE_KEYS.extractions, 'text');
  if (State.currentView === 'generate' && typeof renderGenerate === 'function') renderGenerate();
  else if (State.currentView === 'extract' && typeof renderExtract === 'function') renderExtract();
  // Assíncrono, roda em paralelo ao boot — goTo('welcome') já pintou a home
  // ANTES dos arrays chegarem do IDB. Sem isto, a home mostraria "nada por
  // aqui" até a próxima navegação, mesmo com matérias/extrações reais.
  else if (State.currentView === 'welcome' && typeof renderHome === 'function') renderHome();
}

/** Uso por categoria (ferramenta), somando localStorage + imagens no IDB. */
async function storageBreakdown() {
  const cats = [
    { label: 'Cartazes e carrosséis', prefixes: ['agp.posters'], idb: true },
    { label: 'Matérias geradas', prefixes: ['agp.generations'] },
    { label: 'Narrativa', prefixes: ['agp.narrativas', 'agp.narrativa.'] },
    { label: 'Extrações de texto', prefixes: ['agp.extractions'] },
    /* As duas ferramentas saíram da plataforma no r227, mas os dados que elas
     * deixaram continuam no aparelho de quem já as usava — e continuam ocupando
     * cota. As linhas ficam, com o rótulo dizendo a verdade: some quem não tem
     * nada guardado (o filtro `bytes > 0` no fim), e quem tem passa a ver o que
     * é. Apagar as linhas esconderia o espaço em vez de liberá-lo. */
    { label: 'Detector Flop (removido)', prefixes: ['df_'] },
    { label: 'AutoPost IA (removido)', prefixes: ['rv_'] },
    { label: 'Replicador', prefixes: ['replicador_'] },
    { label: 'Configurações', prefixes: ['agp.apiKeys', 'agp.models', 'agp.provider', 'agp.portals', 'groq_'] },
  ];
  const sizeOf = (k) => { const v = localStorage.getItem(k) || ''; return (k.length + v.length) * 2; };
  const rows = cats.map((c) => {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && c.prefixes.some((p) => k.startsWith(p))) bytes += sizeOf(k);
    }
    return { label: c.label, bytes, idb: !!c.idb };
  });
  // Distribui o uso do IDB por chave: hist:* são os históricos (nativos e das
  // ferramentas embutidas); pimg: imagens de cartaz; gen:/ext: corpos legados.
  const idb = { cart: 0, gen: 0, ext: 0, det: 0, ap: 0, rep: 0 };
  const sizeOfVal = (k, v) => (typeof Blob !== 'undefined' && v instanceof Blob)
    ? v.size + k.length * 2
    : (k.length + (typeof v === 'string' ? v.length : JSON.stringify(v || '').length)) * 2;
  try {
    const all = await idbGetAll();
    for (const k of Object.keys(all)) {
      const b = sizeOfVal(k, all[k]);
      if (k === 'hist:generations' || k.startsWith('gen:')) idb.gen += b;
      else if (k === 'hist:extractions' || k.startsWith('ext:')) idb.ext += b;
      else if (k === 'hist:autopost') idb.ap += b;
      else if (k === 'hist:replicador') idb.rep += b;
      else if (k.startsWith('hist:detector')) idb.det += b;
      else idb.cart += b; // hist:posters, pimg:* e quaisquer outras
    }
  } catch (_) { /* */ }
  const addTo = (label, bytes) => { const r = rows.find((x) => x.label === label); if (r) r.bytes += bytes; };
  addTo('Cartazes e carrosséis', idb.cart);
  addTo('Matérias geradas', idb.gen);
  addTo('Extrações de texto', idb.ext);
  addTo('Detector Flop (removido)', idb.det);
  addTo('AutoPost IA (removido)', idb.ap);
  addTo('Replicador', idb.rep);
  return rows.filter((r) => r.bytes > 0).sort((a, b) => b.bytes - a.bytes);
}

/** Uso real do armazenamento do app (IndexedDB + localStorage) vs. a cota do
 *  DISPOSITIVO, via navigator.storage.estimate(). É essa a métrica que importa
 *  agora que os históricos vivem no IDB. Retorna null se a API não existir. */
async function deviceStorageInfo() {
  try {
    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
      const est = await navigator.storage.estimate();
      const usage = est.usage || 0;
      const quota = est.quota || 0;
      return { usage, quota, pct: quota ? Math.min(100, Math.round((usage / quota) * 100)) : 0 };
    }
  } catch (_) { /* */ }
  return null;
}

// Pede armazenamento PERSISTENTE: o navegador não despeja os dados sob pressão de
// disco — os históricos ficam confiáveis a longo prazo. Silencioso, opt-in do SO.
(function () {
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      navigator.storage.persisted().then((already) => { if (!already) navigator.storage.persist().catch(() => {}); }).catch(() => {});
    }
  } catch (_) { /* */ }
})();

// Aviso proativo: só quando o DISPOSITIVO está de fato quase cheio (>90% da cota
// real). Nunca mais dispara por um teto artificial de 5 MB. (1 toast no boot.)
(async function () {
  try {
    const info = await deviceStorageInfo();
    if (info && info.pct >= 90 && typeof toast === 'function') {
      setTimeout(() => toast(
        `Armazenamento do dispositivo quase cheio (${info.pct}%). Exporte um backup e remova itens antigos em Configurações → Dados e backup.`,
        'error', 8000), 1500);
    }
  } catch (_) { /* */ }
})();
