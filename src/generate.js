'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

// ---------- Render Generate ----------
function renderGenerate() {
  // Abas mobile Pauta↔Resultado (em telas largas não têm efeito visual)
  wireMtabs('#view-generate');

  // Catálogos
  const styleSel = $('#g-style');
  const toneSel = $('#g-tone');
  if (!styleSel.options.length) {
    styleSel.innerHTML = STYLES.map(g =>
      `<optgroup label="${g.group}">${g.items.map(i =>
        `<option value="${i.id}">${i.label}</option>`).join('')}</optgroup>`
    ).join('');
    toneSel.innerHTML = TONES.map(g =>
      `<optgroup label="${g.group}">${g.items.map(i =>
        `<option value="${i.id}">${i.label}</option>`).join('')}</optgroup>`
    ).join('');

    const updateStyleDesc = () => {
      const found = STYLES.flatMap(g => g.items).find(i => i.id === styleSel.value);
      $('#g-style-desc').textContent = found?.desc || '';
    };
    const updateToneDesc = () => {
      const found = TONES.flatMap(g => g.items).find(i => i.id === toneSel.value);
      $('#g-tone-desc').textContent = found?.desc || '';
    };
    styleSel.addEventListener('change', updateStyleDesc);
    toneSel.addEventListener('change', updateToneDesc);
    styleSel.value = 'Jornalístico'; updateStyleDesc();
    toneSel.value = 'Formal'; updateToneDesc();
  }

  // Status da chave de IA: quando OK vira um selo discreto no cabeçalho (não
  // gasta área nobre); o card âmbar com CTA só aparece quando FALTA a chave.
  const providerName = (State.provider || 'groq').charAt(0).toUpperCase() + (State.provider || 'groq').slice(1);
  const hasKey = !!State.apiKeys[State.provider || 'groq'];
  // O indicador "conectado" foi removido (config de IA é unificada na plataforma).
  // Mantemos só o aviso âmbar, que aparece quando FALTA a chave (acionável).
  if (hasKey) {
    $('#api-warning').classList.add('hidden');
  } else {
    $('#api-warning').innerHTML = `
      <div class="flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--amber); flex-shrink: 0;">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div class="flex-1">
          <strong>Configure sua chave de API</strong>
          <div class="text-sm text-soft">Antes de gerar, adicione sua chave da ${providerName} nas Configurações.</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-go="settings">Configurar</button>
      </div>`;
    $('#api-warning').classList.remove('hidden');
  }

  // Extrações disponíveis
  const eSel = $('#g-extraction');
  const completedExtractions = State.extractions.filter(e => e.status === 'completed' && e.text);
  eSel.innerHTML = '<option value="">Nenhum</option>' +
    completedExtractions.map(e =>
      `<option value="${e.id}">${escapeHtml(e.title || `Extração de ${formatDate(e.createdAt)}`)} (${e.text.length} chars)</option>`
    ).join('');

  // Char counter
  const ta = $('#g-text');
  const helper = $('#g-text-helper');
  ta.oninput = () => {
    const len = ta.value.length;
    helper.textContent = `${len.toLocaleString('pt-BR')} caracteres` +
      (len > MAX_CONTENT_CHARS ? ` · será truncado em ${MAX_CONTENT_CHARS}` : '');
    helper.classList.toggle('warn', len > MAX_CONTENT_CHARS);
  };

  // Entrada universal: anexar arquivo (PDF/imagem/áudio/vídeo/TXT) → vira texto na pauta
  const gAttachInput = $('#g-attach-input');
  const gAttachBtn = $('#g-attach-btn');
  if (gAttachInput && gAttachBtn && typeof INGEST_ACCEPT !== 'undefined') {
    gAttachInput.accept = INGEST_ACCEPT;
    gAttachBtn.onclick = () => gAttachInput.click();
    gAttachInput.onchange = () => {
      const f = gAttachInput.files && gAttachInput.files[0];
      if (f && typeof ingestFileNative === 'function') {
        ingestFileNative(f, (text) => {
          const cur = (ta.value || '').trim();
          ta.value = cur ? (cur + '\n\n' + text) : text;
          ta.dispatchEvent(new Event('input'));
        });
      }
      gAttachInput.value = '';
    };
  }

  // Recebe texto de outra ferramenta ("Enviar para Gerar")
  if (State.handoff && State.handoff.target === 'generate' && State.handoff.text) {
    const existing = (ta.value || '').trim();
    ta.value = existing ? (existing + '\n\n' + State.handoff.text) : State.handoff.text;
    ta.dispatchEvent(new Event('input'));
    State.handoff = null;
    setMtab('#view-generate', 'a'); // o texto chega na Pauta — mostra a Pauta
    toast('Texto recebido. É só ajustar e gerar.', 'success');
  }

  // Histórico de matérias — drawer lateral, dentro da própria ferramenta Gerar.
  setupGenHistory();

  // Submit
  $('#g-submit').onclick = async () => {
    const style = styleSel.value;
    const tone = toneSel.value;
    const manualText = ta.value.trim();
    const extractionId = eSel.value;
    const extraction = extractionId ? State.extractions.find(e => e.id === extractionId) : null;

    if (!State.apiKeys[State.provider || 'groq']) {
      toast(`Configure a chave de API do ${(State.provider || 'groq').charAt(0).toUpperCase() + (State.provider || 'groq').slice(1)} nas Configurações.`, 'error');
      goTo('settings');
      return;
    }
    let combinedText = manualText;
    if (extraction?.text) {
      combinedText = (manualText ? manualText + '\n\n' : '') + extraction.text;
    }
    if (!combinedText) {
      toast('Adicione algum conteúdo — texto ou uma extração.', 'error');
      return;
    }

    const btn = $('#g-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Gerando…';
    $('#g-result-area').innerHTML = `
      <div class="empty">
        <div class="spinner spinner-lg" style="color: var(--accent); border-right-color: transparent; margin: 0 auto 1rem;"></div>
        <div class="empty-title" id="g-loading-title">Iniciando pipeline…</div>
        <div class="empty-desc" id="g-loading-desc">A matéria passa por agentes especializados.</div>
        <div class="pipeline-steps" id="g-pipeline-steps">
          <span class="pipeline-step" data-step="interpret">Interpretação</span>
          <span class="pipeline-step" data-step="write">Redação</span>
          <span class="pipeline-step" data-step="design">Design</span>
        </div>
      </div>`;

    // Progresso por AGENTE: cada etapa acende seu selo e atualiza o título/desc.
    const onStage = (key, title, desc) => {
      const t = $('#g-loading-title'), d = $('#g-loading-desc');
      if (t) t.textContent = title;
      if (d) d.textContent = desc;
      $$('#g-pipeline-steps .pipeline-step').forEach((el) => {
        if (el.dataset.step === key) el.classList.add('active');
        else if (el.classList.contains('active')) el.classList.replace('active', 'done');
      });
    };

    const truncNote = combinedText.length > MAX_CONTENT_CHARS
      ? [`Conteúdo truncado de ${combinedText.length.toLocaleString('pt-BR')} para ${MAX_CONTENT_CHARS.toLocaleString('pt-BR')} caracteres.`]
      : [];

    try {
      const result = await runContentPipeline({ content: combinedText, style, tone, onStage });
      const generation = {
        id: uuid(),
        content: cleanText(result.content),
        style, tone,
        manualText: manualText || null,
        extractionId: extractionId || null,
        sourceCharCount: combinedText.length,
        finalCharCount: Math.min(combinedText.length, MAX_CONTENT_CHARS),
        wasTruncated: combinedText.length > MAX_CONTENT_CHARS,
        warnings: truncNote,
        // Saída estruturada do pipeline de agentes:
        interpretation: result.interpretation,
        article: result.article,
        design: result.design,
        agents: result.agents,
        pipeline: true,
        model: result.model,
        promptTokens: result.promptTokens || null,
        completionTokens: result.completionTokens || null,
        createdAt: new Date().toISOString(),
      };
      State.generations.unshift(generation);
      saveGenerations();
      toast('Matéria gerada pelos agentes.', 'success');
      renderGenerationResult(generation);
    } catch (err) {
      toast(err.message || 'Não foi possível gerar a matéria.', 'error', 6000);
      $('#g-result-area').innerHTML = `
        <div class="empty">
          <div class="empty-title">Erro</div>
          <div class="empty-desc">${escapeHtml(err.message || 'Tente novamente.')}</div>
        </div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg> Gerar matéria`;
    }
  };
}

// Ações padrão de um resultado de matéria — fonte ÚNICA usada no resultado
// recém-gerado E no histórico, para a experiência ser idêntica (sem drift).
function generationActionsHtml() {
  return `
    <div class="flex gap-1 flex-wrap mt-2">
      <button class="btn btn-ghost btn-sm" data-gen-copy>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copiar
      </button>
      <button class="btn btn-ghost btn-sm" data-gen-poster>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        Criar cartaz
      </button>
      <button class="btn btn-ghost btn-sm" data-gen-carousel>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="M19 7v10"/><path d="M22 9v6"/></svg>
        Criar carrossel
      </button>
    </div>
    ${typeof sendToBarHtml === 'function' ? sendToBarHtml(['generate', 'cartazes', 'carrossel']) : ''}
  `;
}
function wireGenerationActions(rootEl, g) {
  if (!rootEl) return;
  const c = rootEl.querySelector('[data-gen-copy]');
  if (c) c.onclick = () => { navigator.clipboard.writeText(g.content); toast('Texto copiado.', 'success'); };
  const p = rootEl.querySelector('[data-gen-poster]');
  if (p) p.onclick = () => createPosterFromGeneration(g);
  const car = rootEl.querySelector('[data-gen-carousel]');
  if (car && typeof createCarouselFromGeneration === 'function') car.onclick = () => createCarouselFromGeneration(g);
  const tagsBtn = rootEl.querySelector('[data-gen-hashtags]');
  if (tagsBtn) tagsBtn.onclick = () => {
    const tags = (g.article && g.article.hashtags) || [];
    navigator.clipboard.writeText(tags.join(' '));
    toast('Hashtags copiadas.', 'success');
  };
  if (typeof wireSendTo === 'function') wireSendTo(rootEl, () => g.content || '');
}

// Bloco do PIPELINE: hashtags copiáveis + o design sugerido pelo agente.
// Só aparece para gerações do pipeline (retrocompatível: gerações antigas não
// têm `article`/`design`, então o bloco é vazio).
function pipelineExtrasHtml(g) {
  if (!g || !g.pipeline) return '';
  const tags = (g.article && g.article.hashtags) || [];
  const design = g.design;
  let html = '';
  if (design && design.templateLabel) {
    const paletteLabel = design.paletteLabel || design.palette || '';
    const fontLabel = design.fontLabel || design.font || '';
    const fontBit = fontLabel ? ` · ${escapeHtml(String(fontLabel).split(' — ')[0])}` : '';
    html += `
      <div class="design-suggest mt-2" title="${escapeHtml(design.justificativa || 'Sugestão do agente de design')}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
        <span class="text-xs">Design sugerido: <strong>${escapeHtml(design.templateLabel)}</strong> · ${escapeHtml(paletteLabel)} · ${escapeHtml(design.format || '')}${fontBit}</span>
      </div>`;
  }
  if (tags.length) {
    html += `
      <div class="hashtags-block mt-2">
        <div class="hashtags-list">${tags.map((t) => `<span class="hashtag-chip">${escapeHtml(t)}</span>`).join('')}</div>
        <button class="btn btn-ghost btn-sm" data-gen-hashtags>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copiar hashtags
        </button>
      </div>`;
  }
  return html;
}

function renderGenerationResult(g) {
  setMtab('#view-generate', 'b'); // no mobile, leva direto ao resultado
  $('#g-result-badge').innerHTML = `<span class="badge success">Gerado</span>`;
  const warnHtml = g.warnings?.length
    ? `<div class="card mb-2" style="border-color: var(--amber); background: #fbf2dc; padding: 0.75rem 1rem;">
        <div class="text-sm">${g.warnings.map(escapeHtml).join('<br>')}</div>
      </div>` : '';
  $('#g-result-area').innerHTML = `
    ${warnHtml}
    <div class="article-preview" id="g-result-content">${escapeHtml(g.content)}</div>
    ${pipelineExtrasHtml(g)}
    ${generationActionsHtml()}
    <div class="flex gap-1 flex-wrap mt-2">
      <button class="btn btn-ghost btn-sm" id="g-result-edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar
      </button>
      <button class="btn btn-danger btn-sm" id="g-result-delete" title="Excluir matéria">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      </button>
    </div>
    <div class="text-xs text-mute mt-2">
      Modelo: ${escapeHtml(g.model)}${
        g.promptTokens ? ` · Tokens: ${g.promptTokens} prompt / ${g.completionTokens} resposta` : ''
      }
    </div>
  `;
  wireGenerationActions($('#g-result-area'), g);

  // Editar inline (troca o preview por textarea + Salvar) — mesma matéria, em State.
  $('#g-result-edit').onclick = () => {
    const cur = $('#g-result-content');
    const taEl = document.createElement('textarea');
    taEl.className = 'textarea textarea-serif';
    taEl.style.minHeight = '360px';
    taEl.value = g.content;
    cur.replaceWith(taEl);
    $('#g-result-edit').outerHTML = `<button class="btn btn-primary btn-sm" id="g-result-save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg> Salvar</button>`;
    $('#g-result-save').onclick = () => {
      g.content = taEl.value;
      // O usuário reescreveu a matéria como texto livre: o `article` estruturado
      // do pipeline ficou obsoleto. Invalida-o para que cartaz/carrossel voltem a
      // ler o texto EDITADO (via parseArticle). O design sugerido segue válido.
      if (g.article) g.article = null;
      saveGenerations();
      renderGenerationResult(g);
      const drawer = $('#g-history-drawer');
      if (drawer && drawer.classList.contains('open') && typeof renderGenHistory === 'function') renderGenHistory();
      toast('Matéria atualizada.', 'success');
    };
  };
  // Excluir a matéria do histórico
  $('#g-result-delete').onclick = () => {
    if (!confirm('Remover esta matéria?')) return;
    State.generations = State.generations.filter(x => x.id !== g.id);
    saveGenerations();
    $('#g-result-badge').innerHTML = '';
    $('#g-result-area').innerHTML = `
      <div class="empty">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <div class="empty-title">Aguardando</div>
        <div class="empty-desc">A matéria gerada aparecerá aqui.</div>
      </div>`;
    if (typeof renderGenHistory === 'function') renderGenHistory();
    toast('Matéria removida.', 'success');
  };
}

/** Drawer de Histórico de matérias — dentro da ferramenta Gerar (espelha Cartazes). */
function openGenHistory() {
  if (typeof renderGenHistory === 'function') renderGenHistory();
  const d = $('#g-history-drawer'), b = $('#g-history-backdrop');
  if (d) d.classList.add('open');
  if (b) b.classList.remove('hidden');
}
function closeGenHistory() {
  const d = $('#g-history-drawer'), b = $('#g-history-backdrop');
  if (d) d.classList.remove('open');
  if (b) b.classList.add('hidden');
}
function setupGenHistory() {
  if ($('#g-history-open')) $('#g-history-open').onclick = openGenHistory;
  if ($('#g-history-close')) $('#g-history-close').onclick = closeGenHistory;
  if ($('#g-history-backdrop')) $('#g-history-backdrop').onclick = closeGenHistory;
  if (!setupGenHistory._esc) {
    setupGenHistory._esc = true;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeGenHistory(); });
  }
}

