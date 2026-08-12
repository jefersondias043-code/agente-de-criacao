'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

/* ============================================================
   EXTRACT — PDF/DOCX/OCR no navegador
   ============================================================ */

async function extractPdf(file) {
  // Sem a biblioteca (CDN bloqueado/offline) o erro precisa ser explicável,
  // não um ReferenceError cru que deixa o botão morto e o usuário sem pista.
  if (!(await ensureLib('pdfjsLib'))) throw new Error(libUnavailableMsg('pdfjsLib'));
  configurePdfWorker();
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
  if (!(await ensureLib('mammoth'))) throw new Error(libUnavailableMsg('mammoth'));
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value || '').trim();
}

/* ---------- OCR com PRÉ-PROCESSAMENTO (paridade com o AutoPost IA) ----------
   Antes: Tesseract cru sobre o arquivo — sofre com fundo complexo, iluminação
   irregular e fotos de 12 MP (estouro de memória no celular). Agora: reduz a
   imagem, converte pra cinza, realça o contraste e aplica LIMIAR ADAPTATIVO
   (Bradley), com fallback pra imagem original quando o tratamento não ajuda —
   nunca piora. `onProgress` recebe a PORCENTAGEM (número), como os chamadores
   da plataforma esperam. */
const OCR_MAX_DIM = 2600; // maior lado do canvas de trabalho

// Desenha a imagem num canvas, reduzida a no máx. maxDim no maior lado (só se maior).
function _ocrCanvasEscalado(img, maxDim) {
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  const maxLado = Math.max(w0, h0) || 1;
  const escala = maxLado > maxDim ? maxDim / maxLado : 1;
  const w = Math.max(1, Math.round(w0 * escala));
  const h = Math.max(1, Math.round(h0 * escala));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, w, h);
  return c;
}

// Cinza (luminância) + contraste (percentis 2/98) + limiar adaptativo (imagem
// integral → média local em O(1) por pixel). Devolve um canvas binário P/B.
function _ocrPreprocessar(base) {
  const w = base.width, h = base.height, n = w * h;
  const d = base.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const g = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const y = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) | 0;
    g[i] = y; hist[y]++;
  }
  let lo = 0, hi = 255, acc = 0; const clip = n * 0.02;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= clip) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= clip) { hi = v; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) {
    const v = (g[i] - lo) * 255 / range;
    g[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
  }
  const W1 = w + 1;
  const integ = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let soma = 0;
    for (let x = 0; x < w; x++) {
      soma += g[y * w + x];
      integ[(y + 1) * W1 + (x + 1)] = integ[y * W1 + (x + 1)] + soma;
    }
  }
  const S = Math.max(8, (Math.min(w, h) / 16) | 0);
  const T = 0.15;
  const oc = document.createElement('canvas');
  oc.width = w; oc.height = h;
  const octx = oc.getContext('2d');
  const outImg = octx.createImageData(w, h);
  const od = outImg.data;
  for (let y = 0; y < h; y++) {
    const y1 = y - S < 0 ? 0 : y - S, y2 = y + S >= h ? h - 1 : y + S;
    for (let x = 0; x < w; x++) {
      const x1 = x - S < 0 ? 0 : x - S, x2 = x + S >= w ? w - 1 : x + S;
      const conta = (x2 - x1 + 1) * (y2 - y1 + 1);
      const soma = integ[(y2 + 1) * W1 + (x2 + 1)] - integ[y1 * W1 + (x2 + 1)] - integ[(y2 + 1) * W1 + x1] + integ[y1 * W1 + x1];
      const preto = g[y * w + x] * conta <= soma * (1 - T);
      const p = (y * w + x) * 4;
      const val = preto ? 0 : 255;
      od[p] = od[p + 1] = od[p + 2] = val; od[p + 3] = 255;
    }
  }
  octx.putImageData(outImg, 0, 0);
  return oc;
}

// OCR de UM canvas → { text, conf }. Reporta o progresso como PORCENTAGEM.
async function _ocrReconhecer(canvas, onProgress) {
  if (!(await ensureLib('Tesseract'))) throw new Error(libUnavailableMsg('Tesseract'));
  const { data } = await Tesseract.recognize(canvas, 'por', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(Math.round((m.progress || 0) * 100));
    },
  });
  return { text: (data && data.text || '').trim(), conf: (data && data.confidence) || 0 };
}

// Resultado fraco? (pouco texto OU baixa confiança → vale tentar o outro caminho)
function _ocrFraco(r) {
  return !r.text || r.text.replace(/\s+/g, '').length < 12 || r.conf < 55;
}
// Melhor entre dois resultados: mais texto; empate → maior confiança.
function _ocrMelhor(a, b) {
  const la = a.text.replace(/\s+/g, '').length, lb = b.text.replace(/\s+/g, '').length;
  if (Math.abs(la - lb) > 8) return la >= lb ? a : b;
  return a.conf >= b.conf ? a : b;
}

async function extractImage(file, onProgress) {
  if (onProgress) onProgress(0);
  let img, url;
  try {
    url = URL.createObjectURL(file);
    img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('decode'));
      im.src = url;
    });
    if (!(img.naturalWidth || img.width)) throw new Error('decode');
  } catch (e) {
    if (url) URL.revokeObjectURL(url);
    throw new Error('Não foi possível abrir esta imagem neste aparelho. No iPhone, escolha a foto pela galeria (que a converte automaticamente) ou use um arquivo PNG/JPG.');
  }
  try {
    const base = _ocrCanvasEscalado(img, OCR_MAX_DIM);   // colorido (fallback)
    await new Promise(r => setTimeout(r, 0));             // deixa a UI pintar o status
    const proc = _ocrPreprocessar(base);                 // cinza + contraste + limiar
    const r1 = await _ocrReconhecer(proc, onProgress);   // 1ª tentativa: tratada
    let melhor = r1;
    if (_ocrFraco(r1)) {                                  // fallback só quando fraco
      const r2 = await _ocrReconhecer(base, onProgress);
      melhor = _ocrMelhor(r1, r2);
    }
    if (onProgress) onProgress(100);
    return (melhor.text || '').trim();
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
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
    saveExtractions();

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

    // Wake Lock durante TODO o lote: no celular a tela apagando suspende a aba e
    // trava a transcrição/OCR (mesma abordagem do AutoPost). O clique em "Extrair
    // texto" já é um gesto válido — o áudio do iOS destrava normalmente aqui.
    const processarLote = async () => {
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
            text = await transcribeMedia(file, (msg) => {
              const el = document.querySelector(`[data-mediastatus="${fileMeta.id}"]`);
              if (el && typeof msg === 'string') el.textContent = msg;
            });
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
        saveExtractions();
        renderExtractionsList();
      }
    };
    if (typeof withWakeLock === 'function') await withWakeLock(processarLote);
    else await processarLote();

    // Recompute aggregate
    extraction.text = extraction.files
      .filter(f => f.text)
      .map(f => f.text)
      .join('\n\n').trim();

    /* ORGANIZAR O QUE SAIU — o mesmo passo do Causos, do Julgador, da Narrativa
     * e do Gerar, agora também aqui.
     *
     * O que sai de um áudio é fala corrida; o que sai de um OCR vem com linha
     * quebrada no lugar errado e letra trocada. A ferramenta Extrair é a porta
     * de entrada da plataforma: entregar texto cru aqui empurra o problema para
     * todas as ferramentas seguintes.
     *
     * É MELHORIA, NÃO REQUISITO: sem chave, sem rede ou com a conferência
     * reprovando, fica o texto cru. Perder a extração por causa de um enfeite
     * seria trocar o certo pelo bonito. */
    if (extraction.text && typeof runLimpezaTranscricao === 'function'
        && typeof transcricaoVale === 'function' && transcricaoVale(extraction.text)) {
      btn.innerHTML = '<span class="spinner"></span> Organizando o texto…';
      try {
        const r = await runLimpezaTranscricao({
          texto: extraction.text,
          onProgress: (msg) => { btn.innerHTML = `<span class="spinner"></span> ${escapeHtml(msg)}`; },
        });
        if (r && r.texto) {
          extraction.textoCru = extraction.text;   // o original fica guardado
          extraction.text = r.texto;
          extraction.organizado = !!r.limpou;
        }
      } catch (_) { /* segue com o texto cru */ }
    }
    const allOk = extraction.files.every(f => f.status === 'completed');
    const allFail = extraction.files.every(f => f.status === 'failed');
    extraction.status = allOk ? 'completed' : (allFail ? 'failed' : 'partial');
    saveExtractions();

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
  // "Limpar tudo" — apaga só o histórico de extrações (mesmo padrão da Gerar).
  const clearBtn = $('#e-history-clear');
  if (clearBtn) {
    clearBtn.style.display = State.extractions.length ? '' : 'none';
    clearBtn.onclick = () => {
      if (!State.extractions.length) return;
      if (!confirm('Apagar TODO o histórico de extrações?')) return;
      State.extractions = [];
      State.activeExtractionId = null;
      saveExtractions();
      renderExtractionsList();
      renderExtractionDetail();
      toast('Histórico limpo.', 'success');
    };
  }
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

/* ----- TEXTO TRATADO E RESUMO --------------------------------------------
 *
 * A ferramenta Extrair deixou de ser só extração: ela entrega o texto tratado
 * e, a um clique, um resumo — e o que for escolhido segue para as outras
 * ferramentas pela mesma barra de envio que já existia.
 *
 * Os dois textos convivem. O resumo não substitui o tratado: quem resume para
 * mandar ao Causos muitas vezes quer o texto inteiro logo depois. */
function extractTextoAtivo(e) {
  return (e.verResumo && e.resumo) ? e.resumo : (e.text || '');
}

function extractBlocoTexto(e) {
  const temResumo = !!e.resumo;
  const mostrandoResumo = !!(e.verResumo && temResumo);
  const conteudo = mostrandoResumo ? e.resumo : e.text;
  const conf = e.resumoConferencia || null;

  /* CLASSE PRÓPRIA, não `.mtabs`. Reusei `.mtabs` na primeira versão e as abas
   * sumiram no computador: aquela é a barra de abas do CELULAR, declarada
   * `display: none` acima de 1100px. Medido no navegador — o resumo era gerado
   * e não havia como vê-lo. */
  const abas = temResumo ? `
    <div class="extract-abas" style="margin-bottom:.7rem;">
      <button type="button" class="${mostrandoResumo ? '' : 'ativa'}" data-vertexto="completo">Texto completo</button>
      <button type="button" class="${mostrandoResumo ? 'ativa' : ''}" data-vertexto="resumo">Resumo</button>
    </div>` : '';

  const aviso = (mostrandoResumo && conf && !conf.ok) ? `
    <div class="callout-warn" style="margin-bottom:.7rem;font-size:.8rem;line-height:1.5;">
      ${conf.problemas.map(escapeHtml).join('<br>')}
    </div>` : '';

  const medida = (mostrandoResumo && conf && conf.ok) ? `
    <div class="text-xs text-mute" style="margin-bottom:.5rem;">
      ${conf.palavras} palavras · ${Math.round(conf.proporcao * 100)}% do texto completo · sem nomes de pessoas
    </div>` : '';

  const botao = temResumo ? '' : `
    <div style="margin-bottom:.7rem;">
      <button type="button" class="btn btn-secondary btn-sm" id="e-resumir">✦ Resumir o conteúdo</button>
      <span class="text-xs text-mute" style="margin-left:.5rem;">Os acontecimentos essenciais, sem os nomes das pessoas.</span>
    </div>`;

  return `
    ${botao}
    ${abas}
    ${aviso}
    ${medida}
    <div style="background: var(--paper-2); border: 1px solid var(--line-soft); border-radius: var(--radius); padding: 1rem;">
      <pre class="mono" style="white-space: pre-wrap; font-size: 0.85rem; line-height: 1.6;">${escapeHtml(truncate(conteudo, 8000))}</pre>
    </div>`;
}

function extractWireResumo(e) {
  $$('#e-detail-content [data-vertexto]').forEach((b) => {
    b.onclick = () => {
      e.verResumo = b.dataset.vertexto === 'resumo';
      saveExtractions();
      renderExtractionDetail();
    };
  });

  const btn = $('#e-resumir');
  if (!btn) return;
  btn.onclick = async () => {
    if (typeof runResumoPipeline !== 'function') { toast('O resumo não está disponível.', 'error'); return; }
    const provider = (State && State.provider) || 'groq';
    if (!(State && State.apiKeys && State.apiKeys[provider])) {
      toast(`Configure a chave da API de "${provider}" nas Configurações para resumir.`, 'info', 6000);
      return;
    }
    const original = btn.innerHTML;
    btn.disabled = true;
    try {
      const r = await runResumoPipeline({
        texto: e.text,
        call: callLLM,
        onEtapa: (_k, titulo) => { btn.innerHTML = `<span class="spinner"></span> ${escapeHtml(titulo)}`; },
      });
      e.resumo = r.resumo;
      e.resumoConferencia = r.conferencia;
      e.verResumo = true;
      saveExtractions();
      renderExtractionDetail();
      toast(r.conferencia.ok
        ? `Resumo pronto — ${r.conferencia.palavras} palavras.`
        : 'Resumo pronto, mas a conferência apontou um problema — veja o aviso.',
      r.conferencia.ok ? 'success' : 'info', 6000);
    } catch (err) {
      toast(err.message || 'Não foi possível resumir.', 'error', 6000);
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  };
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
        // Mídia (áudio/vídeo) mostra uma linha de STATUS em texto (a transcrição
        // reporta mensagens — "Preparando… %", "Parte i de N" —, não porcentagem).
        const showMediaStatus = f.status === 'processing' && f.type === 'media';
        const pct = typeof f.progress === 'number' ? f.progress : 0;
        return `
          <div class="file-row" style="${(showProgress || showMediaStatus) ? 'flex-wrap: wrap;' : ''}">
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
            ${showMediaStatus ? `<div class="text-xs text-mute" data-mediastatus="${f.id}" style="flex: 1 0 100%; margin-top: 0.4rem;">Preparando…</div>` : ''}
          </div>`;
      }).join('')}
    </div>
    ${e.text ? extractBlocoTexto(e) : '<p class="text-mute text-sm">Aguardando extração…</p>'}
    ${e.text ? sendToBarHtml('extract') : ''}
  `;
  extractWireResumo(e);
  $('#e-detail-copy').onclick = () => copyTextComAviso(e.text || '', 'Texto copiado.');
  $('#e-detail-delete').onclick = () => {
    if (!confirm('Remover esta extração?')) return;
    State.extractions = State.extractions.filter(x => x.id !== e.id);
    saveExtractions();
    State.activeExtractionId = null;
    renderExtractionsList();
    wrap.classList.add('hidden');
    toast('Extração removida.', 'success');
  };
  /* O QUE VAI PARA A OUTRA FERRAMENTA é o que está à vista. Mandar sempre o
   * texto completo, com o resumo aberto na tela, seria enviar uma coisa
   * enquanto mostra outra — e o usuário só descobriria do outro lado. */
  if (typeof wireSendTo === 'function') wireSendTo($('#e-detail-content'), () => extractTextoAtivo(e));
}

