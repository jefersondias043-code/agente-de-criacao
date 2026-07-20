'use strict';
/* ============================================================
   HISTÓRICO — biblioteca pessoal de pacotes gerados.

   Armazenado no INDEXEDDB (capacidade = dispositivo, não os ~5 MB
   do localStorage). Mesmo store da plataforma ('agente-store'/'kv',
   chave 'hist:autopost'): quando o app roda na MESMA origem da
   plataforma, o histórico é compartilhado e o backup da plataforma
   já o inclui. O array fica em memória (_histCache) como fonte
   SÍNCRONA do render; a gravação no IDB é assíncrona.
   histHydrate() carrega no boot e migra o rv_historico antigo 1x.
   ============================================================ */

const HIST_KEY = 'rv_historico';        // chave legada (localStorage) — migrada p/ IDB
const HIST_IDB_KEY = 'hist:autopost';   // histórico no IndexedDB (limite = dispositivo)

function _apIdbOpen() { return new Promise((res, rej) => { try { const r = indexedDB.open('agente-store', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); }
function _apIdbGet(k) { return _apIdbOpen().then((db) => new Promise((res, rej) => { const tx = db.transaction('kv', 'readonly'); const rq = tx.objectStore('kv').get(k); rq.onsuccess = () => { db.close(); res(rq.result); }; rq.onerror = () => { db.close(); rej(rq.error); }; })); }
function _apIdbSet(k, v) { return _apIdbOpen().then((db) => new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => { db.close(); res(true); }; tx.onerror = () => { db.close(); rej(tx.error); }; })); }

let _histCache = null;                   // array em memória (fonte síncrona do render)

function histLoad() {
  if (Array.isArray(_histCache)) return _histCache;
  // Antes da hidratação assíncrona: lê do localStorage (compat) sem quebrar o render.
  try {
    const raw = localStorage.getItem(HIST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}
function histSaveAll(arr) {
  _histCache = Array.isArray(arr) ? arr : [];
  if (typeof indexedDB !== 'undefined') {
    // Persiste no IndexedDB; só avisa em caso de cota REAL do dispositivo.
    _apIdbSet(HIST_IDB_KEY, _histCache)
      .then(() => { try { localStorage.removeItem(HIST_KEY); } catch (_) { /* */ } })
      .catch(() => alert('Não foi possível salvar no histórico (o armazenamento do dispositivo encheu). Exclua itens antigos e tente de novo.'));
    return true;
  }
  // Sem IndexedDB (raro): modo degradado no localStorage.
  try { localStorage.setItem(HIST_KEY, JSON.stringify(_histCache)); return true; }
  catch (e) { alert('Não foi possível salvar no histórico (o armazenamento do navegador encheu). Exclua itens antigos e tente de novo.'); return false; }
}

// Boot: carrega o histórico do IndexedDB (migra do localStorage antigo 1x) e
// atualiza a interface. O render síncrono usa o cache em memória.
async function histHydrate() {
  if (typeof indexedDB === 'undefined') return;
  try {
    let arr = await _apIdbGet(HIST_IDB_KEY);
    if (!Array.isArray(arr)) {
      let legacy = [];
      try { const raw = localStorage.getItem(HIST_KEY); legacy = raw ? JSON.parse(raw) : []; } catch (_) { legacy = []; }
      arr = Array.isArray(legacy) ? legacy : [];
      // Só grava a migração se ninguém salvou durante a hidratação (evita clobber).
      if (_histCache === null && arr.length) { try { await _apIdbSet(HIST_IDB_KEY, arr); } catch (_) { /* */ } }
    }
    // Não sobrescreve o cache se um save já ocorreu na janela de hidratação.
    if (_histCache === null) {
      _histCache = arr;
      try { localStorage.removeItem(HIST_KEY); } catch (_) { /* */ }
    }
    try { updateHistBadge(); } catch (_) { /* */ }
    try { const hv = document.querySelector('#historyView'); if (hv && hv.style.display !== 'none') voltarHistorico(); } catch (_) { /* */ }
  } catch (_) { /* mantém fallback do localStorage */ }
}
function histCount() { return histLoad().length; }
function histGet(id) { return histLoad().find(it => it.id === id) || null; }
function histAdd(item) {
  const arr = histLoad();
  arr.push(item);
  histSaveAll(arr);
  return item.id;
}
function histUpdate(id, patch) {
  const arr = histLoad();
  const i = arr.findIndex(it => it.id === id);
  if (i < 0) return false;
  arr[i] = Object.assign({}, arr[i], patch);
  return histSaveAll(arr);
}
function histDelete(id) {
  return histSaveAll(histLoad().filter(it => it.id !== id));
}

function updateHistBadge() {
  const b = $('histBadge');
  if (b) b.textContent = histCount();
}
