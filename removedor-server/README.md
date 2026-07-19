# Removedor de Fundo — servidor de IA

Backend da ferramenta **Removedor de Fundo** da plataforma Agente. É aqui que a
**inteligência artificial** roda: ela detecta o objeto principal da foto (pessoa,
animal, produto, veículo, comida, planta…) e devolve uma **máscara de recorte** de
alta qualidade, preservando cabelos, pelos e detalhes finos. Toda a edição fina
(pincel, sensibilidade, suavizar bordas, remover halo, trocar o fundo) acontece
**no navegador** — o servidor só faz a parte pesada da IA.

> Este servidor é **só a API de IA** (porta **7000**). Ele NÃO serve o app — o app
> continua abrindo por duplo-clique (`file://`) ou pelo VideoGrab. Os dois
> servidores convivem (VideoGrab = 3000, Removedor = 7000).

## Uso normal (recomendado)

1. **Instale uma vez:** dê dois cliques em **`Instalar Removedor.bat`** (na raiz da
   plataforma). Ele cria um ambiente Python isolado (`venv`) e baixa a IA. Pode
   levar alguns minutos na primeira vez (os modelos são grandes).
2. **Use:** dê dois cliques em **`Removedor.bat`** para ligar o servidor (abre uma
   janela — deixe-a aberta enquanto usar a ferramenta). Depois abra a plataforma e
   vá em **Removedor de Fundo**. O card de status fica verde ("IA conectada").
3. **Desligar:** feche a janela do `Removedor.bat`.

Na **primeira remoção** de cada modelo, a IA baixa o arquivo do modelo (uma vez só);
as próximas são rápidas.

## Requisitos

- **Python 3.10 ou superior** — instale em <https://www.python.org/downloads/> e
  marque **"Add Python to PATH"** no instalador.
- Conexão de internet na primeira instalação (para baixar a IA).
- **GPU é opcional.** Sem placa NVIDIA, roda na CPU (mais lento, mas funciona).

## Instalação manual (alternativa ao `.bat`)

A partir desta pasta (`removedor-server`):

```bash
python -m venv venv
venv\Scripts\activate            # Windows
pip install -r requirements.txt
python server.py                 # sobe em http://127.0.0.1:7000
```

Teste se está no ar abrindo <http://127.0.0.1:7000/health> — deve responder
`{"ok": true, ...}`.

## GPU (NVIDIA/CUDA) — opcional, mais rápido

Se você tem uma placa NVIDIA com CUDA, edite `requirements.txt` trocando:

- `rembg[cpu]` → `rembg[gpu]`
- `onnxruntime` → `onnxruntime-gpu`

e reinstale (`pip install -r requirements.txt`). O `/health` passa a mostrar
`"gpu": true`.

## Modelos de IA

| id | Modelo | Uso |
|---|---|---|
| `birefnet-general` | **BiRefNet** | Padrão — máxima qualidade, bordas e cabelo |
| `isnet-general-use` | **ISNet** | Equilíbrio velocidade/qualidade |
| `u2net` / `u2netp` | **U²-Net** | Rápido / leve (bom para CPU fraca) |
| `sam` | **Segment Anything** | Seleção de objeto por clique |

Os modelos vêm da biblioteca [`rembg`](https://github.com/danielgatis/rembg) (MIT),
que também aplica o *alpha matting* (refino de bordas) no servidor.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Status: `{ ok, gpu, models, default_model }` |
| `POST` | `/remove` | `multipart: image` (+ `model`, `matting`) → **máscara PNG** (cinza) do objeto principal |
| `POST` | `/segment` | `multipart: image` + `points` (JSON `[{x,y,label}]`) → máscara do objeto clicado (SAM) |

A resposta é sempre a **máscara em tons de cinza** na resolução do original
(branco = manter, preto = remover, cinza = transição). O navegador aplica a máscara
ao canal alfa e faz todo o resto localmente.

## Publicando na nuvem (versão online do app)

Passo a passo completo em **`DEPLOY.md`** (raiz do projeto). Resumo: crie um
**Hugging Face Space** (SDK Docker, CPU grátis) com os arquivos `Dockerfile`,
`server.py` e `requirements.txt` desta pasta — o Dockerfile já define
`HOST=0.0.0.0` e `PORT=7860` (padrão do HF). Depois preencha a URL do Space no
campo `REMOTE.removedor` de **`src/server-config.js`** — o frontend testa o
servidor local primeiro e cai para a nuvem sozinho quando não há servidor local.

## Segurança

- Escuta **apenas em `127.0.0.1`** por padrão (não fica exposto na rede). Na
  nuvem, o container define `HOST=0.0.0.0` — necessário para receber tráfego.
- Processa **somente os bytes da imagem enviada** — nunca busca URLs (sem SSRF).
- Limite de **25 MB** por imagem; aceita apenas `image/*`.
- `CORS: *` é intencional e seguro aqui: permite que o app rodando por `file://`
  (origem `null`) fale com o servidor local — mesmo padrão do VideoGrab.
