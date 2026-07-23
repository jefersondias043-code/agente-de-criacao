'use strict';
/* ============================================================
   SERVIDORES DE APOIO — endereços em UM lugar (config editável).
   Uma ferramenta depende de um servidor próprio:
     · Removedor de Fundo → removedor-server/  (Python, porta 7000)

   (O VideoGrab NÃO usa mais servidor: virou uma ferramenta de handoff que
    abre um baixador web — funciona no celular e no GitHub Pages sem backend.)

   USO LOCAL (duplo-clique / Agente.bat): nada a fazer — o endereço
   local já funciona como sempre.

   VERSÃO PUBLICADA (GitHub Pages etc.): publique o servidor na nuvem
   (guia: DEPLOY.md) e preencha o campo REMOTE abaixo. A ferramenta testa
   os candidatos NA ORDEM e usa o primeiro que responder ao ping de saúde:
     1. endereço salvo no navegador (localStorage 'agente:server:<id>')
     2. servidor local (PC do usuário)
     3. servidor remoto (REMOTE)
   O servidor local mantém a prioridade: quem roda tudo no PC não muda
   nada; quem abre o app publicado cai na nuvem automaticamente.
   ============================================================ */
(function () {
  // Preencha após publicar o servidor (passo a passo em DEPLOY.md). Ex.:
  //   removedor: 'https://seu-usuario-agente-removedor.hf.space'
  const REMOTE = {
    removedor: '',
  };

  const LOCAL = {
    removedor: 'http://127.0.0.1:7000',
  };

  const norm = (u) => String(u || '').trim().replace(/\/+$/, '');

  window.agenteServers = {
    // Endereços a testar, na ordem de preferência (sem vazios/repetidos).
    candidates(tool) {
      const list = [];
      try {
        const saved = localStorage.getItem('agente:server:' + tool);
        if (saved) list.push(norm(saved));
      } catch (e) { /* sem storage */ }
      if (LOCAL[tool]) list.push(LOCAL[tool]);
      if (REMOTE[tool]) list.push(norm(REMOTE[tool]));
      return list.filter((u, i) => u && list.indexOf(u) === i);
    },
    // Há servidor remoto configurado? (ajusta as mensagens de status)
    hasRemote(tool) { return !!REMOTE[tool]; },
  };
})();
