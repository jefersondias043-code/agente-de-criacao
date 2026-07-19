'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

/* ============================================================
   HISTÓRICO DE GERAÇÃO — agora DENTRO da ferramenta Gerar (drawer lateral).
   A página global foi removida (r44). renderGenHistory() popula a LISTA do
   drawer (#g-history-list); clicar um item carrega a matéria no #g-result-area
   (renderGenerationResult), onde ela é vista/editada/excluída. "Limpar tudo"
   e o × por item zeram/removem de State.generations.
   ============================================================ */

function renderGenHistory() {
  const list = $('#g-history-list');
  if (!list) return;

  const clearBtn = $('#g-history-clear');
  if (clearBtn) clearBtn.onclick = () => {
    if (!State.generations.length) return;
    if (!confirm('Apagar TODO o histórico de matérias?')) return;
    State.generations = [];
    saveGenerations();
    renderGenHistory();
    toast('Histórico limpo.', 'success');
  };

  if (!State.generations.length) {
    list.innerHTML = `
      <div class="empty" style="padding: 1.75rem 0.5rem;">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="empty-title">Nenhuma matéria ainda</div>
        <div class="empty-desc">As matérias geradas aparecerão aqui.</div>
      </div>`;
    return;
  }

  list.innerHTML = State.generations.map(g => `
    <div class="list-item" data-gid="${g.id}">
      <button class="list-item-del" data-del="${g.id}" type="button" title="Excluir matéria" aria-label="Excluir">×</button>
      <div class="list-item-title">${escapeHtml(truncate(g.content, 90))}</div>
      <div class="list-item-meta">
        <span class="badge" style="font-size: 0.65rem;">${escapeHtml(g.style)}</span>
        <span class="badge" style="font-size: 0.65rem;">${escapeHtml(g.tone)}</span>
        <span>${formatDate(g.createdAt)}</span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-gid]').forEach(el => {
    el.onclick = (e) => {
      if (e.target.closest('[data-del]')) return;          // o × não seleciona
      const g = State.generations.find(x => x.id === el.dataset.gid);
      if (g && typeof renderGenerationResult === 'function') renderGenerationResult(g);
      if (typeof closeGenHistory === 'function') closeGenHistory();
      const main = document.querySelector('.main'); if (main) main.scrollTo({ top: 0, behavior: 'auto' });
    };
  });
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (!confirm('Remover esta matéria?')) return;
      State.generations = State.generations.filter(x => x.id !== btn.dataset.del);
      saveGenerations();
      renderGenHistory();
      toast('Matéria removida.', 'success');
    };
  });
}

