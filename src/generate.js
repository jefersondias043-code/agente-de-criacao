'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

/** Monta o objeto de geração do MODO AGENTES (pipeline de 3 agentes) — função
 *  pura, sem tocar no DOM, para poder ser testada isoladamente. */
function assembleAgentsGeneration({ style, tone, manualText, extractionId, combinedText, result, createdAt }) {
  const truncNote = combinedText.length > MAX_CONTENT_CHARS
    ? [`Conteúdo truncado de ${combinedText.length.toLocaleString('pt-BR')} para ${MAX_CONTENT_CHARS.toLocaleString('pt-BR')} caracteres.`]
    : [];
  return {
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
    optimization: result.optimization,
    agents: result.agents,
    pipeline: true,
    model: result.model,
    promptTokens: result.promptTokens || null,
    completionTokens: result.completionTokens || null,
    createdAt,
  };
}

/** Monta o objeto de geração do MODO RÁPIDO (1 chamada de IA, comportamento
 *  anterior ao pipeline) — função pura, sem tocar no DOM. */
function assembleFastGeneration({ style, tone, manualText, extractionId, built, result, createdAt }) {
  return {
    id: uuid(),
    content: cleanText(result.content),
    style, tone,
    manualText: manualText || null,
    extractionId: extractionId || null,
    sourceCharCount: built.originalCharCount,
    finalCharCount: built.finalCharCount,
    wasTruncated: built.wasTruncated,
    warnings: built.wasTruncated
      ? [`Conteúdo truncado de ${built.originalCharCount.toLocaleString('pt-BR')} para ${built.finalCharCount.toLocaleString('pt-BR')} caracteres.`]
      : [],
    pipeline: false,
    model: result.model,
    promptTokens: result.promptTokens || null,
    completionTokens: result.completionTokens || null,
    createdAt,
  };
}

/** Liga o toggle "Modo de geração" (Agentes vs Rápido) e restaura a preferência
 *  salva. 'agents' = pipeline de 3 agentes (padrão); 'fast' = 1 chamada de IA,
 *  igual ao comportamento anterior ao pipeline (sem isolamento de fatos nem
 *  revisão, mais barato e mais rápido). */
function setGenMode(mode) {
  State.genMode = (mode === 'fast') ? 'fast' : 'agents';
  try { localStorage.setItem(STORAGE_KEYS.genMode, State.genMode); } catch {}
  const host = $('#g-genmode');
  if (host) host.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === State.genMode));
}
function wireGenMode() {
  const host = $('#g-genmode');
  if (!host) return;
  host.querySelectorAll('button').forEach((b) => { b.onclick = () => setGenMode(b.dataset.mode); });
  setGenMode(State.genMode || 'agents');
}

/** Entrega o texto extraído para a pauta (append). */
function _genDeliverText(ta, text) {
  const cur = (ta.value || '').trim();
  ta.value = cur ? (cur + '\n\n' + text) : text;
  ta.dispatchEvent(new Event('input'));
}

/** É mídia (áudio/vídeo) GRANDE — acima do limite de upload direto? Nesse caso
 *  a transcrição precisa comprimir/dividir via Web Audio, que no iPhone só roda a
 *  partir de um GESTO do usuário (toque). Por isso não processamos no evento do
 *  seletor de arquivo: mostramos um botão "Transcrever" para o usuário tocar. */
function _genEhMidiaGrande(f) {
  if (!f || typeof ingestKind !== 'function' || ingestKind(f) !== 'media') return false;
  const safe = (typeof WHISPER_SAFE_BYTES === 'number') ? WHISPER_SAFE_BYTES : 23 * 1024 * 1024;
  return f.size > safe;
}

/** Roteia o arquivo anexado na Gerar. Mídia grande → cartão com botão (gesto);
 *  o resto (texto/PDF/imagem/mídia pequena) → conversão automática, como antes. */
function handleGenAttach(f, ta) {
  const pending = $('#g-attach-pending');
  if (_genEhMidiaGrande(f) && pending) {
    // Cartão pendente: o TOQUE no botão "Transcrever" é o gesto que destrava o
    // áudio no iOS (mesma lógica do botão "Gerar" do AutoPost).
    pending.innerHTML = `
      <div class="attach-card">
        <div class="attach-card-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
          <div style="min-width:0;">
            <div class="attach-card-name">${escapeHtml(f.name)}</div>
            <div class="attach-card-meta">${formatBytes(f.size)} · vídeo/áudio grande — será comprimido e transcrito</div>
          </div>
        </div>
        <div class="flex gap-1">
          <button type="button" class="btn btn-accent btn-sm" data-attach-go>Transcrever</button>
          <button type="button" class="btn btn-ghost btn-sm" data-attach-cancel title="Remover">✕</button>
        </div>
      </div>`;
    const go = pending.querySelector('[data-attach-go]');
    const cancel = pending.querySelector('[data-attach-cancel]');
    if (go) go.onclick = () => {
      pending.innerHTML = '';
      if (typeof ingestFileNative === 'function') ingestFileNative(f, (text) => _genDeliverText(ta, text));
    };
    if (cancel) cancel.onclick = () => { pending.innerHTML = ''; };
    return;
  }
  // Caminho automático (comportamento anterior) para tudo que não é mídia grande.
  if (typeof ingestFileNative === 'function') ingestFileNative(f, (text) => _genDeliverText(ta, text));
}

// ---------- Render Generate ----------
function renderGenerate() {
  // Abas mobile Pauta↔Resultado (em telas largas não têm efeito visual)
  wireMtabs('#view-generate');
  wireGenMode();
  { const p = $('#g-attach-pending'); if (p) p.innerHTML = ''; }  // limpa cartão pendente ao (re)entrar

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
      if (f) handleGenAttach(f, ta);
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

    const isFast = State.genMode === 'fast';
    $('#g-result-area').innerHTML = isFast
      ? `<div class="empty">
          <div class="spinner spinner-lg" style="color: var(--accent); border-right-color: transparent; margin: 0 auto 1rem;"></div>
          <div class="empty-title" id="g-loading-title">Gerando…</div>
          <div class="empty-desc" id="g-loading-desc">Modo rápido — 1 chamada de IA.</div>
        </div>`
      : `<div class="empty">
          <div class="spinner spinner-lg" style="color: var(--accent); border-right-color: transparent; margin: 0 auto 1rem;"></div>
          <div class="empty-title" id="g-loading-title">Iniciando pipeline…</div>
          <div class="empty-desc" id="g-loading-desc">A matéria passa por agentes especializados.</div>
          <div class="pipeline-steps" id="g-pipeline-steps">
            <span class="pipeline-step" data-step="interpret">Interpretação</span>
            <span class="pipeline-step" data-step="write">Redação</span>
            <span class="pipeline-step" data-step="edit">Revisão</span>
            <span class="pipeline-step" data-step="optimize">Otimização</span>
          </div>
        </div>`;

    // Progresso por AGENTE (só no modo Agentes): cada etapa acende seu selo.
    const onStage = (key, title, desc) => {
      const t = $('#g-loading-title'), d = $('#g-loading-desc');
      if (t) t.textContent = title;
      if (d) d.textContent = desc;
      $$('#g-pipeline-steps .pipeline-step').forEach((el) => {
        if (el.dataset.step === key) el.classList.add('active');
        else if (el.classList.contains('active')) el.classList.replace('active', 'done');
      });
    };

    try {
      const createdAt = new Date().toISOString();
      let generation;
      if (isFast) {
        const built = buildPrompt(style, tone, combinedText);
        const result = await callLLM(built.prompt);
        generation = assembleFastGeneration({ style, tone, manualText, extractionId, built, result, createdAt });
      } else {
        const result = await runContentPipeline({ content: combinedText, style, tone, onStage });
        generation = assembleAgentsGeneration({ style, tone, manualText, extractionId, combinedText, result, createdAt });
      }
      State.generations.unshift(generation);
      saveGenerations();
      toast(isFast ? 'Matéria gerada.' : 'Matéria gerada pelos agentes.', 'success');
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
        Copiar tudo
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
  if (c) c.onclick = () => {
    const temTags = !!(g.article && g.article.hashtags && g.article.hashtags.length);
    navigator.clipboard.writeText(generationFullText(g));
    toast(temTags ? 'Matéria e hashtags copiadas.' : 'Matéria copiada.', 'success');
  };
  const p = rootEl.querySelector('[data-gen-poster]');
  if (p) p.onclick = () => createPosterFromGeneration(g);
  const car = rootEl.querySelector('[data-gen-carousel]');
  if (car && typeof createCarouselFromGeneration === 'function') car.onclick = () => createCarouselFromGeneration(g);
  if (typeof wireSendTo === 'function') wireSendTo(rootEl, () => g.content || '');
}

/** Texto COMPLETO da matéria: corpo + hashtags, num bloco só.
 *
 *  As hashtags ficam fora de `g.content` de propósito — cartaz e carrossel
 *  consomem esse campo e não devem receber "#salvador" no meio do texto. Mas o
 *  usuário que vai PUBLICAR quer tudo de uma vez, então a junção acontece na
 *  hora de copiar. Mesmo padrão do AutoPost IA, onde "Copiar tudo" reúne
 *  título, legenda e hashtags num único bloco. */
function generationFullText(g) {
  const partes = [(g && g.content) || ''];
  const tags = (g && g.article && g.article.hashtags) || [];
  if (tags.length) partes.push(tags.join(' '));
  const chaves = (g && g.optimization && g.optimization.palavrasChave) || [];
  if (chaves.length) partes.push(chaves.join(', '));
  return partes.filter(Boolean).join('\n\n');
}

// Bloco do PIPELINE: a camada de DISTRIBUIÇÃO da matéria — hashtags com o
// estrato de segmentação que cada uma ocupa (ampla · assunto · nicho · local ·
// intenção) e os termos de busca. Mostrar o estrato não é enfeite: é o que
// deixa visível que a escolha foi estratégica, e não uma palavra qualquer
// tirada do texto. Tudo já vai junto no "Copiar tudo".
function pipelineExtrasHtml(g) {
  if (!g || !g.pipeline) return '';
  const opt = g.optimization || {};
  const tipadas = Array.isArray(opt.hashtags) ? opt.hashtags : [];
  const chaves = Array.isArray(opt.palavrasChave) ? opt.palavrasChave : [];
  // Gerações anteriores à camada de otimização só têm as tags sem tipo.
  const simples = (!tipadas.length && g.article && g.article.hashtags) || [];
  if (!tipadas.length && !simples.length && !chaves.length) return '';

  const rotulo = (typeof OPT_TIPO_LABEL !== 'undefined') ? OPT_TIPO_LABEL : {};
  const chips = tipadas.length
    ? tipadas.map((h) => `<span class="hashtag-chip">${
        rotulo[h.tipo] ? `<span class="tag-type">${escapeHtml(rotulo[h.tipo])}</span>` : ''
      }#${escapeHtml(h.tag)}</span>`).join('')
    : simples.map((t) => `<span class="hashtag-chip">${escapeHtml(t)}</span>`).join('');

  return `
      <div class="hashtags-block mt-2">
        <div class="hashtags-list">${chips}</div>
        ${chaves.length ? `<div class="keywords-line">
          <span class="keywords-label">Palavras-chave</span>
          <span class="keywords-text">${escapeHtml(chaves.join(', '))}</span>
        </div>` : ''}
        <span class="text-xs text-mute">Incluídas ao copiar</span>
      </div>`;
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
      // ler o texto EDITADO (via parseArticle).
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

