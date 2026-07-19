'use strict';
/* ============================================================
   SERVIDORES DE APOIO — endereços em UM lugar (config editável).
   Duas ferramentas dependem de um servidor próprio:
     · VideoGrab          → videograb-server/  (Node,   porta 3000)
     · Removedor de Fundo → removedor-server/  (Python, porta 7000)

   USO LOCAL (duplo-clique / Agente.bat): nada a fazer — os endereços
   locais já funcionam como sempre.

   VERSÃO PUBLICADA (GitHub Pages etc.): publique os servidores na
   nuvem (guia: DEPLOY.md) e preencha os campos REMOTE abaixo. As
   ferramentas testam os candidatos NA ORDEM e usam o primeiro que
   responder ao ping de saúde:
     1. endereço salvo no navegador (localStorage 'agente:server:<id>')
     2. a própria origem do app (o videograb-server serve a plataforma)
     3. servidor local (PC do usuário)
     4. servidor remoto (REMOTE)
   O servidor local mantém a prioridade: quem roda tudo no PC não muda
   nada; quem abre o app publicado cai na nuvem automaticamente.
   ============================================================ */
(function () {
  // Preencha após publicar os servidores (passo a passo em DEPLOY.md). Ex.:
  //   videograb: 'https://agente-videograb.onrender.com'
  //   removedor: 'https://seu-usuario-agente-removedor.hf.space'
  const REMOTE = {
    videograb: '',
    removedor: '',
  };

  const LOCAL = {
    videograb: 'http://localhost:3000',
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
      // Mesma origem: o videograb-server serve a plataforma inteira; se o app
      // veio dele, a API mora na própria origem. (Em host estático o ping
      // falha rápido — 404 — e cai para o próximo candidato.)
      if (tool === 'videograb' && /^https?:$/.test(location.protocol)) {
        list.push(location.origin);
      }
      list.push(LOCAL[tool]);
      if (REMOTE[tool]) list.push(norm(REMOTE[tool]));
      return list.filter((u, i) => u && list.indexOf(u) === i);
    },
    // Há servidor remoto configurado? (ajusta as mensagens de status)
    hasRemote(tool) { return !!REMOTE[tool]; },
  };
})();
