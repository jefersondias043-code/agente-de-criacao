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
- [ ] **Narrativa — um campo, um clique**: ao abrir, a tela mostra **só** o campo "Conte a sua
      história" e o botão **Criar conteúdo** (habilitado). Nada de veredito nem X vermelho na
      tela vazia. As seções **A história em detalhe**, **Ajustes** e **O lema** começam
      fechadas — tudo continua lá para quem quiser.
      Escrever uma ideia e clicar **uma vez**: a ferramenta lê a ideia, responde sozinha às três
      perguntas do lema (confira em "A história em detalhe") e escreve o conteúdo.
      Se a ideia for vaga demais, aparece **UMA** pergunta focada (não um formulário) com o
      texto do lema explicando por que ela importa; responder ali e o fluxo segue.
      O lema continua valendo: uma situação sem obstáculo ou sem risco não vira conteúdo —
      só que agora a ferramenta ajuda a chegar lá em vez de travar o botão.
      Diagnóstico segue **sem chave de API e offline**; rascunho sobrevive a trocar de
      ferramenta e a recarregar. "Afiar as respostas" e o histórico continuam disponíveis.
- [ ] **Narrativa — elenco**: "Adicionar personagem" cria a linha e já foca o nome; digitar não
      perde o foco. Personagem sem desejo declarado vira aviso (nunca trava — os três portões
      continuam sendo do protagonista). Trocar o formato muda o limite de elenco (Reels avisa
      com 3 personagens; vídeo longo, não). O formato **Diálogo** cobra pelo menos um personagem.
      Recarregar a página e reabrir do histórico devolvem o elenco inteiro.
- [ ] **Gerar — Atribuição**: numa pauta de anúncio (ex.: "o governador anunciou que as obras
      começam em 1º de agosto"), a matéria NÃO pode afirmar a data por conta própria — tem de
      sair "Segundo o governador…", "De acordo com…". Vale para promessa, previsão, número,
      causa e avaliação; acontecimento observado ("a ponte foi interditada") dispensa. Se o
      texto voltar sem nenhuma atribuição e a pauta tinha declarações, o resultado mostra o
      ponto de atenção "A pauta traz N informação(ões) declarada(s)…".
- [ ] **Gerar — Juízo sem dono**: numa pauta institucional (release de prefeitura, anúncio de
      compra), ler os parágrafos do corpo **um a um**, como quem chega neles sem ter lido o
      anterior. Nenhum pode avaliar sem dizer quem avalia — "é um exemplo de gestão eficaz",
      "é um passo importante", "é um sinal de que a prefeitura está comprometida" têm de sair
      com "Segundo o prefeito…" ou não sair. Atribuir só no lead NÃO basta: o leitor entende
      cada parágrafo como voz do portal. Se escapar, o resultado mostra o ponto de atenção
      "O(s) parágrafo(s) Nº … avalia(m) sem dizer quem avalia". Matéria mais curta é resultado
      aceitável — encher com elogio sem dono não é.
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
- [ ] **Cartazes — capas de vídeo e thumbnails**: a aba **Capa de vídeo** do seletor de modelos
      traz **24 modelos** com propostas visuais distintas (impacto, rosto, número, antes/depois,
      lista, moldura, diagonal, duotone, cartela, passos, dado, mínimo, faixa, mosaico, retrato,
      revelação, manchete dupla, selo, tabloide, cinema…); escolher um muda o formato para **16:9** automaticamente (com aviso) —
      é a proporção da thumbnail do YouTube, e o único formato deitado. Trocar para **9:16**
      vira a composição (lado a lado → empilhada) e continua servindo como capa de Shorts/Reels.
      Teste de leitura: reduza o preview até ~200px de largura — o título tem de continuar
      legível, e nenhum texto pode encostar no selo do @ do canal. Em Finalizar, a **Resolução**
      passa a mostrar **1920px/3840px** no 16:9 (e segue 1080/2160 nos verticais).
      **Aproveitamento do conteúdo**: gerando um cartaz a partir de uma matéria e trocando para
      uma capa, o **local** tem de aparecer (era ignorado por todas as capas), a **categoria**
      também, e nas capas **Lista** e **Passo a passo** os tópicos saem do corpo do texto.
      Na capa **Número**, com o campo de destaque vazio, o número é extraído do próprio conteúdo.
      Teste de corte: com um título de palavra longa ("INVESTIMENTO", "PREFEITURA") em **9:16**,
      nenhuma palavra pode sair cortada na lateral.
- [ ] **Cartazes — campo transparente (moldura para vídeo)**: em cada miniatura de imagem há o
      botão **Transparente**. Ligado, a área da foto vira xadrez no editor e o resto do cartaz
      (título, subtítulo, faixas, formas, assinatura) continua igual. Exportando, o PNG sai com
      aquela área **vazada** — abrindo num editor de vídeo, o vídeo aparece atrás do buraco.
      O formato cai para PNG automaticamente (JPG não guarda transparência), com aviso. Desligar
      devolve a foto que estava lá. Modelos sem área de foto não são afetados.
- [ ] **Cartazes — qualidade da exportação**: em Finalizar, a **Resolução** já vem em **2160px**
      (a maior); 1080px continua a um toque. Exportando em PNG, abrir o arquivo em tamanho real
      e comparar com o preview: texto, contorno de forma e borda de foto têm de estar tão
      definidos quanto na tela — sem halo, sem serrilhado, sem cara de imagem comprimida.
      Trocar uma foto por uma de câmera (3000px+) e reexportar: a foto NÃO pode sair mais mole
      que o texto ao lado. Com fundo de padrão (Estilo → Fundo), os pontos/listras têm de sair
      com a borda limpa. JPG segue disponível e sai bem menos comprimido que antes.
- [ ] **Cartazes — Editor visual** (aba Elementos): adicionar forma/badge/ícone/texto aparece no
      preview e na lista de camadas; arrastar mostra guias de alinhamento; alça de rotação gira;
      "Área segura" desenha a margem; Desfazer/Refazer (Ctrl+Z/Y) revertem; modo Simples esconde
      abas avançadas; preset de composição (aba Layout) troca modelo+tema; o PNG exportado NÃO
      mostra a moldura de seleção/guias/área segura.
- [ ] **Detector Flop**: iframe carrega `detector-flop.html` (3 abas) com tema claro aplicado.
- [ ] **AutoPost IA — ordem do resultado**: gerado o pacote, a tela mostra primeiro o placar da
      revisão, depois o **pacote** (título, legenda, hashtags, palavras-chave) e só então, sob o
      rótulo **CONTEÚDO DE ORIGEM**, a transcrição — com "Copiar" e "🔍 Avaliar potencial" ainda
      no cabeçalho dela, e a análise aparecendo logo abaixo. Vale igual ao reabrir um item em
      "Meus pacotes".
- [ ] **AutoPost IA — categoria do vídeo**: na tela de revisão, antes de gerar, aparece a grade
      **Categoria do vídeo** (fora do bloco recolhido "Opções de geração"). Escolher uma marca o
      chip; a ★ favorita SEM selecionar a categoria, e a favorita sobe para o topo, separada do
      resto por um tracejado. Recarregar mantém favoritas e reabre na última categoria usada.
      Gerando com uma categoria escolhida, hashtags e palavras-chave saem no vocabulário do
      nicho (ex.: **Culinária** → nome do prato e ingrediente; **Esportes** → time e competição).
      Com **Automático**, o pacote sai como antes. Vale igual no app embutido e no standalone.
- [ ] **AutoPost IA** e **Replicador**: iframes carregam com tema claro.
- [ ] **Configurações**: trocar provedor (Groq/OpenAI/Anthropic) atualiza a lista de modelos.
- [ ] **Dados e backup**: "Proteger com senha" cifra as chaves (status → "Protegido");
      após bloquear, `localStorage` não mostra `agp.apiKeys`/`groq_api_key`/`df_groq_key`
      em claro; "Remover proteção" volta ao normal. Exportar backup com chaves
      oferece senha; o `.json` exportado não contém a chave em texto puro.
- [ ] **Boot**: nenhuma tela "Não foi possível iniciar" (asserção de integridade de boot).
