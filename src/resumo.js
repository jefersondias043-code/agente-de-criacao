'use strict';
/* ============================================================================
 * RESUMO — a essência do conteúdo, sem os nomes e sem o resto
 *
 * Pedido: "Esse resumo deve ser realmente um resumo, e não simplesmente uma
 * reprodução menor da história. Ele deve preservar os acontecimentos e as
 * informações essenciais, eliminando detalhes desnecessários." E: "Quando
 * houver nomes próprios de pessoas, eles devem ser substituídos por referências
 * genéricas — 'O senhor João jogou o lixo fora' vira 'Um homem jogou o lixo
 * fora'."
 *
 * AS DUAS COISAS SÃO MEDÍVEIS, e é por isso que este arquivo existe em vez de
 * um prompt solto:
 *
 *   1. RESUMO DE VERDADE tem TAMANHO. Um texto com 90% das palavras do original
 *      não é resumo, é o mesmo texto com menos vírgulas — e é o que a IA
 *      entrega quando ninguém confere. Aqui a taxa é contada.
 *   2. ANONIMIZAÇÃO é BINÁRIA. O nome próprio do original está no resumo ou não
 *      está. Não é questão de opinião, e nenhuma IA precisa ser acreditada.
 *
 * O que NÃO se mede: se o resumo guardou o que importava. Isso é juízo, e
 * cobrar por conta de palavra levaria a reprovar o resumo bom — a lição do
 * r224, que vale aqui inteira. O prompt pede; a conta cuida do que é contável.
 * ========================================================================== */

/* Quanto o resumo pode ter do original, em palavras.
 *
 * O TETO é o que separa resumo de reescrita curta. Meia página resumindo uma
 * página não resumiu nada.
 *
 * O PISO existe porque o defeito contrário também aparece: três linhas para um
 * relato de dez minutos jogam fora os acontecimentos que o usuário pediu para
 * preservar. Um resumo bom de texto longo costuma ficar entre 15% e 35%. */
const RESUMO_MAX_PROPORCAO = 0.45;
const RESUMO_MIN_PROPORCAO = 0.06;

/* Abaixo disso não há o que resumir, e forçar produz um texto pior que o
 * original. A ferramenta diz isso em vez de gastar uma chamada. */
const RESUMO_MIN_PALAVRAS = 80;

function _rPalavras(texto) {
  return String(texto || '').trim().split(/\s+/).filter((p) => p && /[a-zà-ÿ0-9]/i.test(p));
}

function _rNorm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* Palavras que abrem frase e ganham maiúscula sem serem nome de ninguém — mais
 * as genéricas que o próprio resumo deve usar no lugar dos nomes. Sem esta
 * lista, "Uma mulher" e "O homem" seriam acusados de nome próprio. */
const RESUMO_NAO_SAO_NOMES = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'ele', 'ela', 'eles', 'elas',
  'esse', 'essa', 'este', 'esta', 'isso', 'aquele', 'aquela', 'no', 'na', 'nos', 'nas',
  'do', 'da', 'dos', 'das', 'ao', 'aos', 'pelo', 'pela', 'depois', 'antes', 'quando',
  'entao', 'mas', 'porem', 'porque', 'que', 'se', 'como', 'assim', 'ainda', 'ja',
  'homem', 'mulher', 'pessoa', 'senhor', 'senhora', 'rapaz', 'moca', 'menino', 'menina',
  'vizinho', 'vizinha', 'cliente', 'motorista', 'medico', 'medica', 'professor',
  'professora', 'policial', 'garcom', 'vendedor', 'vendedora', 'dono', 'dona',
  'pai', 'mae', 'filho', 'filha', 'irmao', 'irma', 'amigo', 'amiga', 'tio', 'tia',
  'avo', 'avô', 'esposa', 'marido', 'chefe', 'colega', 'jovem', 'idoso', 'idosa',
  'segundo', 'primeiro', 'segunda', 'terceira', 'brasil', 'sao', 'rio',
]);

/**
 * Nomes próprios de PESSOA no texto: maiúscula que não abre a frase.
 *
 * A primeira palavra de cada frase é sempre maiúscula e não diz nada — a mesma
 * regra usada em src/embalagem.js, pelo mesmo motivo. Nome de lugar escapa
 * junto, e tudo bem: o pedido é sobre pessoas, e o excesso aqui erra para o
 * lado seguro (o resumo troca um nome de rua por "uma rua" e ninguém perde).
 */
function resumoNomesProprios(texto) {
  const nomes = new Set();
  String(texto || '').split(/(?<=[.!?…:])\s+|\n+/).forEach((frase) => {
    frase.trim().split(/\s+/).slice(1).forEach((bruta) => {
      const limpa = bruta.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, '');
      if (limpa.length < 3) return;
      if (!/^[A-ZÁÂÃÀÉÊÍÓÔÕÚÜÇ]/.test(limpa)) return;
      // TUDO EM MAIÚSCULA é ênfase ou sigla, não nome ("ELE GRITOU", "CPF").
      if (limpa === limpa.toUpperCase()) return;
      const n = _rNorm(limpa);
      if (RESUMO_NAO_SAO_NOMES.has(n)) return;
      nomes.add(n);
    });
  });
  return [...nomes];
}

/** Os nomes do original que sobreviveram no resumo. */
function resumoNomesVazados(original, resumo) {
  const nomes = resumoNomesProprios(original);
  if (!nomes.length) return [];
  const noResumo = new Set(_rNorm(resumo).split(/[^a-z0-9]+/).filter(Boolean));
  return nomes.filter((n) => noResumo.has(n));
}

/**
 * A conferência. Mede o que é contável e não opina sobre o resto.
 */
function conferirResumo(original, resumo) {
  const problemas = [];
  const nOrig = _rPalavras(original).length;
  const nRes = _rPalavras(resumo).length;
  const proporcao = nOrig ? nRes / nOrig : 0;

  if (!nRes) {
    return { ok: false, problemas: ['o resumo veio vazio'], proporcao: 0, nomes: [], palavras: 0 };
  }
  if (proporcao > RESUMO_MAX_PROPORCAO) {
    problemas.push(`o resumo tem ${Math.round(proporcao * 100)}% do tamanho do original (${nRes} de ${nOrig} palavras). Isso é o texto contado de novo mais curto, não um resumo. Corte os detalhes e fique com os acontecimentos.`);
  }
  if (proporcao < RESUMO_MIN_PROPORCAO) {
    problemas.push(`o resumo tem só ${Math.round(proporcao * 100)}% do original (${nRes} palavras) — nesse tamanho os acontecimentos se perdem. Resumir é encurtar, não apagar.`);
  }

  const vazados = resumoNomesVazados(original, resumo);
  if (vazados.length) {
    problemas.push(`nomes próprios continuam no resumo: ${vazados.join(', ')}. Troque por quem a pessoa É na história — "um homem", "a vizinha", "o motorista".`);
  }

  return { ok: problemas.length === 0, problemas, proporcao, nomes: vazados, palavras: nRes };
}

/** Vale a pena resumir? */
function resumoVale(texto) {
  return _rPalavras(texto).length >= RESUMO_MIN_PALAVRAS;
}

function buildResumoPrompt(texto, opcoes) {
  const o = opcoes || {};
  const linhas = [
    'Você resume conteúdo em português do Brasil.',
    '',
    '== O QUE É RESUMIR ==',
    'Resumir é ficar com os ACONTECIMENTOS e as informações essenciais, jogando fora o resto: a descrição demorada, o comentário lateral, a repetição, o detalhe que não muda nada.',
    'NÃO é contar a mesma coisa com menos palavras. Se o seu texto acompanha o original frase a frase, só que mais curto, você não resumiu — encolheu.',
    'O teste: quem ler só o resumo fica sabendo O QUE ACONTECEU, na ordem, sem os detalhes.',
    '',
    '== NOMES DE PESSOAS SAEM ==',
    'Troque todo nome próprio de pessoa por quem ela É na história: "um homem", "a vizinha", "o motorista", "a filha mais velha", "uma pessoa".',
    'Exemplo: "O senhor João jogou o lixo fora" → "Um homem jogou o lixo fora".',
    'A troca não pode atrapalhar o entendimento: se há duas pessoas na cena, dê a cada uma uma referência que as separe ("o comprador" e "o vendedor"), nunca "uma pessoa" para as duas.',
    'Nome de empresa, cidade, produto ou obra pode ficar quando for o assunto. O que sai é o nome de GENTE.',
    '',
    '== TAMANHO ==',
    `Bem menor que o original — em torno de um quarto dele. Nunca mais de ${Math.round(RESUMO_MAX_PROPORCAO * 100)}%.`,
    '',
    '== O QUE NÃO FAZER ==',
    'Não invente nada que não esteja no original. Não interprete, não conclua, não dê opinião, não acrescente moral da história.',
    'Não escreva introdução ("Neste texto…", "O conteúdo fala sobre…"). Comece pelo primeiro acontecimento.',
    'Não use marcadores nem títulos. Texto corrido.',
    '',
    '== O CONTEÚDO ==',
    String(texto || ''),
  ];
  if (Array.isArray(o.problemas) && o.problemas.length) {
    linhas.push('', '== A TENTATIVA ANTERIOR FOI REPROVADA NA CONFERÊNCIA ==');
    o.problemas.forEach((p) => linhas.push(`- ${p}`));
    linhas.push('Refaça corrigindo isso.');
  }
  linhas.push('', 'Escreva o resumo. Nada além dele.');
  return linhas.join('\n');
}

/* Tira do texto da IA os enfeites que ela insiste em pôr mesmo proibida. */
function resumoLimpar(bruto) {
  let t = String(bruto || '').trim();
  t = t.replace(/^```[a-z]*\s*|\s*```$/g, '').trim();
  t = t.replace(/^(resumo|segue o resumo|aqui está o resumo)\s*[:.\-—]\s*/i, '').trim();
  return t;
}

/**
 * Uma chamada, uma conferência e — só se reprovar — uma segunda com o que
 * falhou. No máximo duas, como no Julgador e no Causos.
 *
 * Quando a segunda também reprova, o resumo VAI para a tela com o problema
 * declarado: a decisão sobre o próprio texto é do usuário, e esconder deixaria
 * ele sem nada e sem saber por quê.
 */
async function runResumoPipeline(opts) {
  const o = opts || {};
  const chamar = o.call || (typeof callLLM === 'function' ? callLLM : null);
  if (!chamar) throw new Error('Sem função de chamada de IA.');
  const texto = String(o.texto || '').trim();
  if (!texto) throw new Error('Não há texto para resumir.');
  if (!resumoVale(texto)) {
    throw new Error(`Este texto tem menos de ${RESUMO_MIN_PALAVRAS} palavras — já é do tamanho de um resumo.`);
  }
  const etapa = (k, t, d) => { if (typeof o.onEtapa === 'function') o.onEtapa(k, t, d); };

  let resumo = '';
  let conferencia = null;
  let tentativas = 0;

  for (let i = 0; i < 2; i++) {
    etapa(i === 0 ? 'resumindo' : 'refazendo',
      i === 0 ? 'Resumindo…' : 'Ajustando o resumo…',
      i === 0 ? 'Acontecimentos essenciais, sem nomes de pessoas.' : (conferencia.problemas[0] || ''));
    const r = await chamar(buildResumoPrompt(texto, {
      problemas: conferencia ? conferencia.problemas : null,
    }));
    tentativas++;
    const novo = resumoLimpar(r && r.content);
    if (!novo) throw new Error('A IA não devolveu o resumo.');
    resumo = novo;
    conferencia = conferirResumo(texto, novo);
    if (conferencia.ok) break;
  }

  etapa('pronto', 'Pronto.', conferencia.ok
    ? `${conferencia.palavras} palavras, ${Math.round(conferencia.proporcao * 100)}% do original.`
    : 'A conferência apontou um problema — veja o aviso.');
  return { resumo, conferencia, tentativas };
}
