'use strict';
/* ============================================================================
 * EMBALAGEM — sugerir título e legenda a partir do que a ferramenta já tem
 *
 * O Julgador já recebe a transcrição inteira do vídeo e a descrição visual.
 * Com isso na mão, pedir que o autor escreva título e legenda do zero é deixar
 * de usar o que já está ali.
 *
 * A REGRA QUE GOVERNA TUDO AQUI: título e legenda existem para fazer a pessoa
 * QUERER assistir — não para contar o que ela veria assistindo. A linha é entre
 * SITUAÇÃO (o que está em jogo: quem, onde, o que se esperava) e DESFECHO (a
 * resposta: como terminou, quanto era, quem era, qual o segredo). Situação pode
 * e deve aparecer; desfecho não.
 *
 * E ISSO NÃO É PERMISSÃO PARA SER VAGO. "Olha o que aconteceu" não desperta
 * curiosidade: desperta desconfiança. A curiosidade vem de um detalhe CONCRETO
 * da situação combinado com uma resposta retida. Concreto no começo, calado no
 * fim.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO REPETE CÓDIGO DO AUTOPOST
 *
 * O AutoPost (r224) já resolveu este mesmo problema no pacote de publicação, e
 * o que vale ali vale aqui — é o mesmo defeito, na mesma língua, sobre o mesmo
 * tipo de vídeo. Reescrever a doutrina com outras palavras criaria duas noções
 * de spoiler que iriam divergindo em silêncio.
 *
 * Então: `EMB_REGRAS_SEM_SPOILER` é CÓPIA DECLARADA de `REGRAS_SEM_SPOILER`
 * (autopost-ia/js/api.js), byte a byte, com teste que quebra se divergirem. A
 * conferência de código é a mesma de `autopost-ia/js/package.js`, e há teste de
 * equivalência sobre um corpus: onde as duas se sobrepõem, respondem igual.
 *
 * O AutoPost é um pacote fechado (precisa abrir por file:// sem a plataforma em
 * volta) e a plataforma não carrega os arquivos dele. Duas casas, uma doutrina,
 * testes no meio para que continue sendo uma só.
 *
 * A DIFERENÇA DELIBERADA, e ela existe porque aqui há uma fonte a mais:
 * o Julgador tem a descrição visual. Uma coisa que aparece na TELA desde o
 * começo não é desfecho escondido — está à vista de quem assiste. Então o
 * visual entra como fonte do que JÁ SE SABE, e não como parte do fim. É o mesmo
 * raciocínio do r222, quando a promessa da capa passou a ser conferida contra
 * as duas fontes em vez de só contra a fala.
 * ========================================================================== */

/* CÓPIA DECLARADA de REGRAS_SEM_SPOILER (autopost-ia/js/api.js). Byte a byte:
 * test/embalagem.test.js compara as duas e quebra se uma andar sem a outra. */
const EMB_REGRAS_SEM_SPOILER = `==== O QUE O PACOTE PODE CONTAR — LEIA ANTES DE ESCREVER TÍTULO E LEGENDA ====
O título e a legenda existem para fazer a pessoa QUERER assistir. Não para contar o que ela veria assistindo.

A linha é entre SITUAÇÃO e DESFECHO:
- SITUAÇÃO é o que está em jogo: quem, onde, o que estava acontecendo, o que se esperava, o problema instalado. Isso PODE e DEVE aparecer — sem contexto ninguém se interessa.
- DESFECHO é a resposta: como terminou, o que se descobriu, quem era, quanto foi, se deu certo, qual era o segredo, o número final, a reviravolta. Isso NÃO aparece. É o que a pessoa vai ao vídeo buscar.

O TESTE, e ele é simples: depois de ler o título e a legenda, ainda sobra uma pergunta cuja resposta só está no vídeo?
- Se sobra ("e aí, o que aconteceu?", "como terminou?", "quanto era?", "quem fez isso?") — está certo.
- Se não sobra, você escreveu um resumo. Reescreva tirando a resposta e deixando a pergunta.

CUIDADO COM O FIM DO ROTEIRO. O desfecho mora nos últimos trechos do conteúdo. Uma informação que só aparece lá é justamente a que não pode vir para o pacote — nem no título, nem na legenda, nem como "gancho".

Isto NÃO é permissão para ser vago. Título genérico ("olha o que aconteceu") não desperta curiosidade nenhuma: desperta desconfiança. A curiosidade vem de um detalhe CONCRETO da situação — o objeto, o lugar, a quantia, a profissão, a frase que alguém disse — combinado com uma resposta retida. Concreto no começo, calado no fim.

Exemplo do raciocínio (o conteúdo é outro; o que se aproveita é a lógica):
Vídeo: um homem compra um relógio do vizinho por vinte reais e revende por duzentos na mesma tarde.
✗ resumo — conta o fim: "Comprou o relógio por 20 e revendeu por 200 no mesmo dia"
✓ pacote — retém a resposta: "O vizinho vendeu o relógio por vinte reais. O que ele não sabia é o que ia acontecer meia hora depois"
A diferença: os dois dão a situação; só o primeiro entrega o resultado.`;

/* ---------------------------------------------------------------------------
 * A CONFERÊNCIA DE CÓDIGO
 *
 * Prompt é pedido; conferência é medida. O modelo lê a doutrina acima e mesmo
 * assim escorrega — por isso nada sai daqui sem passar por esta parte, que não
 * tem opinião.
 *
 * O que dá para medir com honestidade: o desfecho mora no fim do conteúdo.
 * Número e nome próprio que ESTREIAM no último terço são o pagamento da
 * história. Se um deles aparece no título, o fim vazou.
 *
 * Note o que NÃO se mede: se o título "conta demais" em geral. Isso é juízo, e
 * o r224 já tentou medir por abrangência — a conferência reprovava o pacote
 * certo, porque palavra comum se repete ao longo de qualquer roteiro. Um alarme
 * falso empurra a sugestão para o vago, que é defeito pior do que o spoiler que
 * se queria evitar. Ficou uma conferência só, estreita e confiável.
 * ------------------------------------------------------------------------- */

// Roteiro curto não tem terços: sem isso, qualquer palavra do fim viraria
// "desfecho" e a conferência gritaria à toa.
const EMB_SPOILER_MIN_PALAVRAS = 60;

const EMB_VAZIAS = new Set([
  'para', 'pela', 'pelo', 'pelas', 'pelos', 'como', 'mais', 'menos', 'muito', 'muita',
  'todo', 'toda', 'todos', 'todas', 'esse', 'essa', 'esses', 'essas', 'este', 'esta',
  'isso', 'aquilo', 'aquele', 'aquela', 'quando', 'porque', 'entao', 'ainda', 'depois',
  'antes', 'sobre', 'entre', 'sempre', 'nunca', 'tambem', 'apenas', 'assim', 'onde',
  'quem', 'qual', 'quais', 'seja', 'foram', 'estava', 'estao', 'tinha', 'tinham',
  'fazer', 'fazendo', 'disse', 'dizer', 'gente', 'coisa', 'coisas', 'vezes', 'cada',
  'outro', 'outra', 'outros', 'outras', 'mesmo', 'mesma', 'aqui', 'agora', 'hoje',
  'bem', 'pouco', 'nada', 'tudo', 'algum', 'alguma', 'nao', 'sim', 'voce', 'voces',
]);

/* Número por extenso — a quantia pode estar escrita das duas formas, e as duas
 * são o mesmo desfecho. */
const EMB_NUMEROS_ESCRITOS = new Set([
  'dois', 'duas', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'catorze', 'quatorze', 'quinze', 'dezesseis',
  'dezessete', 'dezoito', 'dezenove', 'vinte', 'trinta', 'quarenta', 'cinquenta',
  'sessenta', 'setenta', 'oitenta', 'noventa', 'cem', 'cento', 'duzentos',
  'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos',
  'oitocentos', 'novecentos', 'mil', 'milhao', 'milhoes', 'bilhao', 'bilhoes',
]);

function _embNormalizar(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Termos que carregam conteúdo (≥4 letras, fora da lista de vazias). */
function embPalavrasDoConteudo(texto) {
  const brutas = _embNormalizar(texto).split(/[^a-z0-9]+/);
  return [...new Set(brutas.filter((w) => w.length >= 4 && !EMB_VAZIAS.has(w)))];
}

function _embEhNumero(palavraNormalizada) {
  return /^\d+$/.test(palavraNormalizada) || EMB_NUMEROS_ESCRITOS.has(palavraNormalizada);
}

/* Nome próprio: maiúscula que NÃO abre a frase. A primeira palavra de cada
 * frase é sempre maiúscula e não diz nada sobre ser nome. */
function _embNomesProprios(trecho) {
  const nomes = new Set();
  String(trecho || '').split(/(?<=[.!?…])\s+|\n+/).forEach((frase) => {
    frase.trim().split(/\s+/).slice(1).forEach((bruta) => {
      const limpa = bruta.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, '');
      if (limpa.length < 3) return;
      if (!/^[A-ZÁÂÃÀÉÊÍÓÔÕÚÜÇ]/.test(limpa)) return;
      nomes.add(_embNormalizar(limpa).replace(/[^a-z0-9]/g, ''));
    });
  });
  return nomes;
}

/**
 * Número e nome próprio que SÓ aparecem no último terço da FALA — o desfecho
 * vazável.
 *
 * Os terços saem da transcrição e só dela. A descrição visual não é a
 * continuação do vídeo, é outro documento sobre o mesmo vídeo: emendar as duas
 * jogaria o texto visual inteiro dentro do "último terço" e faria dele desfecho
 * por acidente de posição.
 *
 * O visual entra por outro lado, e é a diferença desta ferramenta para o
 * AutoPost: o que está NA TELA está à vista de quem assiste, então não é
 * resposta escondida. Uma placa com o nome da loja, um número na camisa, o
 * rosto de quem aparece — nada disso o título "entrega", porque o vídeo já
 * entregou no primeiro quadro.
 */
function embPalavrasDoDesfecho(conteudo, visual) {
  const brutas = String(conteudo || '').trim().split(/\s+/).filter(Boolean);
  if (brutas.length < EMB_SPOILER_MIN_PALAVRAS) return [];
  const corte = Math.floor((brutas.length * 2) / 3);
  const inicio = brutas.slice(0, corte).join(' ');
  const fim = brutas.slice(corte).join(' ');

  const jaVisto = new Set(
    embPalavrasDoConteudo(inicio)
      .concat([..._embNomesProprios(inicio)])
      .concat(embPalavrasDoConteudo(visual || ''))
      .concat([..._embNomesProprios(visual || '')])
  );
  const nomesDoFim = _embNomesProprios(fim);
  return embPalavrasDoConteudo(fim)
    .filter((w) => (_embEhNumero(w) || nomesDoFim.has(w)) && !jaVisto.has(w));
}

/** Quais dessas palavras o texto usa. */
function embSpoilersEm(texto, desfecho) {
  const usadas = new Set(embPalavrasDoConteudo(texto));
  return (desfecho || []).filter((w) => usadas.has(w));
}

/* No título, UMA palavra do desfecho já é o fim entregue: ele tem 50 a 80
 * caracteres, não há palavra ali por acaso. Na legenda o limite é 2 — ela tem
 * espaço para contextualizar, e uma coincidência isolada não é spoiler. */
const EMB_MAX_TITULO = 0;
const EMB_MAX_LEGENDA = 1;

function embAuditarSpoiler(sugestao, conteudo, visual) {
  const s = sugestao || {};
  const desfecho = embPalavrasDoDesfecho(conteudo, visual);
  const noTitulo = embSpoilersEm(s.titulo, desfecho);
  const naLegenda = embSpoilersEm(s.legenda, desfecho);

  const problemas = [];
  if (noTitulo.length > EMB_MAX_TITULO) {
    problemas.push(`O título entrega o desfecho: "${noTitulo.join('", "')}" só acontece no fim do vídeo. Quem lê isso já sabe como termina e não precisa assistir. Diga o que está em jogo, não como acaba.`);
  }
  if (naLegenda.length > EMB_MAX_LEGENDA) {
    problemas.push(`A legenda entrega o desfecho: "${naLegenda.join('", "')}" só acontece no fim do vídeo. A legenda contextualiza; quem revela o final é o vídeo.`);
  }
  return {
    desfecho, noTitulo, naLegenda,
    problemas, ok: problemas.length === 0,
    // Sem fala longa o bastante não há terços, e não há o que conferir. Dizer
    // "ok" aqui seria afirmar o que não foi medido.
    conferido: desfecho.length > 0,
  };
}

/* ---------------------------------------------------------------------------
 * O PEDIDO
 * ------------------------------------------------------------------------- */

const EMB_MAX_TITULO_CHARS = 90;
const EMB_MAX_LEGENDA_CHARS = 320;

/**
 * O prompt. Recebe as duas fontes separadas e nomeadas, como faz
 * `julgBlocoConteudo` — exigir da fala o que a imagem entregou é o defeito que
 * o r222 corrigiu, e aqui ele voltaria como título que descreve o que já está
 * na tela.
 *
 * `problemas` só chega na segunda tentativa: é o que a conferência achou na
 * primeira, com as palavras exatas que vazaram.
 */
function buildEmbalagemPrompt(conteudo, visual, opcoes) {
  const o = opcoes || {};
  const linhas = [];
  linhas.push('Você escreve a EMBALAGEM de um vídeo curto: o título e a legenda que aparecem antes de a pessoa dar play.');
  linhas.push('Português do Brasil, na fala de quem publica — não em linguagem de anúncio.');
  linhas.push('');
  linhas.push(EMB_REGRAS_SEM_SPOILER);
  linhas.push('');
  linhas.push('== O QUE SE OUVE (transcrição do vídeo) ==');
  linhas.push(String(conteudo || ''));
  const v = String(visual || '').trim();
  if (v) {
    linhas.push('');
    linhas.push('== O QUE SE VÊ (descrição visual do vídeo) ==');
    linhas.push(v);
    linhas.push('');
    linhas.push('As duas seções são o MESMO vídeo, por dois canais. O que está na tela desde o começo já é visto por quem assiste — usar isso no título não entrega nada, e costuma ser o detalhe concreto mais barato de aproveitar.');
  }
  if (o.capa) {
    linhas.push('');
    linhas.push('== A CAPA JÁ ESCOLHIDA ==');
    linhas.push(String(o.capa));
    linhas.push('O título vai aparecer junto dessa capa. Não repita em palavras o que a capa já mostra: os dois juntos têm de dizer mais do que cada um sozinho.');
  }
  linhas.push('');
  linhas.push('== O QUE ENTREGAR ==');
  linhas.push(`- titulo: até ${EMB_MAX_TITULO_CHARS} caracteres. Um detalhe concreto da situação + a resposta retida. Sem "você não vai acreditar", sem emoji, sem CAIXA ALTA gritada.`);
  linhas.push(`- legenda: até ${EMB_MAX_LEGENDA_CHARS} caracteres. Ela AUMENTA a curiosidade do título, não a encerra. Pode dar mais contexto da situação; não pode dar a resposta.`);
  linhas.push('- pergunta_retida: a pergunta que sobra na cabeça de quem leu os dois e cuja resposta só está no vídeo. Escreva do jeito que a pessoa pensaria.');
  linhas.push('- fisgada: em uma frase, qual detalhe do vídeo você usou como isca e por quê.');
  if (Array.isArray(o.problemas) && o.problemas.length) {
    linhas.push('');
    linhas.push('== A TENTATIVA ANTERIOR FOI REPROVADA NA CONFERÊNCIA ==');
    o.problemas.forEach((p) => linhas.push(`- ${p}`));
    linhas.push('Escreva de novo SEM essas palavras. Não resolva ficando vago: troque a resposta entregue por um detalhe concreto do COMEÇO do vídeo.');
  }
  linhas.push('');
  linhas.push('Responda SÓ com JSON: {"titulo": "...", "legenda": "...", "pergunta_retida": "...", "fisgada": "..."}');
  return linhas.join('\n');
}

function _embTexto(v) { return (v == null) ? '' : String(v).trim(); }

function embNormalizarSugestao(obj) {
  const o = obj || {};
  return {
    titulo: _embTexto(o.titulo).replace(/^["'“”]+|["'“”]+$/g, ''),
    legenda: _embTexto(o.legenda),
    pergunta: _embTexto(o.pergunta_retida || o.pergunta),
    fisgada: _embTexto(o.fisgada),
  };
}

/**
 * Uma chamada, uma conferência e — só se a conferência reprovar — uma segunda
 * chamada com o que vazou. No máximo duas.
 *
 * Quando a segunda também vaza, a sugestão VAI para a tela mesmo assim, com o
 * problema declarado. Esconder seria pior: o autor fica sem nada e sem saber
 * por quê, e a decisão sobre o próprio vídeo é dele. O que não se faz é
 * entregar um spoiler dizendo que está tudo certo.
 */
async function runEmbalagemPipeline(opts) {
  const o = opts || {};
  const chamar = o.call || (typeof callLLM === 'function' ? callLLM : null);
  if (!chamar) throw new Error('Sem função de chamada de IA.');
  const conteudo = String(o.conteudo || '').trim();
  if (!conteudo) throw new Error('Não há conteúdo para ler.');
  const visual = String(o.visual || '').trim();
  const etapa = (k, t, d) => { if (typeof o.onEtapa === 'function') o.onEtapa(k, t, d); };
  const lerJSON = (r) => (typeof extractJSON === 'function' ? extractJSON(r && r.content) : null);

  let sugestao = null;
  let auditoria = null;
  let modelo = '';
  let tentativas = 0;

  for (let i = 0; i < 2; i++) {
    etapa(i === 0 ? 'escrevendo' : 'refazendo',
      i === 0 ? 'Escrevendo a embalagem…' : 'O fim vazou — reescrevendo…',
      i === 0 ? 'Título e legenda a partir da transcrição e do que se vê.'
        : (auditoria.problemas[0] || ''));
    const r = await chamar(buildEmbalagemPrompt(conteudo, visual, {
      capa: o.capa,
      problemas: auditoria ? auditoria.problemas : null,
    }));
    tentativas++;
    if (r && r.model) modelo = r.model;
    const nova = embNormalizarSugestao(lerJSON(r));
    if (!nova.titulo && !nova.legenda) throw new Error('A IA não devolveu título nem legenda.');
    sugestao = nova;
    auditoria = embAuditarSpoiler(nova, conteudo, visual);
    if (auditoria.ok) break;
  }

  etapa('pronto', 'Pronto.', auditoria.ok ? 'A conferência passou.' : 'A conferência reprovou — veja o aviso.');
  return { ...sugestao, auditoria, tentativas, model: modelo, conteudo, visual };
}
