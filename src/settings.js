'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

/* ============================================================
   SETTINGS
   ============================================================ */

function renderSettings() {
  const provider = State.provider || 'groq';
  const providers = ['groq', 'openai', 'anthropic'];
  const providerNames = { groq: 'Groq', openai: 'OpenAI', anthropic: 'Anthropic' };
  const providerLinks = {
    groq: '<a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style="color: var(--accent);">console.groq.com/keys</a>',
    openai: '<a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style="color: var(--accent);">platform.openai.com/api-keys</a>',
    anthropic: '<a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" style="color: var(--accent);">console.anthropic.com</a>',
  };
  const providerPlaceholders = {
    groq: 'gsk_...',
    openai: 'sk-...',
    anthropic: 'sk-ant-...',
  };

  // Provider tabs
  document.querySelectorAll('.s-provider-btn').forEach(btn => {
    const p = btn.dataset.provider;
    btn.style.background = p === provider ? 'var(--accent)' : '';
    btn.style.color = p === provider ? '#fff' : '';
    btn.onclick = () => {
      State.provider = p;
      localStorage.setItem(STORAGE_KEYS.provider, p);
      renderSettings();
    };
  });

  // Provider config panel
  const models = PROVIDER_MODELS[provider] || [];
  const currentKey = State.apiKeys[provider] || '';
  const currentModel = State.models[provider] || (models[0]?.id || '');

  const keyStatus = currentKey
    ? `<div class="flex items-center gap-2" style="background: #e8f4ec; border: 1px solid #c6e3cf; padding: 0.75rem 1rem; border-radius: var(--radius);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a7c59" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <span class="flex-1 text-sm">Chave de API da ${providerNames[provider]} configurada</span>
        <button class="btn btn-danger btn-sm" id="s-apikey-clear">Remover</button>
      </div>`
    : `<div style="background: #fbf2dc; border: 1px solid #f1dfa6; padding: 0.75rem 1rem; border-radius: var(--radius); font-size: 0.875rem;">
        Nenhuma chave de API da ${providerNames[provider]} configurada.
      </div>`;

  const modelOptions = models.map(m =>
    `<option value="${m.id}" ${m.id === currentModel ? 'selected' : ''}>${escapeHtml(m.label)}</option>`
  ).join('');

  const modelDesc = models.find(m => m.id === currentModel)?.desc || '';

  const sharedNote = provider === 'groq'
    ? `<div class="field"><div style="background: #eef3f7; border: 1px solid #d3deea; padding: 0.75rem 1rem; border-radius: var(--radius); font-size: 0.85rem; display: flex; gap: 0.6rem; align-items: flex-start;">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a6ea5" stroke-width="2" style="flex-shrink:0; margin-top:1px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
         <span>A <strong>chave e o modelo Groq</strong> definidos aqui valem para <strong>todas as ferramentas</strong> — Gerar, Narrativa, Causos, Aferidor, Pacote, Extrair e Replicador. Configure uma vez.</span>
       </div></div>`
    : '';

  /* ENDEREÇO DA API — o ajuste que faz o app se moldar ao servidor, e não o
     contrário. Fica recolhido: quem nunca precisou não tropeça nele, e quem
     precisa (bloqueio de rede, gateway da empresa, provedor compatível,
     endereço que mudou) resolve sem esperar versão nova do app. Vazio = padrão
     de fábrica, que é o que mantém a atualização automática para todo mundo. */
  const endpointPadrao = PROVIDER_ENDPOINTS[provider] || '';
  const endpointSalvo = (State.endpoints && State.endpoints[provider]) ? State.endpoints[provider] : '';
  const endpointEmUso = (typeof normalizarBaseUrl === 'function')
    ? normalizarBaseUrl(endpointSalvo, endpointPadrao) : (endpointSalvo || endpointPadrao);
  const compativel = provider === 'anthropic'
    ? 'Serve para gateway próprio, proxy ou endereço regional.'
    : 'Serve para qualquer servidor que fale o dialeto da OpenAI — OpenRouter, Azure, Together, um gateway próprio ou um proxy.';

  const campoEndpoint = `
    <details class="field"${endpointSalvo ? ' open' : ''}>
      <summary style="cursor: pointer; font-size: 0.85rem; color: var(--muted, #6b6b6b); padding: 0.35rem 0;">
        Avançado · endereço da API${endpointSalvo ? ' <strong>(personalizado)</strong>' : ''}
      </summary>
      <div style="padding-top: 0.5rem;">
        <label class="label" for="s-endpoint">Endereço da API · ${providerNames[provider]}</label>
        <div class="flex gap-1">
          <input class="input flex-1" id="s-endpoint" type="url" spellcheck="false" autocapitalize="off"
                 placeholder="${escapeHtml(endpointPadrao)}" value="${escapeHtml(endpointSalvo)}" />
          <button class="btn btn-sm" id="s-endpoint-reset"${endpointSalvo ? '' : ' disabled'}>Padrão</button>
        </div>
        <div class="input-helper">
          Deixe vazio para usar o endereço oficial — assim você recebe as mudanças do provedor sem mexer em nada.
          ${compativel}<br />Em uso agora: <code>${escapeHtml(endpointEmUso)}</code>
        </div>
      </div>
    </details>`;

  $('#s-provider-config').innerHTML = `
    ${sharedNote}
    <div class="field">
      <label class="label">Status</label>
      ${keyStatus}
    </div>
    <div class="field">
      <label class="label" for="s-apikey">Chave de API · ${providerNames[provider]}</label>
      <div class="flex gap-1">
        <input class="input flex-1" id="s-apikey" type="password" placeholder="${providerPlaceholders[provider]}" />
        <button class="btn btn-primary" id="s-apikey-save">Salvar</button>
      </div>
      <div class="input-helper">
        Obtenha sua chave em ${providerLinks[provider]}. Fica salva apenas neste navegador.
      </div>
    </div>
    <div class="field">
      <label class="label" for="s-model">Modelo ${providerNames[provider]}</label>
      <select class="select" id="s-model">
        ${modelOptions}
      </select>
      <span class="input-helper">${escapeHtml(modelDesc)}</span>
    </div>
    ${campoEndpoint}
  `;

  // Bind events
  $('#s-apikey').value = '';
  $('#s-apikey-save').onclick = () => {
    const v = $('#s-apikey').value.trim();
    if (v.length < 8) { toast('A chave de API é muito curta.', 'error'); return; }
    State.apiKeys[provider] = v;
    if (typeof persistApiKeys === 'function') persistApiKeys(); else saveJSON(STORAGE_KEYS.apiKeys, State.apiKeys);
    syncGroqKey();
    if (provider === 'groq') pushConfigToTools();
    renderSettings();
    toast('Chave de API salva.', 'success');
  };
  const clearBtn = document.getElementById('s-apikey-clear');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (!confirm(`Remover a chave de API da ${providerNames[provider]}?`)) return;
      State.apiKeys[provider] = '';
      if (typeof persistApiKeys === 'function') persistApiKeys(); else saveJSON(STORAGE_KEYS.apiKeys, State.apiKeys);
      if (provider === 'groq') { clearGroqMirrors(); pushConfigToTools(); }
      renderSettings();
      toast('Chave de API removida.', 'success');
    };
  }

  /** Grava o endereço do provedor atual. String vazia REMOVE a personalização —
   *  guardar "" seria indistinguível de uma escolha, e travaria o provedor num
   *  endereço que um dia pode mudar. */
  const salvarEndpoint = (valor) => {
    const v = String(valor || '').trim();
    if (v) State.endpoints[provider] = v; else delete State.endpoints[provider];
    saveJSON(STORAGE_KEYS.endpoints, State.endpoints);
    renderSettings();
    toast(v ? 'Endereço da API atualizado.' : 'Endereço da API de volta ao padrão.', 'success');
  };
  $('#s-endpoint').onchange = (e) => salvarEndpoint(e.target.value);
  const resetBtn = document.getElementById('s-endpoint-reset');
  if (resetBtn) resetBtn.onclick = () => salvarEndpoint('');

  $('#s-model').value = currentModel;
  $('#s-model').onchange = () => {
    State.models[provider] = $('#s-model').value;
    saveJSON(STORAGE_KEYS.models, State.models);
    if (provider === 'groq') { syncGroqModel(); pushConfigToTools(); }
    renderSettings();
    toast('Modelo atualizado.', 'success');
  };

  /* VERSÃO + atualização forçada. O app é um PWA: o service worker guarda os
     arquivos para funcionar offline, e depois de uma publicação o aparelho pode
     continuar servindo a versão antiga até o worker ser trocado. Sem um número
     visível, "não mudou nada aqui" é indistinguível de "não foi publicado" — e
     não havia como o usuário desempatar isso sozinho. */
  const elBuild = document.getElementById('s-build');
  if (elBuild) {
    let build = '';
    try {
      const el = document.querySelector('[data-build]');
      build = (el && el.dataset && el.dataset.build) || '';
    } catch (_) { /* */ }
    elBuild.textContent = build || 'desconhecida';
  }
  const btnUpdate = document.getElementById('s-update-now');
  if (btnUpdate) {
    btnUpdate.onclick = async () => {
      btnUpdate.disabled = true;
      if (typeof toast === 'function') toast('Buscando atualização…', 'info', 3000);
      // Ordem importa: derruba o worker ANTES de limpar os caches, senão ele
      // pode reescrever o que acabou de ser apagado. Cada passo é isolado —
      // um navegador sem service worker ainda assim recarrega no fim.
      try {
        if (navigator.serviceWorker) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch (_) { /* */ }
      try {
        if (window.caches) {
          const nomes = await caches.keys();
          await Promise.all(nomes.map((n) => caches.delete(n)));
        }
      } catch (_) { /* */ }
      // Recarrega por uma URL nova: alguns navegadores servem o HTML do cache
      // de disco mesmo sem service worker, e aí nada disso teria adiantado.
      const u = new URL(location.href);
      u.searchParams.set('atualizar', String(Date.now()));
      location.replace(u.toString());
    };
  }

  // Card "Dados e backup": medidor de uso + exportar/importar workspace.
  if (typeof wireStorageUI === 'function') wireStorageUI();
}

