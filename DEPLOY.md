# Publicando a plataforma na internet

> Guia para colocar o **Agente** no ar para qualquer usuário. Boa notícia: o app
> é **100% estático** — todas as ferramentas rodam no próprio navegador, sem
> nenhum servidor de apoio. Não há build. A pasta publicada é a raiz do
> repositório. Nada muda para quem usa localmente (duplo-clique / `Agente.bat`).

## Arquitetura publicada

```
┌────────────────────────────────────┐
│  App (site estático)               │  GitHub Pages / Cloudflare Pages / Netlify
│  TODAS as ferramentas no navegador │  ← grátis, sem servidor, sem hibernar
└────────────────────────────────────┘
```

O **Removedor de Fundo** também roda inteiro no navegador: a segmentação usa
ONNX Runtime Web + o modelo U²-Netp, ambos vendorizados no repositório
(`vendor/ort/` e `models/u2netp.onnx`). O motor (~11 MB) e o modelo (~4,6 MB)
são baixados **uma única vez** na primeira abertura da ferramenta e ficam no
cache do service worker (servidos cache-first). Funciona igual no celular e no
computador — e offline, depois do primeiro uso.

> Detector Flop, AutoPost IA e Replicador são páginas embutidas (iframe), também
> sem servidor.

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
Não há passo de build nem servidor a manter.

## Passo 3 — Publicar

```bash
npm run verify         # lint + testes + manifesto
npm run bump:version   # invalida o cache do service worker
git add -A && git commit -m "Publicação" && git push
```

Pronto. Todo mundo — celular ou computador — usa a plataforma inteira sem
configurar nada.

---

## Ressalvas conhecidas

- **Primeiro uso do Removedor de Fundo:** baixa ~15 MB (motor + modelo de IA)
  uma vez; a ferramenta mostra uma barra de progresso. Depois disso abre na hora,
  inclusive offline.
- **Modo arquivo local (`file://`, duplo-clique):** navegadores bloqueiam parte
  do carregamento de módulos/modelos por `file://`. As ferramentas de IA (como o
  Removedor) pedem a **versão publicada por HTTPS**. O resto do app funciona
  normalmente por duplo-clique.
- **Threads da IA:** o GitHub Pages não envia os cabeçalhos COOP/COEP, então o
  motor roda em thread única (com SIMD). É suficiente — alguns segundos por
  imagem. Se você hospedar num lugar que permita esses cabeçalhos, o ORT usa
  múltiplas threads automaticamente e fica ainda mais rápido.
