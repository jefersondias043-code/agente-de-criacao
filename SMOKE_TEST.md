# Smoke test (verificação manual rápida)

Após qualquer mudança, sirva o app e confirme estes pontos (~5 min).

```
npm install        # uma vez
node scripts/static-server.mjs   # serve em http://localhost:8080
npm run verify     # lint + testes + manifesto (tudo verde) — gate único
```

`npm run verify` = `lint` (0 errors) + `vitest` (138 testes: crypto, lock, backup,
sync de chaves, handoff, saveJSON/cota, geometria e render dos 32 modelos, pipeline
de agentes — parsing/normalização/orquestração/fallbacks —, tipografia de cartaz,
os dois modos de geração, planejamento de compressão de mídia grande, heurísticas
de OCR e roteamento da transcrição) + `check-manifest` + `sync-manifest --check`
(index.html ↔ service-worker ↔ src/).
Ao mexer na lista de scripts, edite `scripts/scripts.manifest.mjs` e rode
`npm run sync:manifest`. Ao publicar, `npm run bump:version` sobe SW + build juntos.

No navegador (http://localhost:8080):

- [ ] Console mostra "Agente de Postagem … pronto." e **nenhum erro**.
- [ ] Sidebar lista as 10 seções; clicar em cada uma troca a view sem erro.
- [ ] **Gerar**: selects de Estilo (28) e Tom (22) preenchidos; contador do textarea atualiza ao digitar.
      Toggle **Modo de geração** (Agentes/Rápido) troca o botão ativo e persiste ao trocar de
      view e voltar. No modo **Agentes**, gerar mostra os 3 selos (Interpretação/Redação/Design)
      acendendo em sequência e o resultado traz hashtags copiáveis + chip "Design sugerido". No
      modo **Rápido**, gerar mostra spinner simples (sem selos) e o resultado NÃO traz hashtags
      nem chip de design (paridade com o comportamento anterior ao pipeline).
- [ ] **Narrativa**: com os campos vazios, o painel mostra **Situação** e o botão
      "Escrever conteúdo" fica **desabilitado**. Preencher desejo + obstáculo + risco vira
      **História** e libera o botão. Responder "nada" no obstáculo (ou "é só pedir ajuda")
      volta a travar — é o lema aplicado, não um bug. O diagnóstico funciona **sem chave de
      API e offline**. Trocar de ferramenta e voltar preserva o rascunho; recarregar a página
      também. Com chave configurada: "Achar a história com IA" preenche só os campos vazios,
      "Afiar com IA" reescreve as três respostas e oferece **Desfazer**, e o conteúdo gerado
      entra no histórico e na barra "Enviar para".
- [ ] **Extrair**: dropzone aparece; histórico vazio com empty-state. Aceita imagem/áudio/vídeo.
      **OCR**: uma foto com texto sobre fundo complexo é reconhecida (pré-processamento +
      limiar adaptativo); a barra de progresso avança. **Vídeo grande** (> 25 MB, com chave
      Groq configurada): a transcrição mostra "Preparando o áudio…" e, se muito longo,
      "…em ~N partes" — e conclui sem o antigo erro de "máximo 25 MB". (Mesmo pipeline
      vale em **Gerar → Anexar arquivo** e nas ferramentas embutidas via ingest.)
- [ ] **Cartazes**: "Novo cartaz" cria e renderiza o preview; editar headline atualiza ao vivo.
- [ ] **Cartazes — Editor visual** (aba Elementos): adicionar forma/badge/ícone/texto aparece no
      preview e na lista de camadas; arrastar mostra guias de alinhamento; alça de rotação gira;
      "Área segura" desenha a margem; Desfazer/Refazer (Ctrl+Z/Y) revertem; modo Simples esconde
      abas avançadas; preset de composição (aba Layout) troca modelo+tema; o PNG exportado NÃO
      mostra a moldura de seleção/guias/área segura.
- [ ] **Detector Flop**: iframe carrega `detector-flop.html` (3 abas) com tema claro aplicado.
- [ ] **AutoPost IA** e **Replicador**: iframes carregam com tema claro.
- [ ] **Configurações**: trocar provedor (Groq/OpenAI/Anthropic) atualiza a lista de modelos.
- [ ] **Dados e backup**: "Proteger com senha" cifra as chaves (status → "Protegido");
      após bloquear, `localStorage` não mostra `agp.apiKeys`/`groq_api_key`/`df_groq_key`
      em claro; "Remover proteção" volta ao normal. Exportar backup com chaves
      oferece senha; o `.json` exportado não contém a chave em texto puro.
- [ ] **Boot**: nenhuma tela "Não foi possível iniciar" (asserção de integridade de boot).
