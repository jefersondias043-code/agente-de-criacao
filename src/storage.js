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

const WORKSPACE_EXPORT_VERSION = 1;
// Prefixos de chaves que pertencem à plataforma (app pai + embutidos).
const WORKSPACE_KEY_PREFIXES = ['agp.', 'df_', 'groq_', 'replicador_', 'autopost'];

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

// Referência conservadora do teto típico do localStorage (~5 MB).
const STORAGE_SOFT_CAP = 5 * 1024 * 1024;

function storageUsageInfo() {
  const used = storageUsageBytes();
  return { used, cap: STORAGE_SOFT_CAP, pct: Math.min(100, Math.round((used / STORAGE_SOFT_CAP) * 100)) };
}

/** Exporta o workspace inteiro como arquivo .json (download local). */
function exportWorkspace() {
  const payload = {
    app: 'agente-de-conteudo',
    version: WORKSPACE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: collectWorkspace(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
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
 *  Por segurança, só grava chaves reconhecidas como da plataforma. */
function importWorkspaceData(payload, mode) {
  if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
    throw new Error('Arquivo de backup inválido.');
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
  return count;
}

/** Lê um File JSON e restaura. Retorna Promise<número de chaves restauradas>. */
function importWorkspaceFromFile(file, mode) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try { resolve(importWorkspaceData(JSON.parse(String(r.result || '{}')), mode)); }
      catch (e) { reject(e instanceof Error ? e : new Error('Falha ao ler o backup.')); }
    };
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    r.readAsText(file);
  });
}

/** Liga a UI de "Dados e backup" nas Configurações (chamado por renderSettings). */
function wireStorageUI() {
  const pctEl = $('#s-storage-pct');
  const barEl = $('#s-storage-bar');
  const detailEl = $('#s-storage-detail');
  if (pctEl && barEl && detailEl) {
    const info = storageUsageInfo();
    pctEl.textContent = info.pct + '%';
    barEl.style.width = info.pct + '%';
    barEl.style.background = info.pct >= 80 ? 'var(--accent)' : info.pct >= 50 ? 'var(--gold)' : 'var(--green)';
    detailEl.textContent = `${formatBytes(info.used)} usados · referência ~${formatBytes(info.cap)}`;
  }
  const exp = $('#s-export');
  if (exp) exp.onclick = exportWorkspace;
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

// Aviso proativo: passou de 80% da referência → sugere backup/limpeza (1 toast).
(function () {
  try {
    const info = storageUsageInfo();
    if (info.pct >= 80 && typeof toast === 'function') {
      setTimeout(() => toast(
        `Armazenamento quase cheio (${info.pct}%). Exporte um backup em Configurações → Dados e backup.`,
        'error', 7000), 1500);
    }
  } catch (_) { /* */ }
})();
