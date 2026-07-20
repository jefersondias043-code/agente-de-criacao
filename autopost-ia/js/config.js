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

// Liga os controles do modal (chamado no boot pelo app.js).
function initConfigUI() {
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
