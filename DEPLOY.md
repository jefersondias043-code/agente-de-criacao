# Publicando a plataforma na internet

> Guia para colocar o **Agente** no ar para qualquer usuário, com as **9 ferramentas
> funcionando** — incluindo as duas que dependem de servidor (VideoGrab e Removedor
> de Fundo). Nada muda para quem usa localmente: o app continua abrindo por
> duplo-clique / `Agente.bat`, e o servidor local sempre tem prioridade.

## Arquitetura publicada

```
┌────────────────────────────┐
│  App (site estático)       │  GitHub Pages / Cloudflare Pages / Netlify
│  9 ferramentas no navegador│  ← grátis, sem hibernar
└─────────┬──────────────────┘
          │ HTTPS
          ├──────────────► VideoGrab API (Node)      → Render / Railway / Fly.io
          └──────────────► Removedor de Fundo (IA)   → Hugging Face Spaces (Docker)
```

O arquivo **`src/server-config.js`** é o coração disso: as ferramentas testam os
endereços na ordem *(salvo no navegador → mesma origem → localhost → nuvem)* e usam
o primeiro que responder. Publicar = subir os dois servidores e preencher os dois
campos `REMOTE` desse arquivo.

---

## Passo 1 — Repositório no GitHub

Já feito se você está lendo isto no GitHub. Caso contrário:

```bash
git init && git add -A && git commit -m "Plataforma Agente"
gh repo create agente-de-criacao --private --source . --push
```

## Passo 2 — Publicar o app (site estático)

Escolha UMA das opções:

| Opção | Repositório privado? | Observação |
|---|---|---|
| **GitHub Pages** | ❌ precisa ser público (no plano gratuito) | Settings → Pages → branch `main`, pasta `/ (root)` |
| **Cloudflare Pages** | ✅ funciona com privado | conectar o repo, sem build command, output `/` |
| **Netlify** | ✅ funciona com privado | idem |

Qualquer uma delas serve o app por HTTPS e publica de novo a cada `git push`.

> O app é 100% estático — não há build. A pasta publicada é a raiz do repositório.

## Passo 3 — VideoGrab na nuvem (Render)

1. Crie conta em <https://render.com> (pode entrar com o GitHub).
2. **New → Web Service** → conecte este repositório.
3. Configure:
   - **Root Directory:** `videograb-server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Ao final, o Render dá uma URL, ex.: `https://agente-videograb.onrender.com`.
   Teste: abra `https://…onrender.com/api/health` → deve responder `{"ok":true}`.

> Railway e Fly.io funcionam igual (Node ≥ 18, `PORT` vem do ambiente — o servidor
> já lê `process.env.PORT`).

## Passo 4 — Removedor de Fundo na nuvem (Hugging Face Spaces)

O servidor de IA já vem com **`removedor-server/Dockerfile`** pronto.

1. Crie conta em <https://huggingface.co> → **New Space**.
2. Escolha **SDK: Docker** (Blank) · hardware **CPU basic (grátis)** · visibilidade Public.
3. Envie para o Space os 3 arquivos de `removedor-server/`:
   `Dockerfile`, `server.py`, `requirements.txt`
   (pela aba *Files → Add file*, ou por `git push` para o repositório do Space).
4. No `README.md` do Space, garanta o metadado da porta:

   ```yaml
   ---
   title: Agente Removedor de Fundo
   sdk: docker
   app_port: 7860
   ---
   ```

5. Aguarde o build. A URL fica `https://SEU-USUARIO-NOME-DO-SPACE.hf.space`.
   Teste: `https://….hf.space/health` → `{"ok":true, …}`.

> **Dica:** no plano grátis (CPU, 16 GB RAM) o modelo padrão BiRefNet funciona,
> mas é lento (~30–60 s por imagem). O usuário pode escolher "Rápido (U²-Net)"
> no seletor de modelo da ferramenta para respostas em poucos segundos.

## Passo 5 — Apontar o app para os servidores

Edite **`src/server-config.js`** e preencha com as URLs dos passos 3 e 4:

```js
const REMOTE = {
  videograb: 'https://agente-videograb.onrender.com',
  removedor: 'https://seu-usuario-agente-removedor.hf.space',
};
```

Depois:

```bash
npm run verify         # lint + testes + manifesto
npm run bump:version   # invalida o cache do service worker
git add -A && git commit -m "Servidores remotos configurados" && git push
```

Pronto. Quem abrir o app publicado usa a nuvem sem configurar nada; quem roda no
PC continua usando os servidores locais (eles têm prioridade na ordem de teste).

---

## Ressalvas conhecidas

- **Hibernação (planos grátis):** Render e HF Spaces "dormem" após ~15 min sem
  uso; a primeira requisição demora até 1 min. As ferramentas avisam o usuário e
  reconectam sozinhas (mensagem "o servidor gratuito hiberna…").
- **Instagram/TikTok vs. datacenter:** essas plataformas às vezes bloqueiam IPs de
  nuvem. A cascata de estratégias mitiga, mas se falhar, rodar o `Agente.bat`
  local resolve (IP residencial) — o app local nem passa pela nuvem.
- **Removedor no plano grátis:** sem GPU. Para produção séria, considere hardware
  pago no HF (a partir de ~US$ 0,05/h) ou uma máquina própria.
- **Override por navegador (avançado):** dá para apontar um navegador específico
  para outro servidor sem mexer no código — no console:
  `localStorage.setItem('agente:server:videograb', 'https://outra-url')`
  (idem `agente:server:removedor`). Remover: `localStorage.removeItem(...)`.
