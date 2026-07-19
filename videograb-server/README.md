# VideoGrab — servidor de extração

Backend da ferramenta **VideoGrab** da plataforma Agente: baixa vídeos do
**Instagram**, **TikTok** e **YouTube** sem marca d'água.

> **Uso normal (recomendado):** rode **`Instalar inicio automatico.bat`** (na raiz
> da plataforma) UMA vez. Ele registra o servidor para subir **sozinho ao entrar no
> Windows** (silencioso, via `servidor.vbs`) e cria um atalho "Agente" na Área de
> Trabalho. A partir daí, é só abrir o app — o servidor já está no ar. Este servidor
> serve o **app inteiro + a API** num único processo (mesma origem).
>
> - Iniciar agora, manualmente (janela visível, útil para ver erros): `Agente.bat`.
> - Encerrar: `Parar Agente.vbs`. Desativar o auto-início: `Desinstalar inicio automatico.bat`.
>
> **Modo dev / manual** (a partir desta pasta):
>
> ```bash
> npm install   # uma vez
> npm start     # sobe app + API em http://localhost:3000
> ```
>
> A pasta `public/` do projeto original não é usada aqui (o frontend é o
> `videograb.html` da raiz da plataforma).

## Funcionalidades

- **Detecção automática de plataforma** — cole o link e o app identifica a
  plataforma (o chip correspondente acende) e aplica a cascata de estratégias
  adequada.
- **Progresso em tempo real** — cada etapa da extração e o percentual do
  download aparecem no card de status (via Server-Sent Events).
- **Arquivo salvo** com o mesmo padrão de nome do app:
  `insta_…`, `tiktok_…` ou `youtube_…` + `yyyy-MM-dd_HHmmss.mp4`
  (na pasta de downloads do navegador — o equivalente Web da galeria).
- **Tema idêntico ao app** — dark com vermelho `#8B0000`, fonte Inter,
  animações de entrada, snackbars flutuantes e card de status com estados
  info/erro/sucesso.
- **Responsivo** — desktop e celular; instalável como PWA.

## Estratégias de extração por plataforma

| Plataforma | Cascata de estratégias |
|---|---|
| **Instagram** | GraphQL → endpoint legacy (`?__a=1&__d=dis`) → oEmbed → HTML da página → página de embed *(porta fiel do app original)* |
| **TikTok** | API sem marca d'água HD → API sem marca d'água SD → HTML nativo da página (`__UNIVERSAL_DATA_FOR_REHYDRATION__` / `SIGI_STATE`). Resolve links curtos `vm.`/`vt.tiktok.com` |
| **YouTube** | InnerTube via [youtubei.js](https://github.com/LuanRT/YouTube.js) com cascata de clientes: Android → iOS → Web embed → TV. Suporta `watch`, `youtu.be`, Shorts, embed e live |

## Arquitetura

O app original fazia requisições HTTP diretas às plataformas, o que o
navegador bloqueia por CORS. O backend Node.js executa a extração e faz proxy
do download:

```
├── server.js                 # Express: estáticos + /api/extract (SSE) + /api/download (proxy)
├── src/
│   ├── platforms.js          # Registro/detecção de plataformas
│   ├── http.js               # Utilitários HTTP compartilhados
│   └── extractors/
│       ├── instagram.js      # 5 estratégias portadas de lib/main.dart
│       ├── tiktok.js         # TikWM + HTML nativo
│       └── youtube.js        # InnerTube (youtubei.js) com cascata de clientes
└── public/
    ├── index.html            # Tela principal
    ├── css/styles.css        # Tema portado do app Flutter
    ├── js/
    │   ├── main.js           # Ponto de entrada
    │   ├── home.js           # Detecção de plataforma + extração + download
    │   └── snackbar.js       # Snackbars flutuantes
    ├── icons/                # Ícones do app (SVG + PNG)
    └── manifest.webmanifest
```

**Segurança:** a URL do vídeo nunca transita pelo cliente. `/api/extract`
devolve um *ticket* efêmero (TTL 10 min) e `/api/download?id=<ticket>`
transmite o vídeo com os cabeçalhos definidos pelo extrator — sem superfície
para SSRF.

**Extensível:** para adicionar uma nova plataforma, crie um módulo em
`src/extractors/` com a interface `{ id, label, filePrefix, matches, extract }`
e registre-o em `src/platforms.js`.

## Requisitos

- Node.js >= 18

## Como executar

```bash
npm install
npm start
```

Abra <http://localhost:3000> no navegador.

Para desenvolvimento com recarga automática do servidor:

```bash
npm run dev
```

## Produção

- A porta é configurável pela variável de ambiente `PORT`.
- Para HTTPS, coloque o app atrás de um reverse proxy (nginx, Caddy) ou de
  uma plataforma como Railway/Render/Fly.io — basta `npm start` com a `PORT`
  fornecida pela plataforma.

## Publicando na nuvem (versão online do app)

Passo a passo completo em **`DEPLOY.md`** (raiz do projeto). Resumo (Render,
grátis): New Web Service → Root Directory `videograb-server` → Build
`npm install` → Start `npm start`. Depois preencha a URL gerada no campo
`REMOTE.videograb` de **`src/server-config.js`** — o frontend testa o servidor
local primeiro e cai para a nuvem sozinho quando não há servidor local.

## Observação sobre as plataformas

A extração depende de endpoints públicos das plataformas, que mudam com o
tempo e podem aplicar limites de requisição ou bloquear datacenters. A
arquitetura em cascata mitiga isso: quando uma estratégia falha, a próxima é
tentada; se todas falharem, a mensagem "Não encontrou URL do vídeo. Tente
outro link público." é exibida (mesmo comportamento do app original). Para o
YouTube, a biblioteca `youtubei.js` é mantida ativamente — mantenha-a
atualizada (`npm update youtubei.js`) para acompanhar mudanças da API.
