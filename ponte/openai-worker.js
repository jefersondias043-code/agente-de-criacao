/* ============================================================================
 * PONTE PARA A API DA OPENAI — Cloudflare Worker
 *
 * POR QUE ISTO EXISTE
 * A plataforma roda inteira no navegador. O navegador só deixa uma página falar
 * com outro domínio se esse domínio autorizar por cabeçalho (CORS). A Groq
 * autoriza; a Anthropic autoriza sob pedido; a OpenAI não autoriza — o pedido é
 * barrado antes de sair, com chave válida e crédito na conta.
 *
 * Esta ponte é o intermediário que resolve isso: ela recebe o pedido do
 * navegador, repassa para a OpenAI e devolve a resposta COM a autorização que
 * faltava. São ~60 linhas, roda de graça e você é o dono dela.
 *
 * A CHAVE CONTINUA SENDO SUA
 * A ponte NÃO guarda chave nenhuma. Ela repassa o cabeçalho Authorization que
 * veio do navegador. Ou seja: o modelo de confiança é o mesmo de antes — a
 * chave fica no seu aparelho e vai direto para a OpenAI, só que por um caminho
 * que o navegador aceita. Quem descobrir o endereço da ponte não ganha nada:
 * sem chave, a OpenAI recusa.
 *
 * COMO PUBLICAR (5 minutos, sem cartão)
 *   1. Entre em https://dash.cloudflare.com → Workers & Pages → Create → Worker.
 *   2. Dê um nome (ex.: "ponte-openai") e clique em Deploy.
 *   3. Clique em "Edit code", apague o exemplo, cole ESTE arquivo inteiro e
 *      publique (Deploy).
 *   4. Copie o endereço que aparece — algo como
 *      https://ponte-openai.SEU-NOME.workers.dev
 *   5. No app: Configurações → OpenAI → "Avançado · endereço da API" e cole
 *      o endereço com /v1 no fim:
 *      https://ponte-openai.SEU-NOME.workers.dev/v1
 *
 * Pronto. A chave da OpenAI que você já tem passa a funcionar no app.
 * ========================================================================== */

/* Quem pode usar esta ponte. Vazio = qualquer origem — funciona, mas deixa a
   ponte aberta para outras páginas gastarem a cota gratuita dela. Recomendado:
   ponha o endereço do SEU app, ex.:
     ['https://jefersondias043-code.github.io'] */
const ORIGENS_PERMITIDAS = [];

/* A ponte só fala com a API da OpenAI, e só nas rotas /v1/*. Sem esta trava ela
   viraria um proxy genérico para a internet inteira. */
const DESTINO = 'https://api.openai.com';
const PREFIXO_PERMITIDO = '/v1/';

function origemLiberada(origem) {
  if (!ORIGENS_PERMITIDAS.length) return origem || '*';
  return ORIGENS_PERMITIDAS.includes(origem) ? origem : '';
}

function cabecalhosCors(origem) {
  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    // Os cabeçalhos que o app envia. 'authorization' é o que carrega a chave.
    'Access-Control-Allow-Headers': 'authorization, content-type, openai-organization, openai-project',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request) {
    const origem = origemLiberada(request.headers.get('Origin'));
    if (!origem) return new Response('Origem não autorizada nesta ponte.', { status: 403 });

    // Preflight: é o pedido que o navegador manda ANTES do de verdade, para
    // perguntar se pode. Responder isto é metade do trabalho da ponte.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cabecalhosCors(origem) });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith(PREFIXO_PERMITIDO)) {
      return new Response('Esta ponte só atende as rotas /v1/ da OpenAI.', {
        status: 404, headers: cabecalhosCors(origem),
      });
    }

    const resposta = await fetch(DESTINO + url.pathname + url.search, {
      method: request.method,
      // Repassa a chave do usuário como veio. A ponte não guarda nem lê chave.
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
      },
      body: request.method === 'GET' ? undefined : request.body,
    });

    // Devolve a resposta da OpenAI intacta — status, corpo e tipo — só que
    // agora com a autorização que o navegador exigia.
    const saida = new Response(resposta.body, resposta);
    Object.entries(cabecalhosCors(origem)).forEach(([k, v]) => saida.headers.set(k, v));
    return saida;
  },
};
