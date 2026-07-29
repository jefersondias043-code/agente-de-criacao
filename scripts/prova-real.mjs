#!/usr/bin/env node
// PROVA REAL — roda o pipeline de agentes contra a API de verdade e audita a
// saída com os mesmos detectores que rodam em produção.
//
// Por que existe: os testes de unidade provam que os detectores ACHAM o que
// precisam achar e que os prompts CARREGAM as regras. Nenhum dos dois prova
// que o modelo OBEDECE. Só uma geração real responde isso, e ela depende de
// chave e de rede — coisas que não existem no ambiente de teste automatizado.
//
// Uso:
//   GROQ_API_KEY=gsk_... node scripts/prova-real.mjs
//   GROQ_API_KEY=gsk_... node scripts/prova-real.mjs --tom Otimista --repetir 3
//
// Opções:
//   --pauta <arquivo>   texto de entrada (padrão: test/fixtures/pauta-cajutiba.txt)
//   --estilo <id>       padrão: Noticioso
//   --tom <id>          padrão: Pessimista
//   --modelo <id>       padrão: llama-3.3-70b-versatile
//   --repetir <n>       n gerações seguidas (o modelo varia; 1 amostra não conclui)
//   --base <url>        endpoint compatível com OpenAI (padrão: api.groq.com)
//   --json              despeja o resultado bruto em vez do relatório
//
// A chave vem SÓ do ambiente. Nunca passe chave por argumento (ela fica no
// histórico do shell) e nunca escreva chave neste arquivo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ---------------------------------------------------------------- argumentos */
function parseArgs(argv) {
  const o = {
    pauta: path.join(RAIZ, 'test/fixtures/pauta-cajutiba.txt'),
    estilo: 'Noticioso',
    tom: 'Pessimista',
    modelo: 'llama-3.3-70b-versatile',
    base: 'https://api.groq.com/openai/v1',
    repetir: 1,
    json: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') { o.json = true; continue; }
    const v = argv[++i];
    if (a === '--pauta') o.pauta = path.resolve(v);
    else if (a === '--estilo') o.estilo = v;
    else if (a === '--tom') o.tom = v;
    else if (a === '--modelo') o.modelo = v;
    else if (a === '--base') o.base = v.replace(/\/$/, '');
    else if (a === '--repetir') o.repetir = Math.max(1, parseInt(v, 10) || 1);
    else { console.error(`Opção desconhecida: ${a}`); process.exit(2); }
  }
  return o;
}

/* ------------------------------------------------- ambiente de navegador mínimo
 * Os módulos de src/ são scripts clássicos escritos para o browser. Mesmo
 * bootstrap do test/setup.js, só que fora do vitest. */
function prepararAmbiente() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  for (const k of ['window', 'document', 'navigator', 'location', 'HTMLElement',
    'HTMLCanvasElement', 'Node', 'Element', 'CustomEvent', 'Event', 'getComputedStyle']) {
    if (!(k in globalThis) || k === 'window' || k === 'document') {
      Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
    }
  }
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
  try { Object.defineProperty(dom.window, 'localStorage', { value: ls, configurable: true, writable: true }); } catch { /* ok */ }

  const ctxStub = new Proxy({}, {
    get(_t, prop) {
      const nome = String(prop);
      return () => {
        if (nome.startsWith('create')) return { addColorStop() {} };
        if (nome === 'getImageData') return { data: new Uint8ClampedArray(4) };
        if (nome === 'measureText') return { width: 0 };
        return undefined;
      };
    },
    set() { return true; },
  });
  dom.window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
  dom.window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
}

/** Carrega os módulos de src/ no escopo global — mesmo truque do test/helpers. */
function carregarModulos(arquivos, nomes) {
  const codigo = arquivos.map((f) => fs.readFileSync(path.join(RAIZ, 'src', f), 'utf8')).join('\n;\n') +
    `\n;globalThis.__CAP__ = { ${nomes.join(', ')} };`;
  (0, eval)(codigo);
  return globalThis.__CAP__;
}

/* ------------------------------------------------------------ chamada à API */
/** Devolve um `call(prompt)` no formato que o pipeline espera de callLLM. */
function fazerChamador({ apiKey, modelo, base }) {
  return async function call(prompt) {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, messages: [{ role: 'user', content: prompt }], temperature: 0.6 }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j?.error?.message) msg = j.error.message; } catch { /* corpo não-JSON */ }
      throw new Error(msg);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('resposta vazia');
    return {
      content,
      model: json.model || modelo,
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
    };
  };
}

/* ------------------------------------------------------------------ saída */
const C = process.stdout.isTTY
  ? { d: '\x1b[2m', b: '\x1b[1m', v: '\x1b[32m', r: '\x1b[31m', a: '\x1b[33m', z: '\x1b[0m' }
  : { d: '', b: '', v: '', r: '', a: '', z: '' };

const linha = (t = '') => console.log(t);
const titulo = (t) => { linha(); linha(`${C.b}${t}${C.z}`); linha('─'.repeat(Math.min(72, t.length + 12))); };
const item = (ok, t) => linha(`  ${ok ? `${C.v}✓${C.z}` : `${C.r}✗${C.z}`} ${t}`);

function imprimirMateria(a) {
  titulo('MATÉRIA GERADA');
  linha(`${C.b}${a.titulo || '(sem título)'}${C.z}`);
  if (a.subtitulo) linha(`${C.d}${a.subtitulo}${C.z}`);
  linha();
  linha(a.lead || '');
  (a.corpo || []).forEach((p) => { linha(); linha(p); });
  if (a.hashtags?.length) { linha(); linha(`${C.d}${a.hashtags.join(' ')}${C.z}`); }
}

function imprimirAuditoria(r, opts) {
  // Atenção ao nome: o pipeline republica `conflitos` como `conflitosDeTom`,
  // mas mantém `repeticoes`. Ler a chave errada devolve zero em silêncio.
  const ed = r.agents.editor || {};
  const conflitosRascunho = ed.conflitosDeTom || [];
  const restantesConf = ed.conflitosRestantes || conflitosRascunho;
  const restantesRep = ed.repeticoesRestantes || ed.repeticoes || [];

  titulo('AUDITORIA DA SAÍDA');
  linha(`${C.d}estilo ${opts.estilo} · tom ${opts.tom} · modelo ${r.model}${C.z}`);
  linha();

  linha(`${C.b}Conflito de tom${C.z}  ${C.d}(palavra da direção oposta ao tom pedido)${C.z}`);
  linha(`  no rascunho: ${conflitosRascunho.length}   →   depois da revisão: ${restantesConf.length}`);
  conflitosRascunho.forEach((c) => linha(`    ${C.d}rascunho:${C.z} ${c}`));
  restantesConf.forEach((c) => linha(`    ${C.a}sobrou:${C.z} ${c}`));
  item(restantesConf.length === 0, restantesConf.length === 0
    ? 'nenhum elogio/crítica contrária sobrou no texto final'
    : `${restantesConf.length} expressão(ões) contra o tom sobreviveram`);

  linha();
  linha(`${C.b}Repetição entre parágrafos${C.z}  ${C.d}(mesma abertura ou mesma sequência de 5 palavras)${C.z}`);
  linha(`  no rascunho: ${(ed.repeticoes || []).length}   →   depois da revisão: ${restantesRep.length}`);
  restantesRep.forEach((c) => linha(`    ${C.a}sobrou:${C.z} ${c}`));
  item(restantesRep.length === 0, restantesRep.length === 0
    ? 'nenhum argumento repetido no texto final'
    : `${restantesRep.length} repetição(ões) sobreviveram`);

  linha();
  linha(`${C.b}Revisão${C.z}`);
  if (ed.ok) {
    item(true, 'revisão aplicada');
  } else if (ed.motivo === 'introduziu-fato') {
    item(false, `revisão DESCARTADA — o revisor inventou: ${(ed.inventado || []).join(', ')}`);
    linha(`    ${C.d}a trava de fidelidade funcionou: ficou o rascunho${C.z}`);
  } else {
    item(false, `revisão não aplicada (${ed.motivo || 'motivo desconhecido'})`);
  }

  linha();
  linha(`${C.b}Risco jurídico${C.z}`);
  if (!r.riscos.length) item(true, 'nenhum ponto de atenção');
  else r.riscos.forEach((x) => linha(`    ${C.a}${x.tipo}${C.z} — ${x.detalhe || x.mensagem || ''}`));

  linha();
  linha(`${C.b}Hashtags por função${C.z}`);
  (r.optimization?.hashtags || []).forEach((h) => linha(`    ${C.d}${String(h.tipo || '?').padEnd(12)}${C.z} #${h.tag}`));

  return { conflitos: restantesConf.length, repeticoes: restantesRep.length };
}

/* ------------------------------------------------------------------- main */
async function main() {
  const opts = parseArgs(process.argv);
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    console.error('Falta a chave. Rode:  GROQ_API_KEY=gsk_... node scripts/prova-real.mjs');
    process.exit(2);
  }
  if (!fs.existsSync(opts.pauta)) {
    console.error(`Pauta não encontrada: ${opts.pauta}`);
    process.exit(2);
  }
  const conteudo = fs.readFileSync(opts.pauta, 'utf8').trim();

  prepararAmbiente();
  const A = carregarModulos(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js'],
    ['runContentPipeline', 'detectarConflitosDeTom', 'detectarRepeticoes']
  );

  const call = fazerChamador({ apiKey, modelo: opts.modelo, base: opts.base });
  const placar = [];

  for (let n = 1; n <= opts.repetir; n++) {
    if (opts.repetir > 1) titulo(`RODADA ${n}/${opts.repetir}`);
    const r = await A.runContentPipeline({
      content: conteudo,
      style: opts.estilo,
      tone: opts.tom,
      call,
      onStage: (_k, t) => process.stderr.write(`${C.d}  · ${t}${C.z}\n`),
    });
    if (opts.json) { console.log(JSON.stringify(r, null, 2)); continue; }
    imprimirMateria(r.article);
    placar.push(imprimirAuditoria(r, opts));
  }

  if (opts.json) return;

  const somaC = placar.reduce((s, p) => s + p.conflitos, 0);
  const somaR = placar.reduce((s, p) => s + p.repeticoes, 0);
  titulo('VEREDITO');
  linha(`  ${opts.repetir} rodada(s) · conflitos de tom restantes: ${somaC} · repetições restantes: ${somaR}`);
  const limpo = somaC === 0 && somaR === 0;
  linha(`  ${limpo ? `${C.v}LIMPO${C.z}` : `${C.r}AINDA VAZA${C.z}`}`);
  linha();
  linha(`${C.d}  Os números acima são o que os detectores enxergam. Leia a matéria:${C.z}`);
  linha(`${C.d}  contradição e repetição que escapam do detector ainda são defeito.${C.z}`);
  process.exitCode = limpo ? 0 : 1;
}

main().catch((e) => {
  console.error(`\n${C.r}falhou:${C.z} ${e.message}`);
  process.exit(1);
});
