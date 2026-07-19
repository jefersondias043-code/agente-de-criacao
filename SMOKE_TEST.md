# Smoke test (verificação manual rápida)

Após qualquer mudança, sirva o app e confirme estes pontos (~5 min).

```
npm install        # uma vez
node scripts/static-server.mjs   # serve em http://localhost:8080
npm run verify     # lint + testes + manifesto (tudo verde) — gate único
```

`npm run verify` = `lint` (0 errors) + `vitest` (52 testes: crypto, lock, backup,
sync de chaves, handoff, saveJSON/cota, geometria e render dos 32 modelos) +
`check-manifest` + `sync-manifest --check` (index.html ↔ service-worker ↔ src/).
Ao mexer na lista de scripts, edite `scripts/scripts.manifest.mjs` e rode
`npm run sync:manifest`. Ao publicar, `npm run bump:version` sobe SW + build juntos.

No navegador (http://localhost:8080):

- [ ] Console mostra "Agente de Postagem … pronto." e **nenhum erro**.
- [ ] Sidebar lista as 9 seções; clicar em cada uma troca a view sem erro.
- [ ] **Gerar**: selects de Estilo (28) e Tom (22) preenchidos; contador do textarea atualiza ao digitar.
- [ ] **Extrair**: dropzone aparece; histórico vazio com empty-state.
- [ ] **Cartazes**: "Novo cartaz" cria e renderiza o preview; editar headline atualiza ao vivo.
- [ ] **Cartazes — Editor visual** (aba Elementos): adicionar forma/badge/ícone/texto aparece no
      preview e na lista de camadas; arrastar mostra guias de alinhamento; alça de rotação gira;
      "Área segura" desenha a margem; Desfazer/Refazer (Ctrl+Z/Y) revertem; modo Simples esconde
      abas avançadas; preset de composição (aba Layout) troca modelo+tema; o PNG exportado NÃO
      mostra a moldura de seleção/guias/área segura.
- [ ] **VideoGrab**: o servidor (unificado: app + API) sobe **sozinho no login** após
      rodar **`Instalar inicio automatico.bat`** UMA vez (registra `servidor.vbs` no
      `HKCU\...\Run` com caminho curto + cria o atalho "Agente" na Área de Trabalho).
      Depois, abrir o app (ícone "Agente" / `http://localhost:3000`) já mostra
      "Servidor conectado". Iniciar manualmente agora: **`Agente.bat`** (janela visível,
      mostra erros do Node). Encerrar: `Parar Agente.vbs`. Desativar auto-início:
      `Desinstalar inicio automatico.bat`. Se o servidor cair, o card **reconecta
      sozinho** (re-ping 4s). (Dev: `npm start` em `videograb-server/`.)
- [ ] **Detector Flop**: iframe carrega `detector-flop.html` (3 abas) com tema claro aplicado.
- [ ] **AutoPost IA** e **Replicador**: iframes carregam com tema claro.
- [ ] **Configurações**: trocar provedor (Groq/OpenAI/Anthropic) atualiza a lista de modelos.
- [ ] **Dados e backup**: "Proteger com senha" cifra as chaves (status → "Protegido");
      após bloquear, `localStorage` não mostra `agp.apiKeys`/`groq_api_key`/`df_groq_key`
      em claro; "Remover proteção" volta ao normal. Exportar backup com chaves
      oferece senha; o `.json` exportado não contém a chave em texto puro.
- [ ] **Boot**: nenhuma tela "Não foi possível iniciar" (asserção de integridade de boot).
