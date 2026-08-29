# Ponte para a API da OpenAI

## O problema que ela resolve

A plataforma roda inteira no navegador — não há servidor no meio, e é isso que
mantém sua chave no seu aparelho. O preço disso é uma regra do navegador: ele só
deixa a página falar com outro domínio se esse domínio autorizar por cabeçalho
(CORS).

| Provedor | Autoriza chamada de navegador? |
| --- | --- |
| Groq | Sim, qualquer origem — nada a fazer |
| Anthropic | Sim, sob pedido — o app já manda o cabeçalho que ela exige |
| OpenAI | **Não** — o pedido é barrado antes de sair |

Com a OpenAI, o erro aparece como *"o pedido não chegou a sair do navegador"*,
mesmo com chave válida e crédito na conta. Não é defeito do app nem da chave.

## O que a ponte faz

Ela recebe o pedido do navegador, repassa para a OpenAI e devolve a resposta com
a autorização que faltava. São ~60 linhas, roda de graça e você é o dono.

**A chave continua sendo sua.** A ponte não guarda chave nenhuma: repassa o
cabeçalho `Authorization` que veio do navegador. O modelo de confiança é o mesmo
de antes — a chave sai do seu aparelho direto para a OpenAI, só que por um
caminho que o navegador aceita. Quem descobrir o endereço da ponte não ganha
nada: sem chave, a OpenAI recusa.

## Como publicar (5 minutos, sem cartão)

1. Entre em <https://dash.cloudflare.com> → **Workers & Pages** → **Create** →
   **Worker**.
2. Dê um nome (ex.: `ponte-openai`) e clique em **Deploy**.
3. Clique em **Edit code**, apague o exemplo, cole o conteúdo de
   [`openai-worker.js`](./openai-worker.js) e publique (**Deploy**).
4. Copie o endereço que aparece — algo como
   `https://ponte-openai.SEU-NOME.workers.dev`.
5. No app: **Configurações → OpenAI → Avançado · endereço da API** e cole o
   endereço **com `/v1` no fim**:

   ```
   https://ponte-openai.SEU-NOME.workers.dev/v1
   ```

Pronto. A chave da OpenAI que você já tem passa a funcionar no app.

## Recomendado depois de testar

No topo do `openai-worker.js` existe a lista `ORIGENS_PERMITIDAS`. Vazia, a
ponte atende qualquer página — funciona, mas deixa outras pessoas gastarem a
cota gratuita dela. Ponha o endereço do seu app e publique de novo:

```js
const ORIGENS_PERMITIDAS = ['https://jefersondias043-code.github.io'];
```

## Alternativa sem publicar nada

Se preferir não manter uma ponte, o campo **Endereço da API** aceita qualquer
servidor que fale o dialeto da OpenAI. O [OpenRouter](https://openrouter.ai)
serve os modelos da OpenAI por um domínio que autoriza o navegador:

- Endereço: `https://openrouter.ai/api/v1`
- Chave: a do OpenRouter
- Modelo: no formato deles, ex.: `openai/gpt-5.6-terra`

A diferença é que a cobrança passa a ser do OpenRouter, não da OpenAI.
