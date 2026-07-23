# Publicando a plataforma na internet

> Guia para colocar o **Agente** no ar para qualquer usuário, com as ferramentas
> funcionando — incluindo a única que depende de servidor (Removedor de Fundo).
> Nada muda para quem usa localmente: o app continua abrindo por duplo-clique /
> `Agente.bat`, e o servidor local sempre tem prioridade.

## Arquitetura publicada

```
┌────────────────────────────┐
│  App (site estático)       │  GitHub Pages / Cloudflare Pages / Netlify
│  ferramentas no navegador  │  ← grátis, sem hibernar
└─────────┬──────────────────┘
          │ HTTPS
          └──────────────► Removedor de Fundo (IA)   → Hugging Face Spaces (Docker)
```

O arquivo **`src/server-config.js`** é o coração disso: a ferramenta testa os
endereços na ordem *(salvo no navegador → localhost → nuvem)* e usa o primeiro que
responder. Publicar = subir o servidor do Removedor e preencher o campo `REMOTE`
desse arquivo.

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

## Passo 3 — Removedor de Fundo na nuvem (Hugging Face Spaces)

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

## Passo 4 — Apontar o app para o servidor

Edite **`src/server-config.js`** e preencha com a URL do passo 3:

```js
const REMOTE = {
  removedor: 'https://seu-usuario-agente-removedor.hf.space',
};
```

Depois:

```bash
npm run verify         # lint + testes + manifesto
npm run bump:version   # invalida o cache do service worker
git add -A && git commit -m "Servidor remoto configurado" && git push
```

Pronto. Quem abrir o app publicado usa a nuvem sem configurar nada; quem roda no
PC continua usando o servidor local (ele tem prioridade na ordem de teste).

---

## Ressalvas conhecidas

- **Hibernação (planos grátis):** o HF Spaces "dorme" após ~15 min sem uso; a
  primeira requisição demora até 1 min. A ferramenta avisa o usuário e reconecta
  sozinha (mensagem "o servidor gratuito hiberna…").
- **Removedor no plano grátis:** sem GPU. Para produção séria, considere hardware
  pago no HF (a partir de ~US$ 0,05/h) ou uma máquina própria.
- **Override por navegador (avançado):** dá para apontar um navegador específico
  para outro servidor sem mexer no código — no console:
  `localStorage.setItem('agente:server:removedor', 'https://outra-url')`.
  Remover: `localStorage.removeItem(...)`.
