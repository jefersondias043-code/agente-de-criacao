'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

/* ============================================================
   EXTRACT — PDF/DOCX/OCR no navegador
   ============================================================ */

async function extractPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(it => it.str).join(' ');
    pages.push(text);
  }
  return pages.join('\n\n').trim();
}

async function extractDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value || '').trim();
}

async function extractImage(file, onProgress) {
  // Tesseract.js v5 API
  const { data } = await Tesseract.recognize(file, 'por', {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  return (data.text || '').trim();
}

function getFileType(file) {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.includes('wordprocessingml') || name.endsWith('.docx')) return 'docx';
  if (mime.startsWith('image/') ||
      /\.(png|jpg|jpeg|bmp|gif|webp|tiff|tif)$/.test(name)) return 'image';
  if (mime === 'text/plain' || name.endsWith('.txt')) return 'text';
  if (mime.startsWith('audio/') || mime.startsWith('video/') ||
      /\.(mp3|wav|m4a|ogg|flac|aac|mp4|mpeg|mpga|webm|mov|3gp)$/.test(name)) return 'media';
  return 'other';
}

function renderExtract() {
  // Abas mobile Upload↔Resultados (em telas largas não têm efeito visual)
  wireMtabs('#view-extract');

  const dropzone = $('#e-dropzone');
  const fileInput = $('#e-file-input');
  const filesEl = $('#e-files');

  dropzone.onclick = () => fileInput.click();
  dropzone.ondragover = e => { e.preventDefault(); dropzone.classList.add('drag'); };
  dropzone.ondragleave = () => dropzone.classList.remove('drag');
  dropzone.ondrop = e => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    addFiles(Array.from(e.dataTransfer.files));
  };
  fileInput.onchange = () => {
    addFiles(Array.from(fileInput.files));
    fileInput.value = '';
  };

  function addFiles(files) {
    State.selectedFiles = State.selectedFiles.concat(files).slice(0, 10);
    renderSelected();
  }

  function renderSelected() {
    const hint = $('#e-submit-hint');
    if (!State.selectedFiles.length) {
      filesEl.innerHTML = '';
      $('#e-submit').disabled = true;
      if (hint) hint.textContent = 'Selecione arquivos para começar';
      return;
    }
    filesEl.innerHTML = State.selectedFiles.map((f, i) => `
      <div class="file-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div class="flex-1">
          <div class="file-name">${escapeHtml(f.name)}</div>
        </div>
        <span class="file-size">${formatBytes(f.size)}</span>
        <button class="btn btn-icon btn-ghost btn-sm" data-rm="${i}">×</button>
      </div>
    `).join('');
    filesEl.querySelectorAll('[data-rm]').forEach(b => {
      b.onclick = () => {
        State.selectedFiles.splice(parseInt(b.dataset.rm), 1);
        renderSelected();
      };
    });
    $('#e-submit').disabled = false;
    if (hint) {
      const n = State.selectedFiles.length;
      hint.textContent = `${n} arquivo${n>1?'s':''} pronto${n>1?'s':''} · ⌘/Ctrl + Enter`;
    }
  }

  $('#e-submit').onclick = async () => {
    if (!State.selectedFiles.length) return;
    const title = $('#e-title').value.trim();
    const extraction = {
      id: uuid(),
      title: title || null,
      status: 'processing',
      text: '',
      files: State.selectedFiles.map(f => ({
        id: uuid(),
        name: f.name,
        size: f.size,
        type: getFileType(f),
        status: 'pending',
        text: null,
        error: null,
      })),
      createdAt: new Date().toISOString(),
    };
    State.extractions.unshift(extraction);
    saveJSON(STORAGE_KEYS.extractions, State.extractions);

    const btn = $('#e-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processando…';

    const filesToProcess = State.selectedFiles.slice();
    State.selectedFiles = [];
    $('#e-title').value = '';
    renderSelected();
    State.activeExtractionId = extraction.id;
    renderExtractionsList();
    renderExtractionDetail();

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const fileMeta = extraction.files[i];
      fileMeta.status = 'processing';
      fileMeta.progress = 0;
      renderExtractionsList();
      renderExtractionDetail();
      try {
        let text = '';
        if (fileMeta.type === 'pdf') {
          text = await extractPdf(file);
        } else if (fileMeta.type === 'docx') {
          text = await extractDocx(file);
        } else if (fileMeta.type === 'image') {
          text = await extractImage(file, (pct) => {
            fileMeta.progress = pct;
            const bar = document.querySelector(`[data-progress="${fileMeta.id}"]`);
            if (bar) {
              bar.style.width = pct + '%';
              const lbl = bar.parentElement?.nextElementSibling;
              if (lbl) lbl.textContent = pct + '%';
            }
          });
        } else if (fileMeta.type === 'text') {
          text = await readTextFile(file);
        } else if (fileMeta.type === 'media') {
          text = await transcribeMedia(file, () => {});
        } else {
          throw new Error('Tipo não suportado');
        }
        fileMeta.text = text;
        fileMeta.status = 'completed';
        fileMeta.progress = 100;
      } catch (err) {
        fileMeta.status = 'failed';
        fileMeta.error = err.message;
        toast(`Falha ao extrair ${file.name}: ${err.message}`, 'error');
      }
      saveJSON(STORAGE_KEYS.extractions, State.extractions);
      renderExtractionsList();
    }

    // Recompute aggregate
    extraction.text = extraction.files
      .filter(f => f.text)
      .map(f => f.text)
      .join('\n\n').trim();
    const allOk = extraction.files.every(f => f.status === 'completed');
    const allFail = extraction.files.every(f => f.status === 'failed');
    extraction.status = allOk ? 'completed' : (allFail ? 'failed' : 'partial');
    saveJSON(STORAGE_KEYS.extractions, State.extractions);

    btn.disabled = false;
    btn.innerHTML = 'Extrair texto';
    State.activeExtractionId = extraction.id;
    renderExtractionsList();
    renderExtractionDetail();
    toast('Extração concluída.', 'success');
  };

  renderExtractionsList();
  if (State.activeExtractionId) renderExtractionDetail();
  setMtab('#view-extract', 'a'); // entrar na ferramenta começa no Upload
}

function renderExtractionsList() {
  const listEl = $('#e-history');
  if (!State.extractions.length) {
    listEl.innerHTML = `
      <div class="empty">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="empty-title">Nenhuma extração ainda</div>
        <div class="empty-desc">Faça upload de um arquivo para começar.</div>
      </div>`;
    return;
  }
  listEl.innerHTML = `<div class="list">` + State.extractions.map(e => {
    const statusBadge = {
      completed: '<span class="badge success">Concluído</span>',
      processing: '<span class="badge warn">Processando</span>',
      failed: '<span class="badge danger">Falhou</span>',
      partial: '<span class="badge warn">Parcial</span>',
      pending: '<span class="badge">Aguardando</span>',
    }[e.status] || '';
    return `
      <div class="list-item ${State.activeExtractionId === e.id ? 'active' : ''}" data-eid="${e.id}">
        <div class="list-item-header">
          <div class="list-item-title">${escapeHtml(e.title || `${e.files.length} arquivo(s)`)}</div>
          ${statusBadge}
        </div>
        <div class="list-item-meta">
          <span>${formatDate(e.createdAt)}</span>
          <span>·</span>
          <span>${(e.text || '').length.toLocaleString('pt-BR')} chars</span>
        </div>
      </div>`;
  }).join('') + `</div>`;

  listEl.querySelectorAll('[data-eid]').forEach(el => {
    el.onclick = () => {
      State.activeExtractionId = el.dataset.eid;
      renderExtractionsList();
      renderExtractionDetail();
    };
  });
}

function renderExtractionDetail() {
  const e = State.extractions.find(x => x.id === State.activeExtractionId);
  const wrap = $('#e-detail');
  if (!e) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  setMtab('#view-extract', 'b'); // no mobile, leva direto ao resultado
  $('#e-detail-title').textContent = e.title || `Detalhes da extração`;
  $('#e-detail-content').innerHTML = `
    <div class="flex flex-col gap-1 mb-2">
      ${e.files.map(f => {
        const statusIcon = {
          completed: '<span class="badge success">OK</span>',
          processing: '<span class="badge warn"><span class="spinner" style="width: 10px; height: 10px;"></span> Processando</span>',
          failed: '<span class="badge danger">Falhou</span>',
          pending: '<span class="badge">Aguardando</span>',
        }[f.status] || '';
        const showProgress = f.status === 'processing' && f.type === 'image';
        const pct = typeof f.progress === 'number' ? f.progress : 0;
        return `
          <div class="file-row" style="${showProgress ? 'flex-wrap: wrap;' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div class="flex-1 file-name">${escapeHtml(f.name)}</div>
            <span class="file-size">${(f.text || '').length.toLocaleString('pt-BR')} chars</span>
            ${statusIcon}
            ${showProgress ? `
              <div style="flex: 1 0 100%; display: flex; align-items: center; gap: 0.6rem; margin-top: 0.4rem;">
                <div style="flex: 1; height: 6px; background: var(--line); border-radius: 3px; overflow: hidden;">
                  <div data-progress="${f.id}" style="height: 100%; width: ${pct}%; background: var(--accent); transition: width 0.2s linear;"></div>
                </div>
                <span class="mono text-xs text-mute" style="min-width: 36px; text-align: right;">${pct}%</span>
              </div>` : ''}
          </div>`;
      }).join('')}
    </div>
    ${e.text ? `
      <div style="background: var(--paper-2); border: 1px solid var(--line-soft); border-radius: var(--radius); padding: 1rem;">
        <pre class="mono" style="white-space: pre-wrap; font-size: 0.85rem; line-height: 1.6;">${escapeHtml(truncate(e.text, 8000))}</pre>
      </div>` : '<p class="text-mute text-sm">Aguardando extração…</p>'}
    ${e.text ? sendToBarHtml('extract') : ''}
  `;
  $('#e-detail-copy').onclick = () => {
    navigator.clipboard.writeText(e.text || '');
    toast('Texto copiado.', 'success');
  };
  $('#e-detail-delete').onclick = () => {
    if (!confirm('Remover esta extração?')) return;
    State.extractions = State.extractions.filter(x => x.id !== e.id);
    saveJSON(STORAGE_KEYS.extractions, State.extractions);
    State.activeExtractionId = null;
    renderExtractionsList();
    wrap.classList.add('hidden');
    toast('Extração removida.', 'success');
  };
  if (typeof wireSendTo === 'function') wireSendTo($('#e-detail-content'), () => e.text || '');
}

