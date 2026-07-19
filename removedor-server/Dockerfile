# Removedor de Fundo — imagem para nuvem (Hugging Face Spaces / Docker).
# O Space Docker do HF expõe a porta 7860 por padrão (metadado app_port).
# Guia completo de publicação: DEPLOY.md na raiz do projeto.
FROM python:3.12-slim

# onnxruntime precisa de libgomp; opencv-headless (dep. do rembg) de libglib.
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

# Usuário sem privilégios (exigência/boa prática do HF Spaces).
RUN useradd -m -u 1000 user && chown -R user /app
USER user

# Cache dos modelos do rembg no HOME do usuário (baixam na 1ª execução).
ENV HOME=/home/user \
    U2NET_HOME=/home/user/.u2net \
    HOST=0.0.0.0 \
    PORT=7860

EXPOSE 7860

CMD ["python", "server.py"]
