# ONNX Runtime Web (vendorizado)

Arquivos deste diretório fazem parte do **ONNX Runtime Web**, usado pelo
Removedor de Fundo para rodar a segmentação de imagem 100% no navegador
(sem servidor).

- Projeto: https://github.com/microsoft/onnxruntime
- Versão: **1.19.2** (pacote npm `onnxruntime-web`)
- Licença: **MIT** — Copyright (c) Microsoft Corporation.

Arquivos:

| arquivo | papel | sha256 |
|---|---|---|
| `ort.wasm.min.js` | loader clássico (expõe `window.ort`, só backend WASM) | `98e831517582c08fc1b729def487a8b0152c83fc641746137eb4c7ad46032f1c` |
| `ort-wasm-simd-threaded.wasm` | kernel WASM (SIMD; cai p/ single-thread sem COOP/COEP) | `1bf0b9ed7ad025cf9ca88ce6da29e54df3f128a169f8241d71823e81f078d578` |
| `ort-wasm-simd-threaded.mjs` | glue de instanciação do WASM | `d870a377322c3053fb97432d548423f165dd15e2af232947592fc07b0d2f3639` |

Vendorizado (em vez de CDN) porque o app precisa funcionar offline / como PWA
e sem depender de terceiros. O `.wasm` só é baixado na primeira vez que a
ferramenta é aberta e fica no cache do service worker.

Para atualizar: `npm i onnxruntime-web@<versão>` e copiar
`node_modules/onnxruntime-web/dist/{ort.wasm.min.js,ort-wasm-simd-threaded.wasm,ort-wasm-simd-threaded.mjs}`
para cá.
