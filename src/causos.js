'use strict';
/* ============================================================================
 * CAUSOS — a ferramenta (estado, tela e histórico)
 *
 * A mesa de contadores mora em src/causos-motor.js. Aqui fica o de sempre: um
 * campo, um botão, o resultado e a memória do que já foi contado.
 *
 * A tela é um campo só, como nas outras ferramentas. O gênero NÃO é perguntado:
 * quem decide se aquilo é história de pescador, assombração ou caso engraçado é
 * a etapa de concepção, lendo a ideia. Perguntar seria devolver ao usuário uma
 * decisão que a mesa toma melhor — e cada campo a mais é uma razão a menos para
 * usar a ferramenta.
 * ========================================================================== */

let _causosWired = false;
let _causoResultadoVisivel = false;

function causosDraft() {
  if (!State.causoDraft) State.causoDraft = { ideia: '' };
  return State.causoDraft;
}
function saveCausoDraft() {
  saveJSON(STORAGE_KEYS.causoDraft, State.causoDraft || { ideia: '' });
}
function saveCausos() {
  saveJSON(STORAGE_KEYS.causos, State.causos || []);
}

/** A memória da mesa: o que já foi contado, em forma. */
function causoMemoriaAtual() {
  return causoMemoriaDe(State.causos || []);
}

/* ----- Resultado ----- */

function causoLimparResultado() {
  _causoResultadoVisivel = false;
  const badge = $('#c-result-badge');
  if (badge) badge.innerHTML = '';
  const area = $('#c-result-area');
  if (!area) return;
  area.innerHTML = `
    <div class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div class="empty-title">Aguardando</div>
      <div class="empty-desc">Diga a ideia acima — "uma história de pescador sobre um peixe impossível" já basta — e a mesa cuida do resto.</div>
    </div>`;
}

/** Como a mesa avaliou. Fica recolhido: quem quer a história não quer a ata,
 *  mas quem recebeu um causo fraco precisa poder ver onde ele falhou — e agir.
 *
 *  `opcoes.aberto` mantém a ata aberta depois de re-renderizar: quem clicou num
 *  botão de dentro dela não pode ver o painel se fechar na própria cara. */
function causoPainelDaMesa(item, opcoes) {
  const o = opcoes || {};
  const j = item.juizo || {};
  const avaliadas = j.avaliadas || [];
  if (!avaliadas.length) return '';
  const linhas = avaliadas.slice().sort((a, b) => a.nota - b.nota).map((a) => {
    const dim = causoDimensao(a.dimensao);
    const reprovada = a.nota < a.minimo;
    return `
      <div class="causo-nota ${reprovada ? 'causo-nota-baixa' : ''}">
        <span class="causo-nota-dim">${escapeHtml(dim ? dim.pergunta : a.dimensao)}</span>
        <span class="causo-nota-valor">${a.nota}/10</span>
        ${reprovada && a.problema ? `<span class="causo-nota-porque">${escapeHtml(a.problema)}</span>` : ''}
      </div>`;
  }).join('');
  const especialistas = (item.criticas || []).map((c) => (CAUSO_CRITICOS[c.critico] || {}).label || c.critico);
  const reprovadas = (j.ordens || []).length;

  /* A ata dizia o que ficou fraco e parava aí: para agir sobre o diagnóstico, a
   * única saída era gerar outro causo do zero, jogando fora o texto bom. Daqui
   * a revisão parte do TEXTO QUE ESTÁ NA TELA. */
  const acoes = reprovadas ? `
      <div class="causo-mesa-acoes">
        <div class="text-xs text-mute">
          A revisão parte do causo que está aí — não da sua ideia — e mexe só ${reprovadas === 1 ? 'nesse ponto' : `nesses ${reprovadas} pontos`}. Depois a mesa lê de novo.
        </div>
        <div class="flex gap-1 flex-wrap">
          <button class="btn btn-sm" id="c-revisar" type="button">
            Revisar ${reprovadas === 1 ? 'o ponto fraco' : `os ${reprovadas} pontos fracos`}
          </button>
          ${item.anterior ? '<button class="btn btn-ghost btn-sm" id="c-desfazer" type="button">Desfazer revisão</button>' : ''}
        </div>
      </div>` : (item.anterior ? `
      <div class="causo-mesa-acoes">
        <div class="text-xs text-mute">Nada reprovado agora.</div>
        <button class="btn btn-ghost btn-sm" id="c-desfazer" type="button">Desfazer revisão</button>
      </div>` : '');

  return `
    <details class="causo-mesa"${o.aberto ? ' open' : ''}>
      <summary>Como a mesa avaliou${j.aprovado ? '' : ' · entregue com ressalva'}</summary>
      <div class="causo-mesa-body">
        <div class="text-xs text-mute mb-1">Leram: ${escapeHtml(especialistas.join(' · '))}. A nota que vale é a mais baixa — média não esconde defeito.</div>
        ${linhas}
        ${acoes}
      </div>
    </details>`;
}

/* A REVISÃO A PEDIDO.
 *
 * Uma armadilha que só aparece aqui: o causo em revisão JÁ ESTÁ no histórico, e
 * o histórico é a memória da mesa. Sem tirar o próprio item da memória, o
 * crítico de originalidade compararia o texto com ele mesmo e acusaria
 * "abertura repetida" em toda revisão — falso positivo garantido, criado pela
 * própria arquitetura. */
function causoMemoriaExceto(id) {
  return causoMemoriaDe((State.causos || []).filter((x) => x && x.id !== id));
}

async function revisarCausoAtual(item) {
  const btn = $('#c-revisar');
  if (!btn || btn.disabled) return;
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> A mesa revisa…';
  const dsc = $('#c-revisar-status');

  try {
    const antes = {
      conteudo: item.conteudo, juizo: item.juizo,
      criticas: item.criticas, assinatura: item.assinatura,
    };
    const res = await revisarCausoExistente({
      texto: item.conteudo,
      dossie: item.dossie,
      ordens: (item.juizo && item.juizo.ordens) || [],
      juizoAnterior: item.juizo,
      memoria: causoMemoriaExceto(item.id),
      call: callLLM,
      onEtapa: (_k, titulo) => { if (dsc) dsc.textContent = titulo; },
    });

    // Um passo atrás, como o "Desfazer" da Narrativa. Guardar a cadeia inteira
    // seria histórico de versões — outra funcionalidade, com outra tela.
    item.anterior = antes;
    item.conteudo = res.conteudo;
    item.juizo = res.juizo;
    item.criticas = res.criticas;
    // A assinatura alimenta a memória da mesa: deixá-la para trás guardaria a
    // abertura de uma versão que não existe mais.
    item.assinatura = res.assinatura;
    item.revisoes = (item.revisoes || 0) + 1;
    item.atualizadoEm = new Date().toISOString();
    saveCausos();
    renderCausoResultado(item, { mesaAberta: true });
    renderCausoHistorico();

    const pior = (res.juizo.reprovadas || [])[0];
    if (res.juizo.aprovado) {
      toast('Revisado — a mesa aprovou.', 'success', 6000);
    } else if (res.melhorou) {
      toast(`Revisado. Melhorou, mas ${pior ? pior.dimensao : 'um ponto'} ainda está em ${pior ? pior.nota : '?'}/10.`, 'success', 7000);
    } else {
      toast(`A revisão não melhorou${pior ? `: ${pior.dimensao} continua em ${pior.nota}/10` : ''}. Dá para desfazer.`, 'info', 8000);
    }
  } catch (err) {
    toast(err.message || 'Não foi possível revisar.', 'error', 6000);
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function desfazerRevisaoCauso(item) {
  const a = item.anterior;
  if (!a) return;
  item.conteudo = a.conteudo;
  item.juizo = a.juizo;
  item.criticas = a.criticas;
  item.assinatura = a.assinatura;
  item.anterior = null;
  item.revisoes = Math.max(0, (item.revisoes || 1) - 1);
  saveCausos();
  renderCausoResultado(item, { mesaAberta: true });
  renderCausoHistorico();
  toast('Versão anterior restaurada.', 'success');
}

function renderCausoResultado(item, opcoes) {
  const o = opcoes || {};
  const area = $('#c-result-area');
  if (!area) return;
  _causoResultadoVisivel = true;
  const badge = $('#c-result-badge');
  const j = item.juizo || {};
  if (badge) {
    badge.innerHTML = j.aprovado
      ? '<span class="badge success">A mesa aprovou</span>'
      : `<span class="badge">Melhor versão · ${j.pior || 0}/100</span>`;
  }
  area.innerHTML = `
    <div class="article-preview" id="c-result-content">${escapeHtml(item.conteudo)}</div>
    <div class="flex gap-1 flex-wrap mt-2">
      <button class="btn btn-ghost btn-sm" id="c-result-copy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copiar
      </button>
      <button class="btn btn-ghost btn-sm" id="c-result-del" title="Excluir" aria-label="Excluir">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
    ${causoPainelDaMesa(item, { aberto: !!o.mesaAberta })}
    <div class="text-xs text-mute mt-2" id="c-revisar-status">${escapeHtml((causoGenero(item.dossie && item.dossie.genero).label) + (item.dossie && item.dossie.estrutura ? ' · ' + item.dossie.estrutura : '') + (item.revisoes ? ` · revisado ${item.revisoes}×` : ''))}</div>`;

  const revisar = $('#c-revisar');
  if (revisar) revisar.onclick = () => revisarCausoAtual(item);
  const desfazer = $('#c-desfazer');
  if (desfazer) desfazer.onclick = () => desfazerRevisaoCauso(item);

  const copy = $('#c-result-copy');
  if (copy) copy.onclick = () => copyText(item.conteudo).then(() => toast('Copiado.', 'success'));
  const del = $('#c-result-del');
  if (del) del.onclick = () => {
    if (!confirm('Excluir este causo?')) return;
    State.causos = (State.causos || []).filter((x) => x.id !== item.id);
    saveCausos();
    causoLimparResultado();
    renderCausoHistorico();
    toast('Removido.', 'success');
  };
}

/* ----- Histórico ----- */

function renderCausoHistorico() {
  const lista = $('#c-history-list');
  if (!lista) return;
  const itens = State.causos || [];
  if (!itens.length) {
    lista.innerHTML = '<div class="text-sm text-mute" style="padding:0.5rem;">Nada contado ainda.</div>';
    return;
  }
  lista.innerHTML = itens.map((it) => `
    <div class="list-item" data-causo-id="${escapeHtml(it.id)}" role="button" tabindex="0">
      <div class="list-item-header">
        <div class="list-item-title">${escapeHtml((it.dossie && it.dossie.titulo) || 'Causo')}</div>
        <button class="list-item-del" data-causo-del="${escapeHtml(it.id)}" title="Excluir" aria-label="Excluir">✕</button>
      </div>
      <div class="list-item-meta">${escapeHtml(causoGenero(it.dossie && it.dossie.genero).label)} · ${escapeHtml(formatDate(it.createdAt))}</div>
    </div>`).join('');

  lista.querySelectorAll('[data-causo-id]').forEach((el) => {
    const abrir = () => {
      const it = (State.causos || []).find((x) => x.id === el.dataset.causoId);
      if (!it) return;
      renderCausoResultado(it);
      const d = causosDraft();
      d.ideia = it.ideia || d.ideia;
      saveCausoDraft();
      const campo = $('#c-ideia');
      if (campo) campo.value = d.ideia;
      fecharCausoHistorico();
    };
    el.onclick = (e) => { if (!e.target.closest('[data-causo-del]')) abrir(); };
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } };
  });
  lista.querySelectorAll('[data-causo-del]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      State.causos = (State.causos || []).filter((x) => x.id !== b.dataset.causoDel);
      saveCausos();
      renderCausoHistorico();
    };
  });
}

function abrirCausoHistorico() {
  renderCausoHistorico();
  const d = $('#c-history-drawer'), b = $('#c-history-backdrop');
  if (d) d.classList.add('open');
  if (b) b.classList.remove('hidden');
}
function fecharCausoHistorico() {
  const d = $('#c-history-drawer'), b = $('#c-history-backdrop');
  if (d) d.classList.remove('open');
  if (b) b.classList.add('hidden');
}

/* ----- Montagem da tela ----- */

function renderCausos() {
  { const p = $('#c-attach-pending'); if (p) p.innerHTML = ''; }

  const campo = $('#c-ideia');
  if (campo) campo.value = causosDraft().ideia || '';

  // Aviso de chave de API — a mesa inteira depende dela.
  const aviso = $('#c-api-warning');
  if (aviso) {
    const temChave = !!(State.settings && State.settings.groqKey);
    aviso.classList.toggle('hidden', temChave);
    if (!temChave) {
      aviso.innerHTML = `
        <div class="flex gap-2" style="align-items:flex-start;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="flex:none;margin-top:2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div style="flex:1;">
            <div class="font-semibold">Configure sua chave de API</div>
            <div class="text-sm text-soft">A mesa de contadores precisa da chave da Groq para trabalhar.</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-go="settings">Configurar</button>
        </div>`;
    }
  }

  if (!_causosWired) {
    _causosWired = true;

    if (campo) {
      campo.addEventListener('input', () => {
        causosDraft().ideia = campo.value;
        saveCausoDraft();
        // A história na tela pertence à ideia que a gerou — trocar a ideia
        // retira o causo anterior, que continua guardado no histórico.
        if (_causoResultadoVisivel) causoLimparResultado();
      });
    }

    // Anexar arquivo — mesmo pipeline das outras ferramentas.
    const inp = $('#c-attach-input'), btnAnexo = $('#c-attach-btn');
    if (inp && btnAnexo) {
      if (typeof INGEST_ACCEPT !== 'undefined') inp.accept = INGEST_ACCEPT;
      btnAnexo.onclick = () => inp.click();
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (f && typeof ingestFileNative === 'function') {
          ingestFileNative(f, (texto) => {
            const cur = (campo.value || '').trim();
            campo.value = cur ? (cur + '\n\n' + texto) : texto;
            campo.dispatchEvent(new Event('input', { bubbles: true }));
          });
        }
        inp.value = '';
      };
    }

    if ($('#c-history-open')) $('#c-history-open').onclick = abrirCausoHistorico;
    if ($('#c-history-close')) $('#c-history-close').onclick = fecharCausoHistorico;
    if ($('#c-history-backdrop')) $('#c-history-backdrop').onclick = fecharCausoHistorico;
    if ($('#c-history-clear')) $('#c-history-clear').onclick = () => {
      if (!(State.causos || []).length) return;
      if (!confirm('Apagar todos os causos guardados? A mesa perde também a memória do que já contou.')) return;
      State.causos = [];
      saveCausos();
      renderCausoHistorico();
      toast('Histórico limpo.', 'success');
    };

    if ($('#c-submit')) $('#c-submit').onclick = async () => {
      const ideia = String((campo && campo.value) || '').trim();
      if (ideia.length < 8) {
        toast('Diga a ideia — uma linha já basta.', 'info', 5000);
        return;
      }

      const btn = $('#c-submit');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> A mesa trabalha…';
      $('#c-result-area').innerHTML = `
        <div class="empty">
          <div class="spinner spinner-lg" style="color: var(--accent); border-right-color: transparent; margin: 0 auto 1rem;"></div>
          <div class="empty-title" id="c-loading-title">Procurando a história…</div>
          <div class="empty-desc" id="c-loading-desc">Quatro caminhos possíveis para essa ideia.</div>
          <div class="pipeline-steps" id="c-pipeline">
            <span class="pipeline-step" data-step="conceitos">Conceitos</span>
            <span class="pipeline-step" data-step="dossie">Mesa</span>
            <span class="pipeline-step" data-step="contar">Contar</span>
            <span class="pipeline-step" data-step="criticos">Críticos</span>
            <span class="pipeline-step" data-step="reescrita">Revisão</span>
          </div>
        </div>`;
      const onEtapa = (chave, titulo, desc) => {
        const t = $('#c-loading-title'), dsc = $('#c-loading-desc');
        if (t) t.textContent = titulo;
        if (dsc) dsc.textContent = desc;
        $$('#c-pipeline .pipeline-step').forEach((el) => {
          if (el.dataset.step === chave) el.classList.add('active');
          else if (el.classList.contains('active')) el.classList.replace('active', 'done');
        });
      };

      try {
        const res = await runCausoPipeline({
          ideia, memoria: causoMemoriaAtual(), onEtapa, call: callLLM,
        });
        const item = {
          id: uuid(),
          createdAt: new Date().toISOString(),
          ideia,
          conteudo: res.conteudo,
          dossie: res.dossie,
          juizo: res.juizo,
          criticas: res.criticas,
          conceitos: res.conceitos,
          assinatura: res.assinatura,
          etapas: res.etapas,
          model: res.model,
        };
        State.causos = State.causos || [];
        State.causos.unshift(item);
        saveCausos();
        renderCausoResultado(item);
        renderCausoHistorico();
        toast(res.juizo && res.juizo.aprovado ? 'Causo pronto — a mesa aprovou.' : 'Causo pronto.', 'success');
      } catch (err) {
        toast(err.message || 'Não foi possível contar o causo.', 'error', 6000);
        $('#c-result-area').innerHTML = `
          <div class="empty">
            <div class="empty-title">Erro</div>
            <div class="empty-desc">${escapeHtml(err.message || 'Tente novamente.')}</div>
          </div>`;
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    };
  }

  if (!_causoResultadoVisivel) causoLimparResultado();
  renderCausoHistorico();
}
