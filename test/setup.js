// Polyfill de localStorage para o ambiente de teste.
// (Node 25 expõe um localStorage experimental que conflita com o do jsdom.)
class MemStorage {
  constructor() { this._m = new Map(); }
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }
  setItem(k, v) { this._m.set(String(k), String(v)); }
  removeItem(k) { this._m.delete(String(k)); }
  clear() { this._m.clear(); }
  key(i) { return [...this._m.keys()][i] ?? null; }
  get length() { return this._m.size; }
}
const ls = new MemStorage();
Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
if (typeof window !== 'undefined') {
  try { Object.defineProperty(window, 'localStorage', { value: ls, configurable: true, writable: true }); } catch { /* ignore */ }
}
