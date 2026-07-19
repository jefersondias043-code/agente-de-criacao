# Plano de Fortalecimento da Plataforma Agente

> Documento de execução — gerado a partir da auditoria de 2026-06-15.
> Princípio inegociável: **nenhuma funcionalidade é removida**. Tudo que existe hoje
> (todas as ferramentas, modelos, temas, fluxos) continua funcionando, inclusive via
> `file://` (duplo-clique). O objetivo é tornar a plataforma mais **segura, estável,
> escalável e fácil de manter**, de forma incremental e sem regressões.

---

## Sumário executivo — roadmap de fases

| Fase | Tema | Esforço | Risco de regressão | Pré-requisito |
|---|---|---|---|---|
| 0 | Rede de segurança (testes + manifesto + medição) | baixo | nenhum | — |
| 1 | Segurança de chaves (cripto unificada, opcional) | médio | baixo | Fase 0 |
| 2 | Arquitetura (acoplamento, ordem, namespace) | médio | médio | Fase 0 |
| 3 | Confiabilidade de armazenamento (quota, IDB, perda de dados) | médio | médio | Fase 0 |
| 4 | Cartaz/Carrossel (contrato de exportação, paridade preview↔arquivo) | alto | médio | Fase 0 |
| 5 | Integração entre ferramentas (objeto de conteúdo, ack/timeout) | médio | baixo | Fase 2 |
| 6 | Memória e organização do projeto | baixo | nenhum | — |
| 7 | Validação final (smoke + regressão + checklist) | baixo | nenhum | todas |

**Ordem recomendada de execução:** 0 → 6 (rápida, destrava) → 1 → 3 → 2 → 4 → 5 → 7.
Fases 0 e 6 podem começar imediatamente; 1 e 3 entregam o maior ganho de risco real;
2 e 4 são as mais profundas e dependem da rede de testes da Fase 0.

---

## DIAGNÓSTICO DOS TRÊS PROBLEMAS PRIORITÁRIOS

### Problema 1 — Chaves de API em texto puro no `localStorage`

**Problema atual.** As chaves dos três provedores ficam em `agp.apiKeys` como JSON em
texto puro ([core.js](src/core.js), [settings.js:93](src/settings.js:93)). O
`apikey-sync.js` ainda **espelha** a chave Groq em texto puro para os slots das
ferramentas embutidas (`groq_api_key`, `df_groq_key`, `replicador_groq_api_key`). O
backup exportado ([storage.js:55](src/storage.js:55)) inclui essas chaves em claro.
Só o Detector Flop oferece cifragem **opcional** (AES-GCM/PBKDF2 150k, com senha —
[detector-flop.html:1169](detector-flop.html:1169)); o resto da plataforma não.

**Impacto técnico.** Qualquer script com acesso ao `localStorage` (incluindo uma
biblioteca de CDN comprometida) lê as chaves. O JSON de backup carrega segredos em
claro — se compartilhado/sincronizado em nuvem, vaza. Há duplicação de segredo em 4+
chaves de storage.

**Impacto para o usuário.** Vazamento de chave = consumo indevido de cota paga e
possível cobrança. O usuário não tem como proteger o backup nem o navegador
compartilhado.

**Impacto para manutenção.** Hoje convivem dois modelos de chave (app em claro,
Detector cifrado), com lógica de espelhamento que precisa saber dos dois. Sem
padronização, cada ferramenta nova reinventa o tratamento de chave.

**Nível de risco:** 🔴 **Alto** (segurança + financeiro). É o item de maior impacto real.

---

### Problema 2 — Dependência de escopo global e ordem de carregamento

**Problema atual.** 19 scripts clássicos de escopo global, carregados em ordem fixa em
[index.html:958](index.html:958), com `app.js` por último fazendo o boot. Funções e o
singleton `State` são globais implícitos; as dependências entre módulos não são
declaradas. A lista de scripts é mantida **à mão em dois lugares** (index.html e a
lista `URLS` do [service-worker.js:2](service-worker.js:2)).

**Impacto técnico.** Renomear/reordenar um arquivo, ou esquecer de atualizar uma das
duas listas, quebra o boot **silenciosamente** (função `undefined`) ou serve cache
obsoleto/404. Não há verificação de integridade na inicialização. O acoplamento é por
nomes globais, difícil de rastrear.

**Impacto para o usuário.** Falhas de boot aparecem como “tela quebrada” sem mensagem.
Cache desalinhado faz o usuário rodar código velho (classe de bug já enfrentada,
documentada na memória do projeto).

**Impacto para manutenção.** Alto atrito para evoluir: medo de mexer na ordem, sem
fronteiras de módulo, sem detecção automática de dependência faltante. Onboarding
lento.

**Nível de risco:** 🟠 **Médio-alto** (estabilidade + velocidade de manutenção).

**Restrição dura:** a solução **não pode** exigir ESM (`type="module"`) no caminho
`file://`, porque o usuário abre por duplo-clique e o navegador bloqueia ESM em origem
opaca. Qualquer mudança preserva o boot por `file://`.

---

### Problema 3 — Memória do projeto como changelog permanente

**Problema atual.** `project-agente-postagem.md` tem ~173 linhas e virou um diário de
mudanças (builds, SW vNN, edições cirúrgicas). Boa parte é histórico que o **git já
registra**, e parte estava factualmente **errada** (descrevia a refatoração como “não
mergeada” e o app como “monolítico”, já corrigido nesta auditoria).

**Impacto técnico.** Nenhum em runtime — é meta. Mas memória longa demais consome o
orçamento de contexto a cada sessão e dilui os fatos que importam.

**Impacto para o usuário/manutenção.** Recall ruim: fatos não-óbvios se perdem no meio
do changelog; risco de agir sobre informação obsoleta.

**Nível de risco:** 🟡 **Baixo** (qualidade de processo), mas barato de resolver e
melhora todas as sessões futuras.

---

## SOLUÇÃO PROPOSTA (visão geral)

| | O que muda | O que permanece igual |
|---|---|---|
| **Chaves** | Módulo de cripto compartilhado (`src/crypto.js`); “Bloqueio do workspace” **opcional** com senha; backup passa a exportar o blob cifrado quando bloqueado; espelhos em claro substituídos por entrega em memória via a ponte `postMessage` quando bloqueado. | Modo atual (sem senha) continua sendo o **padrão**, sem fricção. Detector mantém sua própria cifra. Todos os fluxos de IA seguem idênticos. |
| **Arquitetura** | Lista de scripts vira **fonte única** que gera index.html + SW; asserções de dependência no boot; namespace `window.AG` para código novo; lint que detecta global faltante; ponte com tipos de mensagem centralizados. | Scripts clássicos globais (sem ESM forçado); ordem de boot; `file://` por duplo-clique; cada função existente continua no lugar. |
| **Testes** | Suíte ampliada: storage, handoff, sync de chaves, render de todos os templates, geometria de zoom/pan, export. Harness de render headless. | `vitest`/`eslint` atuais; o truque de `eval` indireto; SMOKE_TEST manual como complemento. |
| **Cartaz** | “Contrato de flatten” explícito + testes de paridade preview↔arquivo; geometria de enquadramento compartilhada entre preview e export; imagens em IDB como **Blob**; UI de progresso/cancelar no carrossel. | html2canvas 1.4.1 mantido; todos os 32 modelos, 16 temas, paletas, padrões, mosaicos, formatos; export PNG/zip/imagens. |
| **Integração** | “Objeto de conteúdo” opcional (título/subtítulo/categoria/refs) além de texto puro; ack + timeout no `postMessage`; ponte compartilhada em vez de copiada. | “Texto é a moeda comum”; todos os destinos atuais (Gerar/AutoPost/Detector/Cartaz/Carrossel/Reescrever/Replicador). |
| **Performance** | Textos grandes (extrações/gerações) movidos para IDB com ponteiro no localStorage; poda/limite de histórico; gravação com verificação de quota; opção de export 2×. | localStorage como caminho quente síncrono; SW; IDB; experiência atual. |

**Como evitar regressões (regra geral de todas as fases):**
1. Fase 0 cria a rede de testes **antes** de qualquer mudança de comportamento.
2. Toda mudança é **aditiva e com fallback**: o caminho antigo continua válido (ex.: chave sem senha, cartaz sem slides, imagem como dataURL legada).
3. Migrações são **idempotentes e retrocompatíveis** (padrão já usado em `loadPortals`/`hydratePosters`).
4. Cada fase fecha com o SMOKE_TEST + a suíte automatizada verdes.
5. Versão do SW é bumpada a cada release para evitar cache obsoleto (automatizado na Fase 2).

---

## PLANO DE EXECUÇÃO POR FASES

### Fase 0 — Rede de segurança (fundação)

**Objetivo.** Criar a malha mínima que permite mudar o resto sem medo.

**Tarefas.**
1. Ampliar `vitest`: testes para `storage.js` (collectWorkspace, isWorkspaceKey, export/import round-trip com mock de IDB), `handoff.js` (sendTextTo roteia certo, exclusão de origem), `apikey-sync.js` (espelhamento, adoção suave, normalização de modelo).
2. Criar **harness de render headless** (jsdom): renderizar cada `POSTER_TEMPLATES[id].render(p, fmt, portal)` para os 32 modelos × 4 formatos e afirmar (a) não lança, (b) produz nó `.poster-1440` (as dimensões reais vêm do stage/`fmt`, não da string do template, então não são asseridas aqui).
3. Criar `scripts/check-manifest.mjs`: confere que a lista de `<script>` do index.html == `URLS` do service-worker == arquivos em `src/`. Roda no CI/lint.
4. Adicionar `npm run verify` = lint + test + check-manifest.

**Dependências.** Nenhuma.

**Critérios de conclusão.**
- `npm run verify` verde, cobrindo storage/handoff/sync + render de todos os templates.
- check-manifest falha de propósito quando um script é removido de uma das listas.

---

### Fase 1 — Segurança de chaves

**Objetivo.** Padronizar a proteção de chaves em toda a plataforma, sem fricção para
quem não quiser senha, eliminando segredo em claro do backup e dos espelhos.

**Tarefas.**
1. `src/crypto.js` — extrair a cripto do Detector como módulo único: `deriveKey(pass,salt)` (PBKDF2 150k SHA-256), `encryptString`/`decryptString` (AES-GCM, salt 16B + iv 12B, payload `{s,i,c}` base64). O Detector passa a referenciar o mesmo formato (compatível com o `df_groq_key_enc` que ele já grava).
2. **Bloqueio do workspace (opcional)** em Configurações → Dados e backup: toggle “Proteger chaves com senha”. Ao ativar: cifra `agp.apiKeys` → `agp.apiKeys.enc`, remove o texto puro; desbloqueia **uma vez por sessão** para a memória (`State.apiKeys`), nunca regravando em claro.
3. **Eliminar espelhos em claro quando bloqueado:** em modo bloqueado, `syncGroqKey` não escreve `groq_api_key`/`df_groq_key`/`replicador_*`; a chave vai às ferramentas **só em memória** via a ponte `postMessage` já existente (`injectConfigInto`/`pushConfigToTools`), que já valida `source`. Em modo legado (sem senha), o espelhamento atual permanece — zero regressão.
4. **Backup seguro:** `exportWorkspace` exporta o blob cifrado quando bloqueado (segredo nunca sai em claro). `importWorkspaceData` reconhece a chave `.enc`.
5. **Recuperação:** modal de desbloqueio (porta do Detector) + caminho “Esqueci a senha → limpar chaves e reconfigurar” (as chaves são reobteníveis nos consoles dos provedores; deixar isso explícito é a recuperação honesta para cripto client-side).
6. **Endurecimento complementar:** adicionar `Content-Security-Policy` (via `<meta>`) restringindo origens de script às do app + CDNs com SRI — reduz o risco de um script malicioso ler `localStorage`. Manter SRI já existente.

**Dependências.** Fase 0 (testes de sync de chaves).

**Critérios de conclusão.**
- Com bloqueio ativo: `localStorage` não contém nenhuma chave em claro (verificável por teste); ferramentas embutidas continuam gerando normalmente (chave via ponte).
- Backup exportado em modo bloqueado não contém a chave em claro; reimportar + desbloquear restaura o funcionamento.
- Modo sem senha (padrão) funciona exatamente como hoje.
- Detector continua compatível (cifra própria intacta).
- Testes cobrindo: cifrar→decifrar, migração claro→cifrado, e ausência de claro pós-bloqueio.

---

### Fase 2 — Arquitetura (acoplamento e ordem)

**Objetivo.** Tornar o boot robusto e a manutenção previsível, **sem** ESM forçado e
**sem** mexer no que já funciona.

**Tarefas.**
1. **Fonte única de scripts:** `scripts.manifest.mjs` exporta a ordem dos módulos; um gerador escreve as tags `<script>` do index.html e a `URLS` do service-worker a partir dela. Acaba o drift manual (Problema 2, causa raiz operacional).
2. **Asserções de boot:** no início de `app.js`, verificar que os globais críticos existem (`State`, `goTo`, `renderPosters`, `callLLM`…); se faltar, mostrar erro claro em tela em vez de quebrar mudo.
3. **Namespace para código novo:** introduzir `window.AG` (registry leve `AG.define/AG.get`) para módulos novos, sem migração em massa do existente (evita risco). Documentar a convenção.
4. **Lint mais rígido:** habilitar `no-undef` com a lista de globais declarada (gerada do manifesto) → dependência faltante vira erro de lint, não bug de runtime.
5. **Ponte tipada:** centralizar os tipos de mensagem (`agente:config`, `agente:content`, `agente:ingest`…) em constantes compartilhadas; validar formato no recebimento.
6. **Versionamento automatizado:** um script bumpa `data-build` + `CACHE`/SW vNN juntos no release (elimina “esqueci de subir a versão do SW”).
7. **(Opcional / trilha futura)** Introduzir bundling com esbuild: autorar em ESM em `src/`, gerar um `dist/agente.js` clássico para o caminho `file://`. Mantém `file://` via bundle e destrava módulos reais. **Só após** as fases de risco; não obrigatório.

**Dependências.** Fase 0.

**Critérios de conclusão.**
- index.html e SW gerados do manifesto; check-manifest sempre verde.
- Remover um script da lista → erro claro no boot e no lint (não falha silenciosa).
- Release bumpa build + SW automaticamente.
- Comportamento idêntico ao atual em `file://` e em servidor.

---

### Fase 3 — Confiabilidade de armazenamento

**Objetivo.** Eliminar a perda silenciosa de dados sob cota e preparar o storage para
crescer.

**Tarefas.**
1. **Gravação resiliente:** `saveJSON` hoje, sob cota, só dá toast — o `State` em
   memória diverge do persistido (o usuário pensa que salvou). Tornar a falha
   recuperável: detectar `QuotaExceededError`, oferecer poda/backup e **sinalizar
   claramente** o que não foi salvo.
2. **Mover corpos grandes para IDB:** transcrições (`agp.extractions`) e matérias
   (`agp.generations`) guardam texto potencialmente grande no localStorage (gargalo de
   5 MB). Mover o **corpo** para IDB, mantendo só metadados + ponteiro no localStorage
   (mesmo padrão já usado para imagens de cartaz). Retrocompatível: registros antigos
   inline continuam lendo.
3. **Poda/limite de histórico:** teto configurável por categoria + UI de limpeza
   (já há “Limpar tudo”; acrescentar limite e aviso).
4. **Imagens como Blob:** hoje imagens vão ao IDB como dataURL (string, ~33% maiores e
   em UTF-16 na memória). Migrar para `Blob` no IDB reduz uso de memória e disco
   (migração preguiçosa no `hydratePosters`).

**Dependências.** Fase 0; coordena com Fase 1 (ambas mexem em storage).

**Critérios de conclusão.**
- Simular cota cheia: nenhuma divergência silenciosa; usuário avisado do que falhou.
- Extração/geração grande persiste via IDB sem estourar o localStorage.
- Cartazes antigos (dataURL) e novos (Blob) coexistem no preview e no export.

---

### Fase 4 — Cartaz / Carrossel (motor de render e exportação)

**Objetivo.** Travar a paridade **preview ↔ arquivo exportado** e remover a classe de
bugs futuros do html2canvas, sem trocar a biblioteca agora.

**Contexto técnico (auditado).** O export ([posters.js:1524](src/posters.js:1524)) usa
html2canvas 1.4.1, que **não** suporta `object-fit`, `object-position` nem
`line-clamp`. O código compensa fazendo “flatten” manual de cada imagem arrastável e de
cada logo num canvas, e reaplica reticências “…” à mão. **Cada novo recurso de template
que use essas CSS precisa replicar o flatten — ou o arquivo sai diferente do preview.**
Essa é a maior fonte de bug futuro da ferramenta.

**Tarefas.**
1. **Geometria compartilhada:** extrair a matemática de enquadramento (cover + scale +
   pan → `{dx,dy,renderW,renderH}`) para **uma** função usada tanto pelo preview
   (`applyImageTransform`) quanto pelo export (`captureStageCanvas`). Hoje são duas
   implementações que “devem” concordar — risco de divergência.
2. **Contrato de flatten + testes de paridade:** documentar quais propriedades CSS o
   export sabe achatar (imagem, logo, ellipsis, clip diagonal de mosaico, padrões de
   fundo) e adicionar teste que renderiza um cartaz representativo e compara métricas
   preview vs canvas (dimensões, presença de cada camada).
3. **Verificar export de padrões gráficos:** confirmar que `background-image`/SVG dos
   padrões realmente sai no PNG (html2canvas é instável com background-image) — se
   houver gap silencioso, achatar o padrão como as imagens.
4. **Carrossel — UX de export:** o loop sequencial de captura ([carousels.js](src/carousels.js))
   é lento e bloqueia a UI; adicionar **barra de progresso + cancelar** e ceder o thread
   entre slides (já há 300 ms entre downloads; faltam feedback e cancelamento).
5. **Opção de resolução 2×:** o export é `scale:1` a 1080 de largura (resolução nativa,
   não “alta” de fato). Oferecer 2× opcional (custo de memória controlado).
6. **Teste combinatório leve:** o harness da Fase 0 cobre 32 modelos × 4 formatos;
   estender para amostrar temas/paletas/mosaicos representativos, garantindo que nenhum
   combo lança.

**Dependências.** Fase 0 (harness de render).

**Critérios de conclusão.**
- Uma só função de geometria alimenta preview e export.
- Teste de paridade falha se um template novo quebrar o flatten.
- Padrões gráficos confirmados no PNG.
- Export de carrossel com progresso/cancelar; opção 2× disponível.
- Todos os modelos/formatos/temas renderizam sem erro no harness.

---

### Fase 5 — Integração entre ferramentas

**Objetivo.** Fortalecer a comunicação sem quebrar o modelo “texto é a moeda comum”.

**Contexto.** Hoje o handoff ([handoff.js](src/handoff.js)) passa **texto puro** e o
destino re-parseia (ex.: Cartaz infere headline do texto). A ponte das embutidas é
**“baked” (copiada)** em cada HTML via `scripts/bake-tool-bridge.mjs` — duplicação. O
`postMessage` é fire-and-forget (sem confirmação).

**Tarefas.**
1. **Objeto de conteúdo opcional:** além do texto, transportar um payload estruturado
   opcional `{title, subtitle, category, location, sourceTool, imageRefs}`. Cartaz e
   Carrossel usam quando presente (auto-fill mais rico) e caem no parser de texto
   quando ausente — 100% retrocompatível.
2. **Ack + timeout:** o emissor espera confirmação do iframe; se não chegar em N ms,
   toast de falha (hoje, se o iframe nunca carrega, o conteúdo só fica pendente sem
   aviso).
3. **Ponte compartilhada:** substituir a cópia “baked” por **um** `tool-bridge.js`
   carregado por cada HTML standalone via `<script src>` relativo (funciona em
   `file://`), eliminando a duplicação e o passo de bake.
4. **Saídas hoje sem encaminhamento:** permitir enviar a **análise do Detector** e a
   saída do **Replicador** para Gerar/Cartaz (paridade com os demais produtores).
5. **Memórias do Detector:** avaliar expor as memórias de nicho de forma consultável
   pela plataforma (sem mover a feature — só leitura unificada).

**Dependências.** Fase 2 (tipos de mensagem centralizados ajudam aqui).

**Critérios de conclusão.**
- Handoff com objeto estruturado preenche Cartaz sem reparse, e ainda funciona só com
  texto.
- Envio sem iframe pronto gera aviso (não silêncio).
- Uma única fonte da ponte; bake removido do fluxo.

---

### Fase 6 — Memória e organização do projeto

**Objetivo.** Transformar a memória de changelog em fatos duráveis e não-óbvios.

**Tarefas.**
1. Rodar `/consolidate-memory`: dividir `project-agente-postagem.md` em (a) visão geral
   concisa (o que é, arquitetura, restrições `file://`, fatos não-óbvios) e (b) descartar
   o changelog que o git já guarda.
2. Estabelecer convenção: **memória = fato durável não-derivável**; histórico de
   mudanças vive em commits. Atualizar o índice `MEMORY.md`.
3. Registrar como fatos duráveis os achados desta auditoria que importam a longo prazo
   (restrição `file://`/sem-ESM; contrato de flatten do html2canvas; ponte
   `postMessage` validada por source; teto de 5 MB do localStorage).

**Dependências.** Nenhuma (pode rodar a qualquer momento; recomendado cedo).

**Critérios de conclusão.**
- Memória do projeto curta e factual; índice atualizado; nenhum fato errado.

---

### Fase 7 — Validação final

**Objetivo.** Garantir, de ponta a ponta, que nada regrediu e tudo ficou mais forte.

**Tarefas.**
1. `npm run verify` (lint + testes + manifesto) verde.
2. SMOKE_TEST.md executado em servidor **e** em `file://` (duplo-clique) — as 9 seções,
   incluindo as 4 embutidas e o sync de chave/modelo.
3. Checklist de não-regressão: gerar matéria, extrair (PDF/áudio), cartaz único + export,
   carrossel + export zip/imagens, handoff entre todas as ferramentas, backup
   export→import (em modo claro e bloqueado).
4. Atualizar SMOKE_TEST.md e o README do videograb-server com o que mudou.

**Critérios de conclusão.**
- Todos os fluxos do checklist verdes nos dois modos de execução.
- Nenhuma funcionalidade removida; segurança, estabilidade e escalabilidade
  mensuravelmente melhores.

---

## ANÁLISES PROFUNDAS SOLICITADAS

### Segurança — chaves de API (detalhe)

- **AES-GCM + PBKDF2:** reusar o esquema do Detector (PBKDF2 150k SHA-256 → AES-GCM 256;
  salt 16B, iv 12B; payload `{s,i,c}` base64). É sólido para client-side; não reinventar.
- **Verdade honesta sobre cripto client-side:** num dispositivo que o atacante controla,
  nenhuma chave fica 100% protegida. A senha protege **de verdade** dois vetores reais:
  (1) **backup em claro** vazando, (2) inspeção casual do `localStorage`/navegador
  compartilhado. Por isso o foco é: cifrar o backup, não espelhar em claro, e oferecer
  senha **opcional** (sem forçar fricção).
- **Gerenciamento de chave:** chave de cifra derivada da senha, **nunca** persistida;
  só a chave de sessão fica em memória após o desbloqueio.
- **Recuperação segura:** sem backdoor. Senha perdida → reconfigurar (chaves são
  reobteníveis nos consoles). Deixar isso explícito na UI é o caminho correto.
- **Migração automática:** boot detecta `agp.apiKeys` em claro e mantém o
  comportamento atual; ao ativar o bloqueio, cifra in-place e remove o claro
  (idempotente, como as migrações já existentes).
- **Compatibilidade Detector:** ele já lê config injetada e tem cifra própria
  (`df_groq_key_enc`); a plataforma entrega a chave por ponte e **não** sobrescreve a
  escolha local do usuário no Detector.

### Arquitetura (detalhe)

- **Escopo global / dependências implícitas:** mitigar com asserções de boot + lint
  `no-undef` com globais declarados (detecção em vez de prevenção total — pragmático).
- **Ordem de carregamento:** resolver na **fonte única** que gera index.html + SW
  (causa raiz do drift). Trilha futura opcional: bundling esbuild (ESM em dev →
  bundle clássico p/ `file://`).
- **Comunicação entre módulos:** tipos de `postMessage` centralizados + validação de
  formato + ack.
- **Acoplamento:** introduzir namespace só para código novo evita o risco de refatorar
  300 KB de globais de uma vez; a redução de acoplamento é incremental.

### Testes (detalhe)

- **Cobertura atual:** mínima — `test/pure.test.js`, ~6 casos de funções puras
  (escapeHtml, truncate, formatBytes, uuid, buildPrompt, cleanText).
- **Áreas sem teste (críticas):** todo o motor de cartaz/carrossel (260 KB), storage,
  handoff, sync de chaves, ingest, o bridge `postMessage`.
- **Fluxos mais sensíveis:** export (paridade preview↔arquivo), persistência sob cota,
  propagação de chave/modelo, geometria de zoom/pan.
- **Plano:** Fase 0 cobre storage/handoff/sync + render headless de todos os templates;
  Fase 4 adiciona paridade de export; manter o SMOKE_TEST como camada de integração
  manual (inclusive `file://`, que o harness automatizado não cobre).

### Ferramenta Cartaz — gargalos futuros (mesmo sem bug hoje)

1. **html2canvas 1.4.1 (sem manutenção)** é o maior risco: cada recurso novo que use
   `object-fit`/`object-position`/`line-clamp`/`filter` exige flatten manual, senão
   o PNG diverge do preview. → Contrato de flatten + testes de paridade (Fase 4); a
   longo prazo, avaliar render nativo em Canvas/SVG dos templates (fonte única =
   acaba a classe inteira de bug).
2. **Geometria duplicada** preview vs export → função compartilhada (Fase 4).
3. **Imagens como dataURL** (string) no IDB → migrar para Blob (Fase 3): menos memória.
4. **Export de carrossel sequencial e bloqueante** → progresso/cancelar (Fase 4).
5. **Padrões gráficos** podem não sair no PNG (background-image no html2canvas) →
   verificar e, se preciso, achatar (Fase 4).
6. **Superfície combinatória enorme** (33×16×4×mosaicos) sem teste → harness amostral
   (Fases 0/4).
7. **“Alta resolução” é 1080 nativo** (scale:1) → opção 2× (Fase 4).

### Integração entre ferramentas — oportunidades

- Hoje só **texto** trafega; um **objeto de conteúdo** opcional enriquece o auto-fill de
  Cartaz/Carrossel sem quebrar o modelo (Fase 5).
- Ponte **duplicada** (baked) → ponte compartilhada única (Fase 5).
- **Sem ack/timeout** → entrega confiável com aviso de falha (Fase 5).
- Saídas de **Detector (análise)** e **Replicador** ainda não encaminháveis → paridade.
- **Memórias do Detector** isoladas → leitura unificada (avaliar).

### Performance — alvos concretos

- **localStorage 5 MB:** corpo grande de extrações/gerações pressiona o teto; mover para
  IDB com ponteiro (Fase 3).
- **Falha de gravação silenciosa** sob cota → divergência memória/persistido (Fase 3,
  prioridade alta).
- **IDB com dataURL** → Blob (Fase 3).
- **SW network-first** prioriza frescor sobre velocidade offline; avaliar
  stale-while-revalidate para assets com cache versionado (sem reintroduzir o bug de
  código velho) — opcional, Fase 2.
- **Listas de histórico sem virtualização** → ok hoje, paginar quando crescer.
- **Memória durante export** (canvases grandes + dataURL) → Blob + liberar cedo.

### Gargalos ocultos (além dos três)

1. 🔴 **Perda de dados silenciosa sob cota** (`saveJSON`): o mais urgente fora dos três —
   endereçado na Fase 3.
2. 🟠 **Drift da lista SW ↔ scripts** (manual): Fase 2 (fonte única).
3. 🟠 **Dependência de CDN** (pdf.js, tesseract, mammoth, html2canvas): primeiro load
   offline falha; SRI fixa versões mas uma URL que mude quebra calado. Avaliar
   self-host das libs críticas + degradação graciosa.
4. 🟠 **iframes `allow-scripts allow-same-origin`** podem escapar do sandbox; são
   first-party, mas um CDN comprometido roda com acesso ao `localStorage` (chaves). CSP
   (Fase 1) e SRI mitigam.
5. 🟡 **Versionamento manual** (3 nomes do app; `data-build`/SW vNN à mão) → automatizar
   (Fase 2).
6. 🟡 **Endpoints de extração do VideoGrab** mudam com o tempo (documentado) → manter
   `youtubei.js` atualizado; monitorar.
7. 🟡 **Sem telemetria de erro**: falhas client-side são invisíveis ao mantenedor →
   log de erro local opcional ajudaria a depurar.
8. 🟡 **pt-BR + viés Bahia hardcoded**: escalar para outras regiões exige
   parametrização (futuro).

---

## RESULTADO ESPERADO

Ao final das 7 fases, a plataforma terá:

- **Segurança:** chaves padronizadas com proteção opcional real (AES-GCM), backup sem
  segredo em claro, sem espelhos em texto puro quando bloqueada, CSP + SRI.
- **Estabilidade:** boot que falha com mensagem clara (não em silêncio), lista de
  scripts à prova de drift, versionamento automático, rede de testes cobrindo o que
  hoje só o smoke test pega.
- **Escalabilidade:** corpos grandes e imagens fora do teto de 5 MB (IDB/Blob),
  gravação resiliente a cota, export de carrossel com progresso.
- **Manutenibilidade:** contrato de flatten do cartaz, geometria única, ponte
  compartilhada e tipada, memória do projeto enxuta e factual.

E, acima de tudo: **todas as ferramentas, modelos, temas, paletas, mosaicos, carrosséis
e fluxos atuais permanecem — inclusive o duplo-clique `file://`.** Nada é removido; tudo
fica mais forte.
