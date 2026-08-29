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

  /* A OpenAI é a única dos três que NÃO libera chamada de navegador (não manda
     o cabeçalho de CORS), e esta plataforma é 100% navegador — não há servidor
     nosso no meio. O pedido é barrado antes de sair, e o usuário via só "Load
     failed" depois de ter criado a chave e posto crédito. O aviso vem ANTES
     disso, na hora de escolher o provedor. */
  const avisoOpenAI = provider === 'openai'
    ? `<div class="field"><div style="background: #fbf2dc; border: 1px solid #f1dfa6; padding: 0.75rem 1rem; border-radius: var(--radius); font-size: 0.85rem; display: flex; gap: 0.6rem; align-items: flex-start;">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a5813a" stroke-width="2" style="flex-shrink:0; margin-top:1px;"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
         <span><strong>A OpenAI não atende chamadas feitas direto do navegador.</strong> Ela não envia a autorização (CORS) que o navegador exige, e o pedido é barrado antes de sair — com chave válida e crédito na conta. Não há ajuste deste lado que resolva: seria preciso um servidor intermediário. Para gerar hoje, use <strong>Groq</strong> ou <strong>Anthropic</strong>.</span>
       </div></div>`
    : '';

  $('#s-provider-config').innerHTML = `
    ${sharedNote}
    ${avisoOpenAI}
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

  $('#s-model').value = currentModel;
  $('#s-model').onchange = () => {
    State.models[provider] = $('#s-model').value;
    saveJSON(STORAGE_KEYS.models, State.models);
    if (provider === 'groq') { syncGroqModel(); pushConfigToTools(); }
    renderSettings();
    toast('Modelo atualizado.', 'success');
  };

  // Card "Dados e backup": medidor de uso + exportar/importar workspace.
  if (typeof wireStorageUI === 'function') wireStorageUI();
}

