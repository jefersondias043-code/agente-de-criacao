"""
Removedor de Fundo — servidor de IA (FastAPI + rembg).

Backend DEDICADO da ferramenta "Removedor de Fundo" da plataforma Agente.
A IA de segmentação roda AQUI (no PC), com qualidade alta e GPU quando houver;
o navegador só faz a edição fina (pincel, sensibilidade, halo, trocar fundo).

Filosofia (igual ao VideoGrab):
- Serviço LOCAL por padrão: bind em 127.0.0.1; CORS '*' para funcionar inclusive
  via file:// (onde o Origin chega como "null"). Não serve o app — é só a API.
  Também roda na NUVEM (Docker/HF Spaces): HOST=0.0.0.0 + PORT via ambiente.
- Sem SSRF: processa APENAS os bytes da imagem enviada; nunca busca URLs.
- Devolve a MÁSCARA em tons de cinza (branco=manter, preto=remover, cinza=parcial)
  na resolução do original. Toda a composição/edição acontece no navegador.

Endpoints:
  GET  /health           -> { ok, gpu, models, default_model }
  POST /remove           -> PNG (L) máscara do objeto principal
  POST /segment          -> PNG (L) máscara do objeto clicado (SAM)

Requisitos: ver requirements.txt. Modelos baixam na 1ª execução (cache do rembg).
"""

import io
import json
import os

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from PIL import Image

# rembg é importado de forma preguiçosa (a 1ª sessão baixa o modelo). Import no
# topo para falhar cedo com mensagem clara se a lib não estiver instalada.
try:
    from rembg import new_session, remove
except Exception as _e:  # pragma: no cover - ambiente sem rembg
    new_session = None
    remove = None
    _REMBG_IMPORT_ERROR = _e
else:
    _REMBG_IMPORT_ERROR = None

PORT = int(os.environ.get("PORT", "7000"))
# Local por padrão (127.0.0.1 = não exposto na rede). Na nuvem (Docker/HF
# Spaces), defina HOST=0.0.0.0 — o Dockerfile desta pasta já faz isso.
HOST = os.environ.get("HOST", "127.0.0.1")
MAX_BYTES = 25 * 1024 * 1024  # 25 MB por imagem

# Modelos oferecidos ao usuário (id do rembg -> rótulo amigável).
MODELS = {
    "birefnet-general": "Alta qualidade (BiRefNet)",
    "isnet-general-use": "Equilibrado (ISNet)",
    "u2net": "Rápido (U²-Net)",
    "u2netp": "Leve (U²-Net pequeno)",
}
DEFAULT_MODEL = "birefnet-general"
SAM_MODEL = "sam"

# Cache de sessões do rembg por modelo (evita recarregar a cada requisição).
_sessions = {}


def _gpu_available() -> bool:
    try:
        import onnxruntime as ort  # noqa: WPS433
        return "CUDAExecutionProvider" in ort.get_available_providers()
    except Exception:
        return False


def _get_session(model: str):
    if new_session is None:
        raise HTTPException(status_code=500, detail=(
            "Biblioteca 'rembg' não instalada. Rode: pip install -r requirements.txt "
            f"(erro: {_REMBG_IMPORT_ERROR})"
        ))
    if model not in _sessions:
        _sessions[model] = new_session(model)
    return _sessions[model]


def _read_image(upload: UploadFile, raw: bytes) -> Image.Image:
    if upload.content_type and not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Envie um arquivo de imagem.")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Imagem grande demais (máx. 25 MB).")
    try:
        return Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Não foi possível ler a imagem.")


def _mask_to_png(mask: Image.Image) -> bytes:
    buf = io.BytesIO()
    mask.convert("L").save(buf, format="PNG")
    return buf.getvalue()


app = FastAPI(title="Removedor de Fundo — Agente", version="1.0.0")

# CORS liberado: o frontend vive embutido na plataforma (removedor.html), em outra
# origem — inclusive file:// (Origin "null"). Só GET/POST simples de imagem.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return JSONResponse({
        "ok": True,
        "gpu": _gpu_available(),
        "models": [{"id": k, "label": v} for k, v in MODELS.items()],
        "default_model": DEFAULT_MODEL,
        "rembg": _REMBG_IMPORT_ERROR is None,
    })


@app.post("/remove")
async def remove_bg(
    image: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL),
    matting: str = Form("1"),
):
    """Segmenta o objeto principal e devolve a MÁSCARA (PNG L) na resolução original."""
    raw = await image.read()
    img = _read_image(image, raw)
    if model not in MODELS:
        model = DEFAULT_MODEL
    session = _get_session(model)

    use_matting = str(matting) not in ("0", "false", "no", "")
    try:
        # only_mask=True → devolve a máscara (L) já refinada pela alpha matting.
        mask = remove(
            img,
            session=session,
            only_mask=True,
            alpha_matting=use_matting,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10,
            post_process_mask=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha na segmentação: {e}")

    if not isinstance(mask, Image.Image):
        # Algumas versões retornam bytes quando a entrada é bytes; aqui a entrada é
        # PIL, então esperamos PIL. Salvaguarda:
        mask = Image.open(io.BytesIO(mask))
    return Response(content=_mask_to_png(mask), media_type="image/png")


@app.post("/segment")
async def segment_point(
    image: UploadFile = File(...),
    points: str = Form("[]"),
):
    """Seleção de objeto por clique (SAM). points = JSON [{x,y,label}] em pixels."""
    raw = await image.read()
    img = _read_image(image, raw)
    try:
        pts = json.loads(points or "[]")
    except Exception:
        pts = []
    if not pts:
        raise HTTPException(status_code=400, detail="Nenhum ponto informado.")

    input_points = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in pts]
    input_labels = [int(p.get("label", 1)) for p in pts]

    session = _get_session(SAM_MODEL)
    try:
        mask = remove(
            img,
            session=session,
            only_mask=True,
            post_process_mask=True,
            sam_prompt=[{"type": "point", "data": pt, "label": lb}
                        for pt, lb in zip(input_points, input_labels)],
        )
    except TypeError:
        # Compat: versões que usam input_points/input_labels diretamente.
        mask = remove(
            img, session=session, only_mask=True, post_process_mask=True,
            input_points=input_points, input_labels=input_labels,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha no SAM: {e}")

    if not isinstance(mask, Image.Image):
        mask = Image.open(io.BytesIO(mask))
    return Response(content=_mask_to_png(mask), media_type="image/png")


if __name__ == "__main__":
    import uvicorn
    print(f"Removedor de Fundo rodando em http://{HOST}:{PORT}  (GPU: {_gpu_available()})")
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")
