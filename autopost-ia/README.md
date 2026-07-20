# AutoPost IA — aplicação independente

Transforma **áudio, vídeo ou texto** em um **pacote de publicação completo** para
vídeo curto (TikTok, Reels, Shorts): título com gancho, legenda otimizada,
5 hashtags estratificadas e ~10 palavras-chave de SEO — com **revisão automática
de qualidade** (um juiz de IA pontua e refina o resultado).

> Este diretório é um aplicativo **totalmente independente** da plataforma Agente:
> tem sua própria interface, seus próprios módulos e funciona sozinho. A plataforma
> continua com a versão embutida dela (`../autopost-ia.html`); as duas convivem.

## Como usar

**Publicado (recomendado):** abra a URL do app no navegador — funciona em
computador e celular. No celular, use "Adicionar à Tela de Início" (é um PWA:
instala como app, com ícone próprio).

**Local:** dê dois cliques em `index.html` (funciona via `file://`) ou sirva a
pasta com qualquer servidor estático.

**Chave da API:** o app usa a API gratuita da [Groq](https://console.groq.com/keys)
(transcrição Whisper + geração). No primeiro uso, um painel pede a chave
(`gsk_…`) — ela fica salva **só no navegador**. Para trocar depois: botão **⚙**
no topo.

## Funcionalidades

| Recurso | Descrição |
|---|---|
| Entrada unificada | Cole texto OU arraste/anexe áudio, vídeo ou `.txt`/`.md` |
| Transcrição pt-BR | Groq Whisper large-v3 (~98% de acurácia) |
| Arquivos grandes | > 25 MB são comprimidos no navegador (16 kHz mono MP3, sem servidor) |
| Pacote completo | Título (50–80) · legenda (150–300 + pergunta) · 5 hashtags (1 ampla · 1 assunto · 2 nicho · 1 intenção) · ~10 palavras-chave |
| Juiz de qualidade | Rubrica de 9 critérios; nota < 80 → refina automaticamente e entrega a melhor versão |
| Contexto temporal | Toda chamada à IA recebe a diretriz do ano corrente (conteúdo nunca datado) |
| Histórico | Biblioteca pessoal no IndexedDB (capacidade = dispositivo), com edição e exclusão |
| Análise de potencial | Sob demanda: 6 dimensões + pontos fortes/fracos + sugestões |
| Temas | Claro (padrão) e escuro (segue o sistema automaticamente) |
| PWA | Instalável, com cache offline da interface |

## Estrutura

```
autopost-ia/
├── index.html            # marcação (enxuta — sem CSS/JS embutidos)
├── css/app.css           # estilos (temas claro + escuro por variáveis)
├── js/
│   ├── vendor/lamejs.js  # encoder MP3 puro-JS (compressão local)
│   ├── core.js           # utilitários ($, escapeHtml, formatRoteiro…)
│   ├── bridge.js         # integração OPCIONAL com a plataforma (só em iframe)
│   ├── config.js         # chave/modelo Groq + modal de configurações
│   ├── api.js            # callLLM + contexto temporal + regras de prompt
│   ├── audio.js          # leitura, otimização (lamejs) e transcrição Whisper
│   ├── package.js        # gerador do pacote (LLM-C) + juiz (LLM-D)
│   ├── analysis.js       # análise de potencial (6 dimensões)
│   ├── history.js        # histórico no IndexedDB (+ migração do legado)
│   ├── render.js         # toda a construção de HTML de resultado/histórico
│   └── app.js            # assistente 3 etapas, pipeline principal, boot
├── service-worker.js     # PWA: cache-first dos arquivos do app
├── manifest.webmanifest  # PWA: nome, ícones, cores
└── icon-192/512.png      # ícones (gerados da marca)
```

Scripts **clássicos** (sem ES modules) de propósito: o app abre até por
`file://` (duplo clique), igual ao restante do ecossistema.

## Modo embutido (opcional)

Quando carregado dentro da plataforma Agente (iframe), o `bridge.js` ativa
automaticamente: recebe a chave da plataforma, aceita PDF/imagem/DOCX no anexo
(extração feita pelo app pai), mostra a barra **"Enviar para…"** (Cartaz,
Carrossel, Gerar matéria…) e compartilha o mesmo histórico. **Nada disso roda no
modo independente** — sem iframe, o app nem registra essas pontes.

## Publicação

É um site estático: qualquer host serve (GitHub Pages, Cloudflare Pages,
Netlify…). Ao publicar mudanças, suba a versão do cache em
`service-worker.js` (`autopost-vN` → `vN+1`).

> **Aviso de segurança:** a chave fica no navegador de quem usa — modelo adequado
> para uso pessoal/equipe. Para oferecer o app ao público SEM que cada pessoa
> traga a própria chave, mova as chamadas da Groq para um proxy (Cloudflare
> Workers/Vercel) e nunca exponha uma chave compartilhada no código.
