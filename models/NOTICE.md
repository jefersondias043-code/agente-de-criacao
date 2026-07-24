# Modelo de segmentação — U²-Netp (vendorizado)

`u2netp.onnx` é o modelo que o Removedor de Fundo usa para separar o objeto
principal do fundo, rodando localmente no navegador via ONNX Runtime Web.

- Modelo: **U²-Net** (variante leve `u2netp`)
- Artigo: Qin et al., *"U²-Net: Going Deeper with Nested U-Structure for
  Salient Object Detection"*, Pattern Recognition, 2020.
- Repositório: https://github.com/xuebinqin/U-2-Net
- Licença: **Apache-2.0**
- Arquivo `.onnx` obtido do release de modelos do rembg
  (https://github.com/danielgatis/rembg), que redistribui os pesos.
- sha256: `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`
- Tamanho: ~4,6 MB · Entrada `input.1` [1,3,320,320] · Saída principal
  `1959` [1,1,320,320] (mapa de saliência 0..1).

Escolhido por ser **pequeno** (baixa rápido no celular), de **licença
permissiva** e **propósito geral** (não só pessoas). O mesmo arquivo roda
igual no celular e no computador — daí a qualidade ser idêntica nas duas
plataformas. Baixado uma única vez e mantido no cache do service worker.

Pré-processamento (idêntico ao rembg): redimensiona para 320×320, divide por
255 e normaliza por canal com `mean=[0.485,0.456,0.406]`,
`std=[0.229,0.224,0.225]`. O mapa de saliência é reescalonado para a resolução
original e usado como canal alfa.
