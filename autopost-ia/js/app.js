'use strict';
/* ============================================================
   APP — orquestração: assistente em 3 etapas, pipeline principal
   (obter texto → gerar → avaliar → refinar → salvar), delegação
   de eventos, caixa única de entrada e boot.
   ============================================================ */

// =================== DELEGAÇÃO DE EVENTOS ===================
document.addEventListener('click', (e) => {
  // Recomeçar o assistente (↺ Transcrever outro arquivo / ← Voltar)
  const resetBtn = e.target.closest('[data-wizard-reset]');
  if (resetBtn) {
    resetWizard();
    return;
  }

  // Navegação entre abas (Novo pacote / Meus pacotes)
  const viewBtn = e.target.closest('[data-view]');
  if (viewBtn) { setView(viewBtn.dataset.view); return; }

  // Excluir item — checado ANTES de abrir (o 🗑 fica dentro do card data-open-id)
  const delBtn = e.target.closest('[data-del-id]');
  if (delBtn) { excluirHistorico(delBtn.dataset.delId); return; }

  // Abrir um item do histórico
  const openBtn = e.target.closest('[data-open-id]');
  if (openBtn) { abrirHistorico(openBtn.dataset.openId); return; }

  // Voltar à lista do histórico
  if (e.target.closest('[data-hist-back]')) { voltarHistorico(); return; }

  // Editar o pacote (campos viram caixas)
  const editBtn = e.target.closest('[data-edit-id]');
  if (editBtn) {
    const card = editBtn.closest('.pkgcard');
    if (card) card.innerHTML = renderPacoteCardInner(histGet(editBtn.dataset.editId), true);
    return;
  }
  // Salvar a edição (persiste e substitui a versão anterior) — escopo no card clicado
  const saveBtn = e.target.closest('[data-save-id]');
  if (saveBtn) { salvarEdicao(saveBtn.dataset.saveId, saveBtn.closest('.pkgcard')); return; }
  // Cancelar a edição (volta ao modo exibição sem salvar)
  const cancelBtn = e.target.closest('[data-cancel-id]');
  if (cancelBtn) {
    const card = cancelBtn.closest('.pkgcard');
    if (card) card.innerHTML = renderPacoteCardInner(histGet(cancelBtn.dataset.cancelId), false);
    return;
  }

  // Avaliar potencial da transcrição (ou reanalisar). O botão fica no cabeçalho da
  // transcrição (fora do .analisecard) OU dentro do card — acha o card nos 2 casos.
  const analyzeBtn = e.target.closest('[data-analyze-id]');
  if (analyzeBtn) {
    let cardEl = analyzeBtn.closest('.analisecard');
    if (!cardEl) { const wrap = analyzeBtn.closest('.transc-wrap'); if (wrap) cardEl = wrap.querySelector('.analisecard'); }
    analisarConteudoUI(analyzeBtn.dataset.analyzeId, cardEl);
    return;
  }

  const copyBtn = e.target.closest('[data-copy-id]');
  if (copyBtn) {
    const id = copyBtn.dataset.copyId;
    const text = (window._roteiroRegistry || {})[id];
    if (!text) return;

    const showFeedback = (msg, color) => {
      const orig = copyBtn.textContent;
      copyBtn.textContent = msg;
      copyBtn.style.color = color;
      setTimeout(() => { copyBtn.textContent = orig; copyBtn.style.color = ''; }, 1800);
    };

    // Tenta clipboard API moderna primeiro
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => showFeedback('Copiado ✓', 'var(--pass)'))
        .catch(() => fallbackCopy(text, showFeedback));
    } else {
      fallbackCopy(text, showFeedback);
    }
    return;
  }

  const evalBtn = e.target.closest('[data-eval-id]');
  if (evalBtn) {
    const el = document.getElementById(evalBtn.dataset.evalId);
    if (el) {
      const colapsado = el.classList.toggle('eval-collapsed');
      evalBtn.textContent = colapsado ? 'Avaliação ▾' : 'Avaliação ▴';
    }
  }
});

// Alterna entre a tela do assistente e o histórico.
function setView(view) {
  document.querySelectorAll('#tabs .tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === view));
  const wiz = document.querySelector('.wizard');
  const hist = $('historyView');
  if (wiz) wiz.style.display = (view === 'history') ? 'none' : '';
  if (hist) hist.style.display = (view === 'history') ? '' : 'none';
  if (view === 'history') voltarHistorico();
}

// =================== PIPELINE PRINCIPAL ===================
async function run() {
  const arquivo = ($('transcricaoFile').files || [])[0];
  const textoColado = ((($('transcricaoTexto') || {}).value) || '').trim();
  if (!arquivo && !textoColado) {
    alert('Envie um arquivo de áudio, vídeo ou texto — ou cole um texto.');
    return;
  }

  // Decide a fonte. Prioridade: se há arquivo, ele manda; senão, o texto colado.
  const usarTexto = !arquivo && !!textoColado;            // texto colado na caixa
  const arquivoEhTexto = !!arquivo && ehArquivoDeTexto(arquivo); // arquivo .txt
  const fonteTexto = usarTexto || arquivoEhTexto;          // entrada já é texto (pula transcrição)
  const nomeEntrada = arquivo ? arquivo.name : 'Texto colado';

  const btn = $('generate');
  btn.disabled = true;
  btn.textContent = '⚙ Processando…';
  const out = $('output');

  // Mantém a tela ACESA durante o processamento (no celular, a tela apagando
  // no meio suspende a aba e mata a preparação/transcrição de arquivos longos).
  // Sem suporte (file://, navegadores antigos) é ignorado sem efeito.
  let wakeLock = null;
  try { if (navigator.wakeLock && window.isSecureContext) wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}

  // Avança o assistente para a etapa 2 (Processar).
  setWizardStep(2);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const stepsT = [
    { label: fonteTexto ? 'Lendo o conteúdo' : 'Transcrevendo', desc: `${nomeEntrada}${fonteTexto ? ' · texto' : ' · preparando o texto…'}`, state: 'active' },
    { label: 'Montando o pacote', desc: 'Título, legenda, hashtags e palavras-chave', state: '' },
    { label: 'Revisão de qualidade', desc: 'Conferindo cada parte do pacote', state: '' },
    { label: 'Ajuste final', desc: 'Refinamos quando dá para melhorar', state: '' }
  ];

  const aguardeBoxT = `<div class="package" style="opacity:0.6;">
      <div class="package-header">
        <div class="package-title">⚙️ Processando seu conteúdo…</div>
      </div>
      <div class="pkg-section" style="text-align:center; color: var(--ink-faded); font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.1em;">
        Montando seu pacote de publicação · isso pode levar alguns segundos
      </div>
    </div>`;
  const mostraT = (extra = aguardeBoxT) => { out.innerHTML = renderPipeline(stepsT) + extra; };
  mostraT();

  const MAX_ITER = 2; // 1 geração + no máximo 1 refino (juiz reavalia)
  const NOTA_ALVO = 80;

  try {
    // ETAPA 1: OBTER O TEXTO — transcreve mídia OU usa o texto direto (pulando a transcrição).
    let transcricao;
    if (usarTexto) {
      // Texto colado na caixa → vai direto.
      transcricao = textoColado;
      stepsT[0].state = 'done';
      stepsT[0].desc = 'Texto recebido · pulando a transcrição';
      mostraT();
    } else if (arquivoEhTexto) {
      // Arquivo de texto (.txt) → lê o conteúdo, sem transcrição.
      stepsT[0].desc = `${arquivo.name} · lendo o texto…`;
      mostraT();
      transcricao = await lerTextoArquivo(arquivo);
      stepsT[0].state = 'done';
      stepsT[0].desc = `${arquivo.name} · texto carregado`;
      mostraT();
    } else {
      // Áudio/vídeo → otimiza se passar de 25 MB (renderização em fatias +
      // divisão automática em partes quando muito longo — compatível com
      // celular) e transcreve tudo em sequência (progresso no passo 0).
      const prep = await otimizarArquivo(arquivo, (msg) => { stepsT[0].desc = msg; mostraT(); });
      if (prep.otimizado) {
        const nPartes = prep.arquivos.length;
        stepsT[0].desc = `${arquivo.name} · arquivo preparado${nPartes > 1 ? ` em ${nPartes} partes` : ''} · transcrevendo…`;
        mostraT();
      }
      transcricao = await transcreverPartes(prep.arquivos, (msg) => { stepsT[0].desc = msg; mostraT(); });
      stepsT[0].state = 'done';
      stepsT[0].desc = `${arquivo.name} · transcrição concluída`;
      mostraT();
    }

    // Garante conteúdo mínimo pra valer a geração.
    transcricao = (transcricao || '').trim();
    if (transcricao.length < 20) {
      throw new Error('O conteúdo está muito curto para gerar um pacote. Envie um áudio/vídeo com fala, ou cole um texto um pouco maior.');
    }

    // Registra o conteúdo no registry pro botão "Copiar"
    const trId = 'tr-' + Date.now();
    window._roteiroRegistry = window._roteiroRegistry || {};
    window._roteiroRegistry[trId] = transcricao;

    const buildTranscBox = () => `<div class="iteration current">
        <div class="iter-header">
          <div>
            <span class="iter-num">${fonteTexto ? 'Texto enviado' : 'Transcrição'}</span>
            ${fonteTexto ? '' : `<span style="color: var(--accent); font-size:10px; margin-left: 10px; font-family: 'JetBrains Mono', monospace; letter-spacing:0.15em;">PORTUGUÊS</span>`}
          </div>
          <div style="display:flex; gap:12px; align-items:center;">
            <button class="copy-btn" data-copy-id="${trId}">Copiar</button>
          </div>
        </div>
        <div class="script-box">${formatRoteiro(transcricao)}</div>
      </div>`;

    // Briefing pra LLM-C: o conteúdo abaixo é a ÚNICA fonte.
    const briefingTransc = {
      theme: fonteTexto
        ? '(o texto enviado abaixo é a única fonte)'
        : '(a transcrição automática do áudio/vídeo abaixo é a única fonte)',
      duration: null, tone: null, niche: '', extra: '(nenhum)', checklist: null
    };
    const contextoJuizT = `Origem do conteúdo: ${fonteTexto ? 'texto enviado diretamente pelo usuário (transcrição, roteiro ou legenda já prontos)' : 'transcrição automática de um áudio/vídeo enviado pelo usuário'}.
O conteúdo abaixo é a ÚNICA fonte — o pacote não deve inventar fatos fora dele:
"""
${transcricao}
"""`;

    // ETAPAS 2-4: GERAR → AVALIAR → REFINAR (entrega sempre a melhor versão)
    let feedback = null;
    let melhor = null;

    for (let i = 1; i <= MAX_ITER; i++) {
      // GERAR (ou refinar)
      stepsT[1].state = 'active';
      stepsT[1].desc = i === 1
        ? 'Título, legenda, hashtags e palavras-chave'
        : 'Refinando o pacote com base na revisão…';
      stepsT[2].state = '';
      mostraT(buildTranscBox());

      const pacote = await gerarPacotePublicacao(transcricao, briefingTransc, feedback);

      // AVALIAR (juiz)
      stepsT[1].state = 'done';
      stepsT[2].state = 'active';
      stepsT[2].desc = 'Conferindo título, legenda, hashtags e palavras-chave…';
      mostraT(buildTranscBox());

      const avaliacao = await avaliarPacote(pacote, contextoJuizT);
      stepsT[2].state = 'done';

      if (!melhor || avaliacao.nota_total > melhor.avaliacao.nota_total) {
        melhor = { pacote, avaliacao };
      }

      if (avaliacao.nota_total >= NOTA_ALVO) {
        stepsT[3].state = 'done';
        stepsT[3].desc = 'Pacote pronto e aprovado na revisão';
        break;
      }

      if (i < MAX_ITER) {
        // Reprovou: monta o feedback dos critérios fracos e refina.
        stepsT[3].state = 'active';
        stepsT[3].desc = 'Dá para melhorar — refinando…';
        const falhas = (avaliacao.avaliacoes || [])
          .filter(a => a.score < 7)
          .map(a => ({ ...a, nome: (RUBRICA_PACOTE.find(r => r.id === a.id) || {}).nome || a.id }));
        feedback = { nota_total: avaliacao.nota_total, falhas, pacoteAnterior: pacote };
        mostraT(buildTranscBox());
      } else {
        // Esgotou as iterações sem atingir a nota: entrega a melhor versão obtida.
        stepsT[3].state = 'done';
        stepsT[3].desc = 'Entregando a melhor versão do pacote';
      }
    }

    const aprovado = melhor.avaliacao.nota_total >= NOTA_ALVO;

    // Auto-save no histórico (biblioteca pessoal) — guarda a versão recém-gerada.
    const agora = new Date().toISOString();
    const histItem = {
      id: 'h-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      criadoEm: agora, atualizadoEm: agora,
      fileName: nomeEntrada,
      fonte: fonteTexto ? 'texto' : 'midia',
      transcricao: transcricao,
      nota: melhor.avaliacao.nota_total,
      aprovado: aprovado,
      veredito: melhor.avaliacao.veredito,
      avaliacoes: melhor.avaliacao.avaliacoes,
      pacote: melhor.pacote,
      editado: false
    };
    const histId = histAdd(histItem);
    updateHistBadge();

    // ETAPA 3 do assistente: pacote pronto (MESMA view do detalhe do histórico).
    setWizardStep(3);
    out.innerHTML = renderPipeline(stepsT) + renderItemDetail(histGet(histId), { context: 'result' });
  } catch (err) {
    stepsT[0].state = '';
    stepsT[0].desc = 'Falha na transcrição ou na geração do pacote.';
    out.innerHTML = renderPipeline(stepsT) +
      `<div class="error-box" style="margin-top:24px;">
        <strong>Não foi possível concluir</strong>
        ${escapeHtml(err && err.message)}
      </div>` +
      `<button type="button" class="btn-reset" data-wizard-reset>← Voltar e tentar outro arquivo</button>`;
  } finally {
    try { if (wakeLock) wakeLock.release(); } catch (_) {}
    btn.textContent = '⚡ Gerar pacote';
    // O botão fica oculto nas etapas 2/3; é reabilitado pelo resetWizard ao voltar à etapa 1.
  }
}

// Controla o assistente em 3 etapas (1 Enviar · 2 Processar · 3 Pacote).
function setWizardStep(n) {
  document.querySelectorAll('#stepper .step-node').forEach(node => {
    const s = parseInt(node.dataset.step, 10);
    node.classList.toggle('active', s === n);
    node.classList.toggle('done', s < n);
  });
  const upload = $('screen-upload');
  const result = $('screen-result');
  if (upload) upload.style.display = (n === 1) ? '' : 'none';
  if (result) result.style.display = (n === 1) ? 'none' : '';
}

// Volta ao início: limpa o arquivo/preview e mostra a etapa 1 (Enviar).
function resetWizard() {
  const fileInput = $('transcricaoFile');
  if (fileInput) fileInput.value = '';
  const textArea = $('transcricaoTexto');
  if (textArea) textArea.value = '';
  const out = $('output');
  if (out) out.innerHTML = '';
  const btn = $('generate');
  if (btn) { btn.disabled = true; btn.textContent = '⚡ Gerar pacote'; }
  // Restaura os estados visuais da caixa única (digitação visível, chip oculto, ✕ escondido).
  if (window._refletirEntrada) window._refletirEntrada();
  setWizardStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Etapa 1: preview do arquivo, habilitar o botão e arraste-e-solte ----
(function () {
  const fileInput = $('transcricaoFile');
  const preview   = $('transcricaoPreview');
  const nameEl    = $('transcricaoFileName');
  const sizeEl    = $('transcricaoFileSize');
  const clearBtn  = $('transcricaoClearBtn');
  const smartbox  = $('smartbox');
  const toolbar   = $('sbToolbar');
  const textClearBtn = $('textClearBtn');
  const textArea  = $('transcricaoTexto');
  const genBtn    = $('generate');
  if (!fileInput || !preview) return;

  const fmtBytes = (b) => {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
  };

  // Atualiza os estados da caixa única: arquivo anexado (chip) × área de digitação; e o botão.
  const refletir = () => {
    const f = (fileInput.files || [])[0];
    if (f) {
      // ARQUIVO anexado → mostra o chip dentro da caixa, esconde a digitação.
      nameEl.textContent = f.name;
      const ehTxt = ehArquivoDeTexto(f);
      const tipo = ehTxt ? 'texto' : (f.type || 'arquivo');
      const grande = !ehTxt && f.size > WHISPER_MAX_BYTES;
      sizeEl.innerHTML = escapeHtml(tipo) + ' · ' + fmtBytes(f.size) +
        (grande ? ' · <span style="color:var(--accent);">será preparado automaticamente</span>' : '');
      preview.style.display = 'flex';
      if (textArea) textArea.style.display = 'none';
      if (toolbar) toolbar.style.display = 'none';
      if (textClearBtn) textClearBtn.style.display = 'none';
    } else {
      // SEM arquivo → área de digitação visível; ✕ aparece quando há texto.
      preview.style.display = 'none';
      if (textArea) textArea.style.display = '';
      if (toolbar) toolbar.style.display = '';
      const temTxt = !!(textArea && textArea.value.trim());
      if (textClearBtn) textClearBtn.style.display = temTxt ? 'flex' : 'none';
    }
    const temTexto = !!(textArea && textArea.value.trim());
    if (genBtn) genBtn.disabled = !(f || temTexto);
  };

  // Texto e arquivo são alternativas: escolher um limpa o outro.
  fileInput.addEventListener('change', () => {
    if ((fileInput.files || []).length && textArea) textArea.value = '';
    refletir();
  });
  if (textArea) textArea.addEventListener('input', () => {
    if (textArea.value.trim() && (fileInput.files || []).length) fileInput.value = '';
    refletir();
  });

  // ✕ limpar o texto (canto superior da caixa).
  if (textClearBtn) {
    textClearBtn.addEventListener('click', () => {
      if (textArea) { textArea.value = ''; textArea.focus(); }
      refletir();
    });
  }

  // ✕ remover o arquivo anexado (no chip).
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.value = '';
      refletir();
    });
  }

  // Arraste-e-solte sobre a caixa inteira.
  if (smartbox) {
    ['dragenter', 'dragover'].forEach(ev =>
      smartbox.addEventListener(ev, (e) => { e.preventDefault(); smartbox.classList.add('dragover'); }));
    ['dragleave', 'dragend', 'drop'].forEach(ev =>
      smartbox.addEventListener(ev, (e) => { e.preventDefault(); smartbox.classList.remove('dragover'); }));
    smartbox.addEventListener('drop', (e) => {
      const arquivos = e.dataTransfer && e.dataTransfer.files;
      if (arquivos && arquivos.length) {
        try {
          const dt = new DataTransfer();
          dt.items.add(arquivos[0]);
          fileInput.files = dt.files;
          if (textArea) textArea.value = '';
          // Dispara o change para os interceptadores (ex.: ingestão da plataforma).
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {
          // Navegadores sem DataTransfer construtível: o botão "Anexar arquivo" ainda funciona.
        }
        refletir();
      }
    });
  }

  // Expõe pro resetWizard reaproveitar a mesma lógica de estado.
  window._refletirEntrada = refletir;

  // Estado inicial.
  refletir();
})();

// =================== BOOT ===================
$('generate').addEventListener('click', run);
initConfigUI();
setWizardStep(1);
updateHistBadge();
histHydrate();  // carrega o histórico do IndexedDB (capacidade = dispositivo)

// PWA: registra o service worker (só em http/https — file:// não suporta).
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
