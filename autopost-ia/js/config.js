'use strict';
/* ============================================================
   CONFIG — chave e modelo da API Groq.

   Ordem de resolução da CHAVE (a primeira que existir):
     1. window.__AGENTE_CONFIG__  (injetada pela plataforma quando embutido)
     2. GROQ_API_KEY              (constante abaixo, para uso pessoal)
     3. localStorage 'groq_api_key'
     4. Modal de configuração     (pede uma vez; fica salva no navegador)

   SEGURANÇA: em uso local/pessoal, a chave no navegador é aceitável.
   Para publicar como serviço a terceiros, mova as chamadas para um
   proxy (Cloudflare Workers / Vercel) e NUNCA exponha a chave.
   Workspace bloqueado (plataforma): a chave fica só em memória.
   ============================================================ */

// Preencha para uso pessoal OU deixe em branco e configure pelo app (⚙).
const GROQ_API_KEY = "";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL_PADRAO = "llama-3.3-70b-versatile";

function groqModel() {
  return (window.__AGENTE_CONFIG__ && window.__AGENTE_CONFIG__.groqModel) ||
    localStorage.getItem('groq_model') || GROQ_MODEL_PADRAO;
}

// A chave está "bloqueada"? (workspace protegido da plataforma → não persistir)
function chaveBloqueada() {
  return !!(window.__AGENTE_CONFIG__ && window.__AGENTE_CONFIG__.locked);
}

// Lê a chave já disponível (sem pedir). '' quando não há.
function chaveAtual() {
  return ((window.__AGENTE_CONFIG__ && window.__AGENTE_CONFIG__.groqKey) ||
    GROQ_API_KEY || localStorage.getItem('groq_api_key') || '').trim();
}

/* ---------- Modal de configuração (substitui o window.prompt) ---------- */

let _keyModalResolve = null;

function _abrirModalChave(motivo) {
  const modal = $('settingsModal');
  if (!modal) return Promise.resolve('');
  $('settingsMotivo').textContent = motivo || '';
  $('settingsKey').value = chaveAtual();
  $('settingsModel').value = localStorage.getItem('groq_model') || '';
  modal.classList.remove('hidden');
  setTimeout(() => { try { $('settingsKey').focus(); } catch (_) {} }, 50);
  return new Promise((resolve) => { _keyModalResolve = resolve; });
}

function _fecharModalChave(salvou) {
  const modal = $('settingsModal');
  if (modal) modal.classList.add('hidden');
  let k = '';
  if (salvou) {
    k = ($('settingsKey').value || '').trim();
    const m = ($('settingsModel').value || '').trim();
    try {
      /* Workspace bloqueado: não persiste em claro nem a digitação manual. */
      if (k && !chaveBloqueada()) localStorage.setItem('groq_api_key', k);
      if (m) localStorage.setItem('groq_model', m);
      else localStorage.removeItem('groq_model');
    } catch (_) {}
    if (k && window.__AGENTE_CONFIG__) window.__AGENTE_CONFIG__.groqKey = k;
    if (k && !window.__AGENTE_CONFIG__) window.__AGENTE_CONFIG__ = { groqKey: k, groqModel: '', locked: false };
  }
  if (_keyModalResolve) { _keyModalResolve(k || chaveAtual()); _keyModalResolve = null; }
}

// Obtém a chave; se não houver, abre o modal e AGUARDA o usuário.
async function getGroqKey() {
  const k = chaveAtual();
  if (k) return k;
  return await _abrirModalChave('Para gerar o pacote, cole sua chave da API Groq (gratuita).');
}

/* ============================================================
   TEMA — Escuro (padrão) · Claro · Sistema.
   Aplicado via atributo [data-theme] no <html>. Um script inline no
   <head> já define o data-theme antes da 1ª pintura (sem flash); aqui
   sincronizamos o seletor, o theme-color do navegador e a resposta ao
   modo "Sistema" quando o dispositivo troca de tema.
   ============================================================ */
const TEMA_KEY = 'autopost:tema';
const TEMA_CORES = { dark: '#0a0a0a', light: '#faf8f4' };

/* O PADRÃO DEPENDE DE ONDE A FERRAMENTA ESTÁ ABERTA.
 *
 * Relatado: embutida na plataforma, ela abria SEMPRE no escuro, mesmo com o
 * aplicativo no claro. O script inline do <head> já tratava disso, mas esta
 * função não — devolvia 'dark' para qualquer coisa não guardada, e o boot
 * (`aplicarTema(temaAtual())`) desfazia, no primeiro frame, o acerto do inline.
 * Duas fontes para o mesmo padrão, discordando.
 *
 * Embutida, o padrão é CLARO. Cheguei a pôr 'system' aqui, achando que o app
 * pai seguisse `prefers-color-scheme`. Medi no Chromium antes de fechar e ele
 * NÃO segue: com o sistema no escuro o pai continua claro (rgb(247,246,242)) —
 * a plataforma é um aplicativo de tema único, e o seu único bloco
 * `prefers-color-scheme: dark` só retoca as cores de um componente. Com
 * 'system', o AutoPost ia para o escuro dentro de um app claro: o mesmo
 * desencontro relatado, virado do avesso. Sozinha, a ferramenta mantém o
 * escuro, que é a cara dela.
 *
 * Escolha explícita do usuário continua acima de tudo: só o padrão mudou. */
function temaEmbutida() {
  try { return !!(window.parent && window.parent !== window); } catch (_) { return true; }
}

function temaPadrao() {
  return temaEmbutida() ? 'light' : 'dark';
}

function temaAtual() {
  try {
    const t = localStorage.getItem(TEMA_KEY);
    return (t === 'dark' || t === 'light' || t === 'system') ? t : temaPadrao();
  } catch (_) { return temaPadrao(); }
}

// Cor da barra do navegador (theme-color) para o tema efetivo.
function _corTema(t) {
  if (t === 'system') {
    const escuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return escuro ? TEMA_CORES.dark : TEMA_CORES.light;
  }
  if (TEMA_CORES[t]) return TEMA_CORES[t];
  // Valor inesperado: cai no padrão do lugar onde a ferramenta está aberta.
  // Sem recursão de propósito — `temaPadrao()` pode devolver 'system'.
  return temaPadrao() === 'system' ? _corTema('system') : TEMA_CORES.dark;
}

function aplicarTema(t, persistir) {
  if (t !== 'dark' && t !== 'light' && t !== 'system') t = temaPadrao();
  const root = document.documentElement;
  // Desliga transições por 1 frame (troca instantânea + evita o artefato do
  // Chromium com cores var() transicionadas).
  root.classList.add('theme-switching');
  root.setAttribute('data-theme', t);
  void root.offsetWidth; // força reflow com as transições desligadas (troca instantânea)
  // setTimeout (não rAF): dispara mesmo com a aba em segundo plano, então a
  // classe nunca fica presa desligando as transições normais (hover etc.).
  setTimeout(() => root.classList.remove('theme-switching'), 50);
  if (persistir) { try { localStorage.setItem(TEMA_KEY, t); } catch (_) {} }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', _corTema(t));
  const seg = document.getElementById('themeSeg');
  if (seg) seg.querySelectorAll('.seg-btn').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.tema === t));
  });
}

function initThemeUI() {
  aplicarTema(temaAtual(), false); // alinha meta + seletor (o data-theme já veio do inline)
  const seg = document.getElementById('themeSeg');
  if (seg) seg.querySelectorAll('.seg-btn').forEach(b => {
    b.addEventListener('click', () => aplicarTema(b.dataset.tema, true));
  });
  // Modo "Sistema": acompanha a troca de tema do dispositivo em tempo real.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (temaAtual() === 'system') aplicarTema('system', false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
}

// Liga os controles do modal (chamado no boot pelo app.js).
function initConfigUI() {
  initThemeUI(); // tema sempre inicializa (independe do resto do modal)
  const modal = $('settingsModal');
  if (!modal) return;
  const btnOpen = $('settingsBtn');
  if (btnOpen) btnOpen.addEventListener('click', () => { _abrirModalChave(''); });
  $('settingsSave').addEventListener('click', () => _fecharModalChave(true));
  $('settingsCancel').addEventListener('click', () => _fecharModalChave(false));
  modal.addEventListener('click', (e) => { if (e.target === modal) _fecharModalChave(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) _fecharModalChave(false);
  });
  const tg = $('settingsKeyToggle');
  if (tg) tg.addEventListener('click', () => {
    const inp = $('settingsKey');
    const oculto = inp.type === 'password';
    inp.type = oculto ? 'text' : 'password';
    tg.textContent = oculto ? 'Ocultar' : 'Mostrar';
  });
  // Embutido na plataforma: quem gerencia a chave é o app pai → engrenagem some.
  if (window.IS_EMBEDDED && btnOpen) btnOpen.style.display = 'none';
}
