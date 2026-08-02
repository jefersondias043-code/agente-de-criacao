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
- [ ] **Narrativa — elenco**: "Adicionar personagem" cria a linha e já foca o nome; digitar não
      perde o foco. Personagem sem desejo declarado vira aviso (nunca trava — os três portões
      continuam sendo do protagonista). Trocar o formato muda o limite de elenco (Reels avisa
      com 3 personagens; vídeo longo, não). O formato **Diálogo** cobra pelo menos um personagem.
      Recarregar a página e reabrir do histórico devolvem o elenco inteiro.
- [ ] **Gerar — Comentários**: o seletor tem 4 opções e começa em "Sem comentários"; trocar
      atualiza a legenda e a escolha sobrevive ao recarregar. Com uma direção ativa, o resultado
      e o histórico ganham o selo "Comentários: …". Gerando com **Negativos** sobre uma pauta
      elogiosa, a matéria mantém o tom escolhido no relato e traz crítica ancorada nos fatos
      (inclusive apontando o que a pauta não informa) — sem xingar pessoas nem afirmar crime.
      Voltando para "Sem comentários", a matéria sai como antes.
      **A direção precisa ser respeitada**: com Negativos sobre pauta elogiosa, nenhum comentário
      pode sair celebrando; com Positivos, nenhum pode virar cobrança; com Ambos, os dois lados
      têm de aparecer. Se a IA desviar da direção (ou não comentar), a matéria vem com aviso
      âmbar dizendo exatamente o que faltou, em vez de sair em silêncio.
      **Intensidade**: o comentário tem de soar como veredito, não como observação. Lendo só as
      frases de comentário em sequência, deve dar para dizer de que lado a matéria está. Se
      saírem mornas ("o material não informa o custo" e pouco mais), o modelo copiou o registro
      fraco — gerar de novo ou trocar por um modelo maior.
- [ ] **Extrair**: dropzone aparece; histórico vazio com empty-state. Aceita imagem/áudio/vídeo.
      **OCR**: uma foto com texto sobre fundo complexo é reconhecida (pré-processamento +
      limiar adaptativo); a barra de progresso avança. **Vídeo grande** (> 25 MB, com chave
      Groq configurada): a transcrição mostra "Preparando o áudio…" e, se muito longo,
      "…em ~N partes" — e conclui sem o antigo erro de "máximo 25 MB". (Mesmo pipeline
      vale em **Gerar → Anexar arquivo** e nas ferramentas embutidas via ingest.)
- [ ] **Cartazes**: "Novo cartaz" cria e renderiza o preview; editar headline atualiza ao vivo.
- [ ] **Cartazes — Redes sociais (área segura)**: a aba "Redes sociais" do seletor de modelos traz
      6 modelos; escolher um deles muda o formato para 9:16 automaticamente (com aviso) e libera
      o seletor **Área segura da plataforma** em Estilo → Formato. Trocar entre Todas/Reels/
      Stories/TikTok reposiciona o texto na hora. Com "Mostrar área segura" ligado (aba Elementos),
      o guia desenha as faixas reais do app — topo, legenda e coluna de botões — e NÃO aparece
      no PNG exportado. Título, subtítulo, @ e local ficam sempre dentro do retângulo tracejado.
      Os modelos antigos seguem idênticos.
- [ ] **Cartazes — área segura, SÓ no 9:16**: em 3:4, 4:5 e 1:1 o seletor "Área segura da
      plataforma" (Estilo → Formato) não aparece — só a nota explicando que vale para 9:16 —
      e o cartaz sai na composição original de sempre. Trocando para **9:16**, o seletor surge,
      a área segura liga sozinha (com aviso) e o conteúdo recolhe para fora das faixas de
      legenda e botões. Voltar a 4:5 desfaz o recolhimento mas GUARDA a escolha: retornando ao
      9:16 ela volta a valer. O PNG exportado mantém o recolhimento e não leva o guia.
      Auditoria geométrica repetível: `node scripts/static-server.mjs &` +
      `npm run audit:area-segura` (mede todos os modelos × plataformas num navegador real;
      exige Playwright, e sem ele apenas avisa).
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
