// Mock mínimo e em memória de IndexedDB — cobre APENAS a superfície que
// src/storage.js usa (open/transaction/objectStore put·get·delete·openCursor).
// As callbacks (onsuccess/oncomplete/onupgradeneeded) são disparadas de forma
// assíncrona, como no IndexedDB real, porque storage.js as atribui DEPOIS de
// chamar open()/get(). Persiste entre chamadas de open() (igual a um DB real).

const DBS = new Map(); // nome do DB -> Map<nomeDoStore, Map<chave, valor>>

function backingFor(name) {
  if (!DBS.has(name)) DBS.set(name, new Map());
  return DBS.get(name);
}

function later(fn) { setTimeout(() => { try { fn(); } catch (_) { /* */ } }, 0); }

class FakeRequest {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
    this.onupgradeneeded = null;
  }
}

class FakeObjectStore {
  constructor(map) { this._map = map; }
  put(value, key) {
    this._map.set(key, value);
    const r = new FakeRequest();
    later(() => r.onsuccess && r.onsuccess());
    return r;
  }
  get(key) {
    const r = new FakeRequest();
    r.result = this._map.get(key);
    later(() => r.onsuccess && r.onsuccess());
    return r;
  }
  delete(key) {
    this._map.delete(key);
    const r = new FakeRequest();
    later(() => r.onsuccess && r.onsuccess());
    return r;
  }
  openCursor() {
    const r = new FakeRequest();
    const entries = [...this._map.entries()];
    let i = 0;
    const step = () => {
      if (i >= entries.length) { r.result = null; if (r.onsuccess) r.onsuccess(); return; }
      const [key, value] = entries[i++];
      r.result = { key, value, continue: () => later(step) };
      if (r.onsuccess) r.onsuccess();
    };
    later(step);
    return r;
  }
}

class FakeTransaction {
  constructor(backing, storeName) {
    this._backing = backing;
    this._storeName = storeName;
    this.oncomplete = null;
    this.onerror = null;
    this.error = null;
    // A escrita acontece de forma síncrona em put(); o "complete" vem depois.
    later(() => this.oncomplete && this.oncomplete());
  }
  objectStore(name) {
    const s = name || this._storeName;
    if (!this._backing.has(s)) this._backing.set(s, new Map());
    return new FakeObjectStore(this._backing.get(s));
  }
}

function makeDb(name, backing) {
  return {
    _name: name,
    objectStoreNames: { contains: (s) => backing.has(s) },
    createObjectStore: (s) => { backing.set(s, new Map()); return new FakeObjectStore(backing.get(s)); },
    transaction: (storeName) => new FakeTransaction(backing, storeName),
    close: () => {},
  };
}

const fakeIndexedDB = {
  open(name) {
    const r = new FakeRequest();
    const backing = backingFor(name);
    r.result = makeDb(name, backing);
    later(() => {
      if (!backing.has('kv') && r.onupgradeneeded) r.onupgradeneeded();
      if (r.onsuccess) r.onsuccess();
    });
    return r;
  },
};

/** Instala o mock no escopo global (antes de carregar storage.js). */
export function installIdbMock() {
  globalThis.indexedDB = fakeIndexedDB;
}

/** Zera todos os dados do IDB mock (isolamento entre testes). */
export function resetIdb() { DBS.clear(); }
