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

// Stub de canvas 2D: o jsdom não implementa getContext('2d'). Alguns modelos de
// cartaz geram texturas/padrões via canvas; sem o stub, o jsdom emite avisos e o
// código poderia derrubar em null. O stub devolve no-ops, mantendo o render
// determinístico no ambiente de teste (a fidelidade visual é coberta pelo smoke
// manual no navegador real).
if (typeof HTMLCanvasElement !== 'undefined') {
  const ctxStub = new Proxy({}, {
    get(_t, prop) {
      const name = String(prop);
      return (...args) => {
        if (name === 'createLinearGradient' || name === 'createRadialGradient' || name === 'createPattern') {
          return { addColorStop() {} };
        }
        if (name === 'getImageData') return { data: new Uint8ClampedArray(4) };
        if (name === 'measureText') return { width: 0 };
        return undefined;
      };
    },
    set() { return true; },
  });
  HTMLCanvasElement.prototype.getContext = () => ctxStub;
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
}
