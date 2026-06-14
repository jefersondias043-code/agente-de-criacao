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
const WORKSPACE_KEY_PREFIXES = ['agp.', 'df_', 'groq_', 'replicador_', 'autopost', 'rv_'];

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

/** Exporta o workspace inteiro como arquivo .json (download local). Inclui as
 *  imagens guardadas no IndexedDB (cartazes/carrosséis) → backup completo. */
async function exportWorkspace() {
  if (typeof toast === 'function') toast('Preparando backup…', 'info', 2000);
  let idbData = {};
  try { idbData = await idbGetAll(); } catch (_) { idbData = {}; }
  const payload = {
    app: 'agente-de-conteudo',
    version: WORKSPACE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: collectWorkspace(),
    idbData,
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
async function importWorkspaceData(payload, mode) {
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
  // Imagens (cartazes/carrosséis) de volta ao IndexedDB.
  if (payload.idbData && typeof payload.idbData === 'object') {
    for (const k of Object.keys(payload.idbData)) {
      try { await idbSet(k, payload.idbData[k]); count++; } catch (_) { /* */ }
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
      importWorkspaceData(payload, mode).then(resolve).catch(reject);
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
    idbUsageBytes().then((idbBytes) => {
      const lsUsed = storageUsageBytes();
      const totalUsed = lsUsed + idbBytes;
      // % é em relação ao localStorage (o gargalo real); IDB tem folga enorme.
      const lsPct = Math.min(100, Math.round((lsUsed / STORAGE_SOFT_CAP) * 100));
      pctEl.textContent = lsPct + '%';
      barEl.style.width = lsPct + '%';
      barEl.style.background = lsPct >= 80 ? 'var(--accent)' : lsPct >= 50 ? 'var(--gold)' : 'var(--green)';
      detailEl.textContent = idbBytes > 0
        ? `${formatBytes(lsUsed)} no navegador (limite ~${formatBytes(STORAGE_SOFT_CAP)}) · ${formatBytes(idbBytes)} em imagens (IndexedDB, sem limite prático)`
        : `${formatBytes(totalUsed)} usados · limite ~${formatBytes(STORAGE_SOFT_CAP)}`;
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
  if (exp) exp.onclick = () => { exportWorkspace(); };
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
    Object.keys(all).forEach((k) => { const v = all[k]; total += (k.length + (typeof v === 'string' ? v.length : 0)) * 2; });
    return total;
  } catch (_) { return 0; }
}

/** Uso por categoria (ferramenta), somando localStorage + imagens no IDB. */
async function storageBreakdown() {
  const cats = [
    { label: 'Cartazes e carrosséis', prefixes: ['agp.posters'], idb: true },
    { label: 'Matérias geradas', prefixes: ['agp.generations'] },
    { label: 'Extrações de texto', prefixes: ['agp.extractions'] },
    { label: 'Detector Flop', prefixes: ['df_'] },
    { label: 'AutoPost IA', prefixes: ['rv_'] },
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
  const idbBytes = await idbUsageBytes();
  const cartRow = rows.find((r) => r.idb);
  if (cartRow) cartRow.bytes += idbBytes;
  return rows.filter((r) => r.bytes > 0).sort((a, b) => b.bytes - a.bytes);
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
