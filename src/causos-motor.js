'use strict';
/* ============================================================================
 * CAUSOS — A MESA DE CONTADORES
 *
 * Uma sala de escritores artificial especializada em causo brasileiro: história
 * de pescador, assombração, caso engraçado da vila, lenda de beira de rio. O
 * usuário entrega uma ideia de uma linha; a mesa faz o resto.
 *
 * O QUE ESTE MOTOR NÃO É: um gerador que escreve e depois pergunta a si mesmo
 * se gostou. Autoavaliação de LLM tem limite conhecido — ela aprova o próprio
 * texto com facilidade e produz falso positivo na verificação. Por isso aqui:
 *
 *   • os CRÍTICOS são chamadas separadas e independentes, cada uma com uma
 *     lente própria (narrativa, oralidade, originalidade, e o especialista do
 *     gênero). Nenhum vê a opinião do outro — crítica que lê crítica vira eco.
 *   • o JUIZ É CÓDIGO. Ele não opina: recebe as notas, aplica a regra e manda
 *     reescrever. Juiz de LLM erraria a conta e perdoaria o que não deve.
 *   • parte da conferência é MEDIDA, não julgada: repetição contra o que a mesa
 *     já escreveu antes, continuidade de nomes, curva do exagero, clichê de
 *     causo, uniformidade das frases. Isso não depende de a IA ser honesta.
 *
 * A REGRA ACIMA DE TODAS: nota baixa não se esconde na média. 95+95+95+95+40
 * não é 84 — é uma história com um problema de 40 que precisa ser resolvido.
 *
 * A SEGUNDA REGRA: a ferramenta não tenta parecer folclórica. Tentar é o
 * caminho mais curto para a caricatura. Ela tenta parecer brasileira, humana e
 * oral; o folclórico nasce disso ou não nasce.
 *
 * As funções puras daqui não tocam no DOM e recebem a chamada de IA por
 * parâmetro: dá para exercitar a mesa inteira com IA dublada, offline.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/* §1 — Gêneros e quem a mesa convoca para cada um                            */
/* -------------------------------------------------------------------------- */

/* Não existe cadeia fixa. Uma história de pescador não precisa do mesmo
 * caminho de uma assombração: o especialista em exagero não tem o que fazer
 * num causo de medo, e o de mistério atrapalharia uma pescaria. O gênero sai da
 * própria etapa de concepção — o usuário não escolhe nada. */
const CAUSO_GENEROS = [
  {
    id: 'pescador', label: 'História de pescador',
    ctx: 'O prazer está na mentira contada com convicção. Quem ouve sabe que é exagero e quer ouvir mesmo assim. O contador nunca admite que exagerou.',
    especialista: 'exagero',
  },
  {
    id: 'assombracao', label: 'Assombração',
    ctx: 'Assombração de mesa de bar: o susto é do CONTADOR, e é ele quem faz rir. O medo mora no que não se vê — um barulho, uma pegada, uma porta —, mas quem corre gritando pelo pasto de ceroula é gente, e disso ninguém esquece. Sugestão vale mais que explicação; e o ridículo do apavorado vale mais que o fantasma.',
    especialista: 'misterio',
  },
  {
    id: 'engracado', label: 'Caso engraçado',
    ctx: 'A graça vem da pessoa, não da piada. Contradição, teimosia, o absurdo tratado com naturalidade, a reação de quem estava junto.',
    especialista: 'humor',
  },
  {
    id: 'lenda', label: 'Lenda / explicação do lugar',
    ctx: 'Explica por que uma coisa do mundo é como é: o nome de um lugar, um costume, um medo herdado. Precisa soar mais velha que quem conta — e a explicação tem de ser absurda o bastante para dar vontade de rir e repetir. Ninguém conta lenda para ensinar; conta para ver a cara de quem ouve.',
    especialista: 'misterio',
  },
  {
    id: 'vida', label: 'Causo de vida',
    ctx: 'Aconteceu com gente conhecida, e por isso diverte mais. O extraordinário aqui é humano levado ao absurdo: uma teimosia que passou de todo limite, uma vergonha que virou lenda na família, um mal-entendido que ninguém desfez a tempo. A graça está na pessoa insistindo no erro com dignidade.',
    especialista: 'humor',
  },
];

function causoGenero(id) {
  return CAUSO_GENEROS.find((g) => g.id === id) || CAUSO_GENEROS[4];
}

/* As dimensões da avaliação. `minimo` é o que sustenta a regra da média: nota
 * abaixo disso reprova a história INTEIRA, por melhor que esteja o resto. */
const CAUSO_DIMENSOES = [
  { id: 'oralidade', pergunta: 'Parece contada por alguém, ou parece escrita?', minimo: 7 },
  { id: 'originalidade', pergunta: 'Parece uma história nova, ou uma combinação previsível?', minimo: 7 },
  { id: 'coerencia', pergunta: 'Tudo faz sentido do começo ao fim?', minimo: 7 },
  { id: 'personagens', pergunta: 'Parecem pessoas, ou fichas de personagem?', minimo: 7 },
  { id: 'causalidade', pergunta: 'Os acontecimentos se puxam, ou apenas se sucedem?', minimo: 7 },
  { id: 'exagero', pergunta: 'O absurdo cresce, ou já chega pronto?', minimo: 6 },
  { id: 'ritmo', pergunta: 'Existe parte arrastada?', minimo: 6 },
  { id: 'humor', pergunta: 'A graça funciona — dá vontade de rir ou de contar de novo?', minimo: 7 },
  { id: 'absurdo', pergunta: 'A mentira cresce até dar vontade de dizer "não acredito"?', minimo: 7 },
  { id: 'misterio', pergunta: 'A curiosidade se sustenta sem explicar tudo?', minimo: 6 },
  { id: 'final', pergunta: 'O encerramento recompensa a espera?', minimo: 7 },
  { id: 'brasilidade', pergunta: 'Há identidade cultural sem caricatura?', minimo: 7 },
  { id: 'autenticidade', pergunta: 'Parece um causo de verdade, contado por alguém que viveu ali?', minimo: 8 },
];

function causoDimensao(id) {
  return CAUSO_DIMENSOES.find((d) => d.id === id) || null;
}

/* Quais críticos a mesa convoca.
 *
 * HUMOR É FIXO. Ele era convocado só em dois dos cinco gêneros — em assombração
 * e em lenda ninguém olhava a graça, e as histórias saíam sóbrias sem que nada
 * no processo reclamasse. Como a ferramenta existe para divertir, alguém tem de
 * olhar a graça em TODA história.
 *
 * O especialista do gênero se soma; quando ele já é o humor, não entra duas
 * vezes. Chamadas em paralelo custam o tempo de uma. */
const CAUSO_CRITICOS_FIXOS = ['narrativa', 'oralidade', 'originalidade', 'humor'];

function causoCriticosDe(genero) {
  const g = causoGenero(genero);
  return [...new Set(CAUSO_CRITICOS_FIXOS.concat([g.especialista]))];
}

/* -------------------------------------------------------------------------- */
/* §2 — Conferência medida (roda no código, sem IA)                            */
/* -------------------------------------------------------------------------- */

function _cNorm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function _cFrases(texto) {
  return String(texto || '').split(/[.!?…]+|\n+/)
    .map((f) => f.trim()).filter((f) => f.length > 1);
}

/* Aberturas e fechos que todo gerador de causo produz sozinho. Não são erro de
 * português: são a prova de que ninguém pensou naquela frase. */
const CAUSO_CLICHES = [
  'era uma noite escura', 'numa noite escura', 'era uma vez',
  'ninguem acreditou', 'ninguem nunca acreditou', 'ate hoje ninguem sabe',
  'ate hoje se conta', 'conta-se que', 'dizem que naquela noite',
  'e nunca mais foi visto', 'nunca mais foi vista', 'moral da historia',
  'foi assim que tudo comecou', 'o resto e historia', 'jamais esquecerei',
  'uma noite que mudou tudo', 'o que aconteceu depois ninguem explica',
  'reviravolta do destino', 'so quem viu pode contar',
];

function causoCliches(texto) {
  const t = _cNorm(texto);
  return CAUSO_CLICHES.filter((c) => t.indexOf(c) >= 0);
}

/* Palavras de escrivaninha. Ninguém sentado numa calçada diz "outrossim". */
const CAUSO_PALAVRAS_DE_ESCRITA = [
  'outrossim', 'ademais', 'destarte', 'por conseguinte', 'nao obstante',
  'de subito', 'subitamente', 'vislumbrar', 'vislumbrou', 'contemplar',
  'contemplou', 'perscrutar', 'imiscuir', 'doravante', 'conquanto',
  'malgrado', 'sobremaneira', 'amiude', 'porquanto', 'outrora',
  'inebriante', 'melancolia profunda', 'atmosfera etérea',
];

/* ORALIDADE MEDIDA, não julgada.
 *
 * Quem conta varia a frase sem perceber: solta uma de três palavras e emenda
 * uma de trinta. Quem ESCREVE bem tende ao contrário — frases parecidas, todas
 * de tamanho médio, todas bem terminadas. Essa uniformidade é o traço mais
 * fácil de medir e um dos mais denunciadores. */
function causoOralidade(texto) {
  const frases = _cFrases(texto);
  const problemas = [];
  if (frases.length < 4) return { problemas, variacao: 0, frases: frases.length };

  const tamanhos = frases.map((f) => f.split(/\s+/).length);
  const media = tamanhos.reduce((a, b) => a + b, 0) / tamanhos.length;
  const desvio = Math.sqrt(tamanhos.reduce((a, b) => a + (b - media) * (b - media), 0) / tamanhos.length);
  const variacao = media ? desvio / media : 0;

  if (variacao < 0.45) {
    problemas.push(`as frases têm todas o mesmo fôlego (variação de ${variacao.toFixed(2)}; fala de verdade passa de 0,45). Quem conta solta uma frase de três palavras e emenda uma de trinta — aqui está tudo do mesmo tamanho, que é como se escreve, não como se fala.`);
  }
  if (!/[,;]\s*(e|mas|aí|então|daí|só que)\b/i.test(texto) && frases.length > 6) {
    problemas.push('nenhuma frase emendada ("e aí", "só que", "daí") — quem fala emenda; quem escreve pontua.');
  }
  const t = _cNorm(texto);
  const escrivaninha = CAUSO_PALAVRAS_DE_ESCRITA.filter((p) => t.indexOf(p) >= 0);
  if (escrivaninha.length) {
    problemas.push(`palavra de escrivaninha: "${escrivaninha.join('", "')}". Ninguém diz isso numa roda de conversa.`);
  }
  return { problemas, variacao, frases: frases.length };
}

/* CONTINUIDADE. O que a mesa combinou no dossiê tem de estar na história — e
 * quem não foi combinado não entra com nome próprio. */
/* Um nome ou lugar "aparece" quando qualquer palavra significativa dele aparece
 * como PALAVRA no texto.
 *
 * Duas armadilhas, as duas encontradas escrevendo o teste com um causo de
 * verdade: comparar só a primeira palavra reprova "beira do rio" num texto que
 * diz "voltou do rio"; e comparar por substring solta faz "Zé" casar dentro de
 * "fazer". Palavra inteira, de três letras para cima, qualquer uma delas. */
function _cMencionado(termo, texto) {
  const palavras = _cNorm(termo).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  if (!palavras.length) return true;   // nada a conferir
  return palavras.some((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(_cNorm(texto)));
}

function causoContinuidade(texto, dossie) {
  const d = dossie || {};
  const problemas = [];

  const nomes = ((d.personagens || []).map((p) => p && p.nome).filter(Boolean));
  const ausentes = nomes.filter((n) => !_cMencionado(n, texto));
  if (ausentes.length && ausentes.length === nomes.length && nomes.length) {
    problemas.push(`nenhum dos personagens combinados aparece na história (${nomes.join(', ')}).`);
  } else if (ausentes.length) {
    problemas.push(`combinado no dossiê mas ausente do texto: ${ausentes.join(', ')}.`);
  }

  const lugar = (d.mundo && d.mundo.lugar) || '';
  if (lugar && !_cMencionado(lugar, texto)) {
    problemas.push(`o lugar combinado ("${lugar}") não aparece na história.`);
  }
  return { problemas, ausentes };
}

/* ORIGINALIDADE CONTRA A PRÓPRIA MEMÓRIA.
 *
 * Uma ressalva aprendida na marra, noutra ferramenta desta plataforma: proibir
 * VOCABULÁRIO faz a IA trocar a palavra certa por uma errada e o resultado
 * piora. Por isso aqui não se proíbe palavra nenhuma. Compara-se FORMA — a
 * fórmula da abertura, o tipo de fecho, o nome do personagem, o desenho da
 * história — que são coisas de que existe suprimento infinito. */
function causoAssinatura(texto) {
  const frases = _cFrases(texto);
  const primeira = _cNorm(frases[0] || '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 5).join(' ');
  const ultima = _cNorm(frases[frases.length - 1] || '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(-5).join(' ');
  return { abertura: primeira, fecho: ultima };
}

function causoOriginalidade(texto, memoria, dossie) {
  const m = memoria || {};
  const problemas = [];
  const assin = causoAssinatura(texto);

  if (assin.abertura && (m.aberturas || []).indexOf(assin.abertura) >= 0) {
    problemas.push(`esta história começa com a mesma fórmula de uma anterior ("${assin.abertura}…"). Comece de outro jeito.`);
  }
  if (assin.fecho && (m.fechos || []).indexOf(assin.fecho) >= 0) {
    problemas.push(`o fecho repete o de uma história anterior ("…${assin.fecho}"). Termine de outro jeito.`);
  }
  const nomes = ((dossie && dossie.personagens) || []).map((p) => _cNorm(p && p.nome)).filter(Boolean);
  const repetidos = nomes.filter((n) => (m.nomes || []).indexOf(n) >= 0);
  if (repetidos.length) {
    problemas.push(`nome já usado em outra história da mesa: ${repetidos.join(', ')}. Gente nova, nome novo.`);
  }
  const estrutura = _cNorm((dossie && dossie.estrutura) || '');
  if (estrutura && (m.estruturas || []).indexOf(estrutura) >= 0) {
    problemas.push(`este desenho de história ("${estrutura}") já foi usado. Encontre outro caminho para contar.`);
  }
  const cliches = causoCliches(texto);
  if (cliches.length) {
    problemas.push(`frase que todo mundo já ouviu: "${cliches.join('", "')}".`);
  }
  return { problemas, assinatura: assin, cliches };
}

/* CURVA DO EXAGERO. O erro clássico da IA é entregar o absurdo inteiro na
 * primeira frase. Mede-se a densidade de marcas de exagero por terço: se o
 * primeiro terço já é o mais carregado, a curva está invertida. */
const CAUSO_MARCAS_DE_EXAGERO = [
  'gigante', 'enorme', 'do tamanho de', 'maior que', 'nunca visto', 'nunca vista',
  'impossivel', 'nao cabia', 'não cabia', 'quase do tamanho', 'mais de cem',
  'mais de mil', 'ninguem nunca', 'em toda a vida', 'jamais', 'monstruoso',
  'assombroso', 'descomunal', 'pesava', 'arrastou', 'quebrou o', 'entortou',
];

function causoCurvaDoExagero(texto) {
  const frases = _cFrases(texto);
  if (frases.length < 6) return { problemas: [], densidades: [] };
  const t = Math.floor(frases.length / 3);
  const tercos = [frases.slice(0, t), frases.slice(t, 2 * t), frases.slice(2 * t)];
  const densidades = tercos.map((bloco) => {
    const txt = _cNorm(bloco.join(' '));
    const n = CAUSO_MARCAS_DE_EXAGERO.reduce((acc, marca) => acc + (txt.indexOf(_cNorm(marca)) >= 0 ? 1 : 0), 0);
    return bloco.length ? n / bloco.length : 0;
  });
  const problemas = [];
  if (densidades[0] > densidades[2] && densidades[0] > 0) {
    problemas.push('o exagero é mais forte no começo do que no fim: o absurdo chega pronto em vez de crescer. Comece no que é quase normal e deixe piorar.');
  }
  return { problemas, densidades };
}

/* O IMPOSSÍVEL COMBINADO CHEGOU AO TEXTO?
 *
 * A mesa decide, no dossiê, qual é a coisa impossível daquela história. Se
 * nenhuma palavra dela aparece no texto, a história ficou sóbria pelo caminho —
 * que é exatamente o defeito relatado: bem escrita, séria, sem a mentira.
 *
 * Usa o mesmo casamento por palavra inteira de `causoContinuidade`, que existe
 * porque comparar por substring solta faz "Zé" casar dentro de "fazer". */
function causoAbsurdoPresente(texto, dossie) {
  const absurdo = (dossie && dossie.absurdo) || '';
  if (!absurdo) return { problemas: [], conferido: false };
  if (_cMencionado(absurdo, texto)) return { problemas: [], conferido: true };
  return {
    conferido: true,
    problemas: [`a coisa impossível combinada ("${absurdo}") não aparece na história. Sem ela sobra um texto bem escrito e sério — que é o oposto do que este causo tem de ser.`],
  };
}

/**
 * Tudo o que dá para medir sem perguntar nada a ninguém. Vira munição para os
 * críticos (que não devem gastar atenção com o que a conta já resolveu) e para
 * o juiz.
 */
function conferirCausoLocal(texto, dossie, opcoes) {
  const o = opcoes || {};
  const oral = causoOralidade(texto);
  const cont = causoContinuidade(texto, dossie);
  const orig = causoOriginalidade(texto, o.memoria, dossie);
  // A curva vale para TODO gênero: a ferramenta inteira existe para a mentira
  // crescer. Antes só rodava em história de pescador, e nos outros quatro
  // gêneros ninguém media se o absurdo chegava pronto na primeira frase.
  const exag = causoCurvaDoExagero(texto);
  const abs = causoAbsurdoPresente(texto, dossie);

  const achados = []
    .concat(oral.problemas.map((p) => ({ dimensao: 'oralidade', texto: p })))
    .concat(cont.problemas.map((p) => ({ dimensao: 'coerencia', texto: p })))
    .concat(orig.problemas.map((p) => ({ dimensao: 'originalidade', texto: p })))
    .concat(exag.problemas.map((p) => ({ dimensao: 'exagero', texto: p })))
    .concat(abs.problemas.map((p) => ({ dimensao: 'absurdo', texto: p })));

  return { achados, oralidade: oral, continuidade: cont, originalidade: orig, exagero: exag, absurdo: abs, ok: achados.length === 0 };
}

/* -------------------------------------------------------------------------- */
/* §3 — O juiz é código                                                        */
/* -------------------------------------------------------------------------- */

/* Nota que uma medição feita no código impõe. Não é opinião: se a conta achou
 * o problema, a dimensão não pode passar como se estivesse boa. */
const CAUSO_NOTA_DE_ACHADO = 5;

/**
 * Recebe o que os críticos disseram e o que a conta mediu, e decide.
 *
 * A REGRA: nota baixa não se esconde na média. Qualquer dimensão abaixo do
 * mínimo dela reprova a história inteira — 95+95+95+95+40 não é 84.
 */
function julgarCauso(criticas, achadosLocais) {
  const porDimensao = new Map();

  const registrar = (dimensao, nota, problema, correcao, fonte) => {
    const dim = causoDimensao(dimensao);
    if (!dim) return;
    const atual = porDimensao.get(dim.id);
    // Fica sempre a PIOR avaliação da dimensão: dois críticos olhando a mesma
    // coisa, vale o que viu o defeito, não o que não viu.
    if (atual && atual.nota <= nota) return;
    porDimensao.set(dim.id, { dimensao: dim.id, nota, problema, correcao, fonte, minimo: dim.minimo });
  };

  (criticas || []).forEach((c) => {
    ((c && c.notas) || []).forEach((n) => {
      const nota = Math.max(0, Math.min(10, Number(n.nota)));
      if (!Number.isFinite(nota)) return;
      registrar(n.dimensao, nota, n.problema || '', n.correcao || '', (c && c.critico) || 'crítico');
    });
  });

  // A medição entra por cima: crítico que deu nota alta para o que a conta
  // reprovou perde — é exatamente o falso positivo que a autoavaliação produz.
  (achadosLocais || []).forEach((a) => {
    registrar(a.dimensao, CAUSO_NOTA_DE_ACHADO, a.texto, a.texto, 'conferência automática');
  });

  const avaliadas = [...porDimensao.values()];
  const reprovadas = avaliadas.filter((a) => a.nota < a.minimo).sort((x, y) => x.nota - y.nota);
  const soma = avaliadas.reduce((acc, a) => acc + a.nota, 0);
  const media = avaliadas.length ? Math.round((soma / avaliadas.length) * 10) : 0;

  return {
    avaliadas,
    reprovadas,
    // A média existe só para mostrar. Ela NUNCA decide: quem decide é a pior.
    media,
    pior: reprovadas.length ? reprovadas[0].nota * 10 : (avaliadas.length ? Math.min(...avaliadas.map((a) => a.nota)) * 10 : 0),
    aprovado: reprovadas.length === 0 && avaliadas.length > 0,
    // As ordens de reescrita, em ordem de gravidade — o reescritor recebe só isto.
    ordens: reprovadas.map((r) => ({
      dimensao: r.dimensao,
      ordem: r.correcao || r.problema || `melhorar ${r.dimensao}`,
      problema: r.problema,
      nota: r.nota,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* §4 — Prompts: cada mesa tem uma cabeça diferente                            */
/* -------------------------------------------------------------------------- */

/* O que todo agente precisa saber, e a regra que governa a mesa inteira. */
function causoBlocoDoutrina() {
  return [
    '== PARA QUE ESTE CAUSO EXISTE ==',
    'Para DIVERTIR. Quem ouve tem de rir, ou balançar a cabeça e pensar "que mentira mais absurda". Se a história termina e ninguém sorriu nem duvidou, ela falhou — por melhor que esteja escrita.',
    'A coisa IMPOSSÍVEL acontece: o peixe fala, o boi sobe no telhado, o defunto senta na mesa. E ninguém na história acha aquilo estranho. É a naturalidade diante do absurdo que faz graça.',
    'QUEM É SÉRIO AQUI É O CONTADOR, NÃO A HISTÓRIA. Ele jura que aconteceu, com cara de quem não está mentindo, e defende cada detalhe. A seriedade dele é o que faz o absurdo funcionar — e é a única seriedade permitida.',
    'Uma história bem escrita e sóbria é o defeito mais comum aqui. Se você terminar de escrever e o texto parecer digno, respeitoso e comovente, você errou o alvo.',
    '',
    '== A REGRA ACIMA DE TODAS ==',
    'NÃO tente parecer folclórico. Tentar é o caminho mais curto para a caricatura — o "ô sinhô" de mentira, o sotaque escrito errado de propósito, o interior de cartão-postal.',
    'Pareça brasileiro, humano e oral. O pescador tem de parecer pescador; o velho, velho; a vila, uma vila. O folclórico nasce disso ou não nasce.',
    'A tradição oral entra como DNA, não como texto para copiar: o jeito de contar, o gosto pelo exagero, a naturalidade diante do impossível. Nunca reproduza uma lenda conhecida.',
    'Verdadeiro aqui não quer dizer verossímil: quer dizer que a GENTE é de verdade — o jeito de falar, a teimosia, a reação de quem estava junto. Os acontecimentos podem ser impossíveis; as pessoas, não.',
  ].join('\n');
}

function causoBlocoMemoria(memoria) {
  const m = memoria || {};
  const linhas = [];
  if ((m.estruturas || []).length) linhas.push(`Desenhos de história já usados pela mesa: ${m.estruturas.slice(0, 10).join('; ')}.`);
  if ((m.nomes || []).length) linhas.push(`Nomes já usados: ${m.nomes.slice(0, 15).join(', ')}.`);
  if ((m.aberturas || []).length) linhas.push(`Fórmulas de abertura já usadas: ${m.aberturas.slice(0, 8).map((a) => `"${a}…"`).join(', ')}.`);
  if (!linhas.length) return '';
  return [
    '== O QUE ESTA MESA JÁ CONTOU ==',
    linhas.join('\n'),
    'Não repita FORMA: outro desenho, outros nomes, outra abertura. Isto não é proibição de assunto nem de palavra — é para a mesa não virar um contador de uma história só.',
  ].join('\n');
}

/** Etapa 1 — EXPLORADOR DE CONCEITOS. Não escreve: descobre que histórias
 *  diferentes cabem naquela ideia. Quatro caminhos de verdade diferentes, não
 *  quatro versões do mesmo. */
function buildConceitosPrompt(ideia, memoria) {
  return [
    'Você é um explorador de histórias numa roda de contadores brasileiros. Português do Brasil.',
    'Você NÃO escreve a história. Você descobre quantas histórias diferentes cabem numa mesma ideia.',
    '',
    causoBlocoDoutrina(),
    '',
    causoBlocoMemoria(memoria),
    '',
    '== A IDEIA ==',
    String(ideia || '').trim(),
    '',
    '== TAREFA ==',
    'Proponha QUATRO histórias possíveis a partir dessa ideia. Diferentes de verdade: não quatro versões da mesma coisa, mas quatro caminhos que levariam a histórias que ninguém confundiria uma com a outra.',
    'AS QUATRO SÃO DE RIR. Não varie entre engraçada, triste e comovente — varie DE ONDE VEM O RISO e QUAL É A MENTIRA. Uma pode rir da teimosia de alguém; outra, de um mal-entendido que ninguém desfaz; outra, do absurdo tratado com naturalidade; outra, da reação de quem estava junto.',
    'Cada uma precisa ter uma coisa IMPOSSÍVEL acontecendo — e ninguém na história achando aquilo estranho. É por isso que quem ouve termina dizendo "que mentira mais absurda".',
    'Para cada uma, diga também qual é o RISCO dela: o jeito mais provável de essa história sair banal. "Ficar séria demais" é o risco mais comum aqui.',
    '',
    'Gêneros possíveis (escolha o que couber em cada conceito):',
    CAUSO_GENEROS.map((g) => `  ${g.id} — ${g.label}: ${g.ctx}`).join('\n'),
    '',
    'Devolva SOMENTE JSON, sem cercas:',
    '{',
    '  "conceitos": [',
    '    {',
    '      "titulo": "como se chamaria essa história em quatro palavras",',
    '      "genero": "um dos ids acima",',
    '      "premissa": "o que acontece, em duas frases",',
    '      "quem": "de quem é a história",',
    '      "quer": "o que essa pessoa quer",',
    '      "virada": "o que muda no meio do caminho",',
    '      "absurdo": "a coisa IMPOSSÍVEL que acontece nesta história",',
    '      "graca": "de onde vem o riso: a pessoa, a contradição, o tempo da frase, a reação de quem estava junto",',
    '      "estrutura": "o desenho de como contar, nomeado por você",',
    '      "porqueFunciona": "por que essa é boa de ouvir",',
    '      "risco": "o jeito mais provável de sair banal"',
    '    }',
    '  ]',
    '}',
  ].filter(Boolean).join('\n');
}

/** Etapa 2 — A MESA: personagens, mundo, voz e plano, tudo de uma vez para o
 *  conceito escolhido. São funções cognitivas diferentes, mas se alimentam
 *  umas das outras: o mundo nasce de quem vive nele, a voz nasce do mundo. */
function buildDossiePrompt(conceito, ideia, memoria) {
  const c = conceito || {};
  const g = causoGenero(c.genero);
  return [
    'Você é a mesa que prepara um causo antes de alguém escrevê-lo: quem conhece a gente do lugar, quem conhece o lugar, e quem conhece o jeito de contar.',
    'Você NÃO escreve a história. Você prepara o dossiê de quem vai contar.',
    '',
    causoBlocoDoutrina(),
    '',
    `== GÊNERO: ${g.label} ==`,
    g.ctx,
    '',
    '== IDEIA ORIGINAL ==',
    String(ideia || '').trim(),
    '',
    '== O CONCEITO ESCOLHIDO ==',
    `${c.titulo || ''} — ${c.premissa || ''}`,
    c.quem ? `De quem é: ${c.quem}` : '',
    c.quer ? `O que quer: ${c.quer}` : '',
    c.virada ? `A virada: ${c.virada}` : '',
    c.absurdo ? `A COISA IMPOSSÍVEL: ${c.absurdo}` : '',
    c.graca ? `De onde vem o riso: ${c.graca}` : '',
    c.estrutura ? `Desenho: ${c.estrutura}` : '',
    c.risco ? `RISCO A EVITAR: ${c.risco}` : '',
    '',
    causoBlocoMemoria(memoria),
    '',
    '== PERSONAGENS ==',
    'Gente que parece ter vivido naquele lugar, não ficha de cadastro. "João, 52 anos, pescador" não serve. "Zé Macambira tinha fama danada de mentiroso, mas ninguém nunca pegou ele numa mentira" serve.',
    'Cada um precisa QUERER alguma coisa — é o que dá vida ao causo.',
    '',
    '== O MUNDO ==',
    'Um lugar pequeno e concreto, com nome próprio nas coisas: a venda e o dono dela, o rio, a ponte, a árvore onde os homens sentavam, o cachorro, a canoa, o barulho do motor, a estrada, o costume daquele povo, onde todo mundo se encontrava.',
    'O objetivo é a história parecer lembrança de um lugar que existiu — não "uma vila no interior".',
    '',
    '== A VOZ ==',
    'Quem está contando? Que idade tem, que relação tem com o que aconteceu, por que está contando isso agora, e o que essa pessoa acha do protagonista. A voz decide o texto inteiro.',
    '',
    'Devolva SOMENTE JSON, sem cercas:',
    '{',
    '  "titulo": "curto",',
    '  "genero": "' + g.id + '",',
    '  "estrutura": "o desenho de como contar",',
    '  "personagens": [{ "nome": "", "fama": "como é conhecido no lugar", "quer": "", "jeito": "como fala e o que evita dizer", "mania": "" }],',
    '  "mundo": { "lugar": "nome do lugar", "pontos": ["a venda do fulano", "a ponte velha"], "costume": "o que aquele povo faz que ninguém mais faz", "detalhes": ["o cachorro", "o barulho do motor"] },',
    '  "voz": { "quem": "quem conta", "relacao": "o que tem a ver com a história", "porqueConta": "" },',
    '  "beats": ["o que acontece, passo a passo, com as coisas concretas deste mundo"],',
    '  "curvaExagero": ["se for história de exagero: o que é quase normal, depois estranho, depois improvável, depois inacreditável"],',
    '  "obrigatorio": ["coisas que a história PRECISA ter"],',
    '  "proibido": ["coisas que estragariam esta história"],',
    '  "absurdo": "a coisa impossível que acontece — repita e concretize a do conceito",',
    '  "graca": "de onde vem o riso nesta versão",',
    '  "final": "o que acontece no fim, e o que fica sem explicação"',
    '}',
  ].filter(Boolean).join('\n');
}

/** Etapa 3 — O CONTADOR. Recebe o dossiê inteiro e conta. */
function buildContarPrompt(dossie, opcoes) {
  const d = dossie || {};
  const o = opcoes || {};
  const g = causoGenero(d.genero);
  const linhas = [];

  linhas.push('Você é a pessoa que conta o causo. Não é escritor: é quem está contando, agora, para gente que está ouvindo.');
  linhas.push('');
  linhas.push(causoBlocoDoutrina());
  linhas.push('');
  linhas.push(`== GÊNERO: ${g.label} ==`);
  linhas.push(g.ctx);

  if (d.voz) {
    linhas.push('');
    linhas.push('== QUEM ESTÁ CONTANDO ==');
    if (d.voz.quem) linhas.push(d.voz.quem);
    if (d.voz.relacao) linhas.push(`Relação com o que aconteceu: ${d.voz.relacao}`);
    if (d.voz.porqueConta) linhas.push(`Por que conta isso: ${d.voz.porqueConta}`);
  }

  const pers = (d.personagens || []).filter((p) => p && p.nome);
  if (pers.length) {
    linhas.push('');
    linhas.push('== A GENTE DA HISTÓRIA ==');
    pers.forEach((p) => {
      const partes = [`- ${p.nome}`];
      if (p.fama) partes.push(p.fama);
      if (p.quer) partes.push(`quer: ${p.quer}`);
      if (p.jeito) partes.push(`fala assim: ${p.jeito}`);
      if (p.mania) partes.push(`mania: ${p.mania}`);
      linhas.push(partes.join(' — '));
    });
    linhas.push('Ninguém novo entra com nome próprio. Quem precisar aparecer de passagem fica sem nome ("o filho do Zico", "a mulher da venda").');
  }

  const m = d.mundo || {};
  if (m.lugar || (m.pontos || []).length) {
    linhas.push('');
    linhas.push('== O LUGAR ==');
    if (m.lugar) linhas.push(m.lugar);
    (m.pontos || []).forEach((x) => linhas.push('- ' + x));
    if (m.costume) linhas.push(`Costume do povo: ${m.costume}`);
    (m.detalhes || []).forEach((x) => linhas.push('- ' + x));
    linhas.push('Use estas coisas pelo nome. É o que faz a história parecer lembrança de um lugar que existiu.');
  }

  if ((d.beats || []).length) {
    linhas.push('');
    linhas.push('== O QUE ACONTECE ==');
    d.beats.forEach((b, i) => linhas.push(`${i + 1}. ${b}`));
  }
  if ((d.curvaExagero || []).length) {
    linhas.push('');
    linhas.push('== A CURVA DO EXAGERO ==');
    d.curvaExagero.forEach((x, i) => linhas.push(`${i + 1}. ${x}`));
    linhas.push('Respeite a ordem. O erro clássico é entregar o absurdo inteiro na primeira frase — quando isso acontece, o resto da história não tem para onde subir.');
  }
  if (d.absurdo) {
    linhas.push('');
    linhas.push('== A COISA IMPOSSÍVEL ==');
    linhas.push(d.absurdo);
    linhas.push('Isto ACONTECE na história, e ninguém acha estranho. Não explique, não justifique, não sugira que foi sonho ou engano. Conte como quem conta que choveu.');
  }
  if (d.graca) {
    linhas.push('');
    linhas.push('== DE ONDE VEM O RISO ==');
    linhas.push(d.graca);
    linhas.push('Não anuncie a graça e não escreva que alguém riu: deixe a cena fazer o trabalho.');
  }
  if (d.final) { linhas.push(''); linhas.push(`== O FIM ==\n${d.final}`); }
  if ((d.obrigatorio || []).length) {
    linhas.push('');
    linhas.push('== PRECISA TER ==');
    d.obrigatorio.forEach((x) => linhas.push('- ' + x));
  }
  if ((d.proibido || []).length) {
    linhas.push('');
    linhas.push('== NÃO PODE TER ==');
    d.proibido.forEach((x) => linhas.push('- ' + x));
  }

  linhas.push('');
  linhas.push('== COMO SE CONTA ==');
  linhas.push('- Varie o fôlego das frases. Solte uma de três palavras e emende uma de trinta. Texto com todas as frases do mesmo tamanho soa escrito, não falado.');
  linhas.push('- Emende como quem fala: "e aí", "só que", "daí", "aí foi que". Sem exagerar — é tempero, não sotaque de mentira.');
  linhas.push('- Nada de palavra de escrivaninha (outrossim, subitamente, vislumbrar, contemplar). Ninguém diz isso numa calçada.');
  linhas.push('- Não explique o que já mostrou, e não explique a graça nem o medo. Quem explica, mata.');
  linhas.push('- Comece onde a coisa já está acontecendo. Nada de "era uma noite escura" nem de anunciar que vai contar uma história.');
  linhas.push('- Deixe alguma coisa sem explicação. Causo que fecha tudo vira relatório.');
  if (o.tamanho) linhas.push(`- Extensão: ${o.tamanho}.`);
  linhas.push('');
  linhas.push('Devolva SOMENTE a história contada. Sem título, sem introdução, sem comentário, sem moral no fim.');
  return linhas.join('\n');
}

/* Os quatro críticos. Cada um tem uma CABEÇA diferente — não é o mesmo prompt
 * com outro nome. Cada um recebe só a sua lente e não vê a opinião dos outros:
 * crítica que lê crítica vira eco. */
const CAUSO_CRITICOS = {
  narrativa: {
    label: 'Crítico de narrativa',
    persona: 'Você é editor de histórias há trinta anos. Você não se importa com beleza de frase: se importa se a história SE SUSTENTA. Você é o tipo de leitor que pergunta "por que ele foi lá?" e não aceita "porque sim".',
    dimensoes: ['coerencia', 'causalidade', 'personagens', 'final'],
    olhar: [
      'Cada acontecimento foi PROVOCADO pelo anterior, ou apenas veio depois dele?',
      'Por que o personagem foi até lá? Por que tomou aquela decisão? A história responde?',
      'A história depende de coincidência para funcionar? Quantas?',
      'Os personagens querem coisas, ou só reagem?',
      'O final decorre do que aconteceu antes, ou foi colado?',
      'O final entrega alguma coisa, ou só termina?',
    ],
  },
  oralidade: {
    label: 'Crítico de oralidade',
    persona: 'Você passou a vida ouvindo gente contar história em calçada, mesa de bar e beira de rio. Você reconhece na hora quando um texto foi ESCRITO tentando parecer falado. Você não julga literatura: julga se aquilo sai da boca de alguém.',
    dimensoes: ['oralidade', 'ritmo', 'brasilidade', 'autenticidade'],
    olhar: [
      'Isso parece que alguém está contando, ou que alguém escreveu?',
      'Tem frase perfeita demais? Frase que ninguém falaria em voz alta?',
      'O narrador é culto demais para quem ele diz ser?',
      'Tem explicação que ninguém daria no meio de um causo?',
      'Tem parte arrastada — trecho em que quem ouve olharia para o lado?',
      'A brasilidade é de verdade ou é fantasia: sotaque escrito errado, "ô sinhô", interior de cartão-postal?',
      'Se você ouvisse isso sentado numa varanda, acreditaria que alguém realmente poderia ter contado?',
    ],
  },
  originalidade: {
    label: 'Crítico de originalidade',
    persona: 'Você conhece causo brasileiro o bastante para saber quando está ouvindo um que já ouviu. Você não é contra o familiar — causo é feito de familiaridade —, mas é implacável com o previsível.',
    dimensoes: ['originalidade'],
    olhar: [
      'Isso é uma história nova, ou uma combinação previsível de histórias que todo mundo conhece?',
      'Dá para adivinhar o final na metade? E no primeiro terço?',
      'Os personagens são gente ou são tipos ("o velho sábio", "o bêbado da vila")?',
      'A história reproduz uma lenda conhecida em vez de criar a própria?',
      'Onde está a novidade? Se você não achar nenhuma, diga isso com todas as letras.',
    ],
  },
  exagero: {
    label: 'Especialista em exagero',
    persona: 'Você entende de mentira contada com convicção. Sabe que o prazer da história de pescador não está no peixe: está em ver o homem sustentando o tamanho do peixe com cara séria.',
    dimensoes: ['exagero', 'absurdo'],
    olhar: [
      'O exagero CRESCE, ou já chega pronto na primeira frase?',
      'A escada está inteira: quase normal → estranho → improvável → absurdo → inacreditável?',
      'Quem conta sustenta a mentira com naturalidade, ou entrega o jogo?',
      'Alguém na história duvida? A dúvida do outro é o que dá graça ao exagero.',
      'O absurdo é tratado como a coisa mais normal do mundo?',
    ],
  },
  misterio: {
    label: 'Especialista em mistério',
    persona: 'Você sabe que o medo mora no que não se vê. Você desconfia de toda explicação: cada uma que aparece rouba um pouco do susto.',
    dimensoes: ['misterio', 'final'],
    olhar: [
      'A história sugere ou explica? Quanto ela explica que não precisava?',
      'Sobrou alguma coisa sem resposta — e essa coisa incomoda do jeito certo?',
      'O susto vem do que se vê ou do que não se vê?',
      'Tem testemunho que não bate com o outro? Barulho, pegada, porta, ausência?',
      'O fim fecha demais? Causo de assombração que explica tudo vira boletim de ocorrência.',
    ],
  },
  humor: {
    label: 'Especialista em humor',
    persona: 'Você sabe que graça não se anuncia. Você procura de onde vem o riso: da pessoa, da contradição, do tempo da frase, da reação de quem estava junto — nunca da piada colada.',
    dimensoes: ['humor', 'absurdo', 'ritmo'],
    olhar: [
      'Onde está a graça? Ela vem da pessoa ou de uma piada encaixada?',
      'O tempo está certo — a frase que faz rir chega no lugar certo?',
      'Tem graça demais? Humor constante mata o humor; alguma parte deveria ser séria.',
      'A reação dos outros personagens ajuda a graça ou está faltando?',
      'O absurdo é tratado com naturalidade (que é o que faz rir) ou com espanto (que estraga)?',
    ],
  },
};

function buildCriticoPrompt(criticoId, texto, dossie, achadosLocais) {
  const c = CAUSO_CRITICOS[criticoId];
  if (!c) throw new Error('Crítico desconhecido: ' + criticoId);
  const dims = c.dimensoes.map((id) => {
    const d = causoDimensao(id);
    return d ? `  ${d.id} — ${d.pergunta}` : '';
  }).filter(Boolean);

  const linhas = [];
  linhas.push(c.persona);
  linhas.push('');
  linhas.push('Você NÃO reescreve nada. Você aponta — com o trecho na mão.');
  linhas.push('Elogio genérico não serve. Se estiver bom, diga por quê em uma frase e dê nota alta; se estiver ruim, cite o pedaço exato.');
  linhas.push('');
  linhas.push('== A HISTÓRIA ==');
  linhas.push(String(texto || ''));
  linhas.push('');
  if (dossie && dossie.voz && dossie.voz.quem) {
    linhas.push(`(Quem deveria estar contando: ${dossie.voz.quem})`);
    linhas.push('');
  }
  if ((achadosLocais || []).length) {
    linhas.push('== JÁ MEDIDO NO CÓDIGO (não é opinião, e não precisa ser repetido) ==');
    achadosLocais.forEach((a) => linhas.push('- ' + a.texto));
    linhas.push('Procure o que a medição não alcança.');
    linhas.push('');
  }
  linhas.push('== O QUE VOCÊ OLHA ==');
  c.olhar.forEach((o) => linhas.push('- ' + o));
  linhas.push('');
  linhas.push('== SUAS DIMENSÕES (dê nota de 0 a 10 em cada uma) ==');
  dims.forEach((d) => linhas.push(d));
  linhas.push('');
  linhas.push('Nota é honesta: 10 é raro, 7 é aceitável, abaixo de 5 é falha grave. Não infle.');
  linhas.push('');
  linhas.push('Devolva SOMENTE JSON, sem cercas:');
  linhas.push('{');
  linhas.push('  "notas": [{ "dimensao": "' + c.dimensoes[0] + '", "nota": 7, "problema": "o que está errado e onde", "correcao": "o que fazer" }],');
  linhas.push('  "resumo": "em uma frase, o que mais atrapalha"');
  linhas.push('}');
  return linhas.join('\n');
}

/** Etapa final — O REESCRITOR. Recebe só as ordens do juiz. */
function buildReescreverCausoPrompt(texto, ordens, dossie) {
  const linhas = [];
  linhas.push('Você é quem corrige o causo. Recebe a história e uma lista fechada de problemas.');
  linhas.push('Isto NÃO é uma história nova: é esta mesma, sem esses defeitos. O que não está na lista, você não toca.');
  linhas.push('');
  linhas.push('== A HISTÓRIA ==');
  linhas.push(String(texto || ''));
  linhas.push('');
  linhas.push('== O QUE PRECISA SER CORRIGIDO (em ordem de gravidade) ==');
  (ordens || []).forEach((o, i) => {
    linhas.push(`${i + 1}. [${o.dimensao}] ${o.problema || ''}`);
    if (o.ordem && o.ordem !== o.problema) linhas.push(`   → ${o.ordem}`);
  });
  linhas.push('');
  const d = dossie || {};
  if ((d.personagens || []).length) {
    linhas.push('== GENTE QUE PODE APARECER (ninguém além destes com nome próprio) ==');
    d.personagens.forEach((p) => linhas.push(`- ${p.nome}${p.fama ? ' — ' + p.fama : ''}`));
    linhas.push('');
  }
  linhas.push('== COMO CORRIGIR ==');
  linhas.push('- Preserve o que funcionou. Cada revisão que reescreve tudo destrói alguma coisa que estava boa.');
  linhas.push('- Não invente acontecimento novo para resolver um problema: resolva com o que a história já tem.');
  linhas.push('- Não acrescente personagem, não mude o final combinado, não explique o que estava bom sem explicação.');
  linhas.push('- Continue soando falado: frases de fôlego variado, sem palavra de escrivaninha.');
  linhas.push('');
  linhas.push('Devolva SOMENTE a história corrigida. Sem comentário, sem lista do que mudou.');
  return linhas.join('\n');
}

/* -------------------------------------------------------------------------- */
/* §5 — Normalizadores                                                         */
/* -------------------------------------------------------------------------- */

function _cTexto(v) { return (v == null) ? '' : String(v).trim(); }
function _cLista(v) {
  if (Array.isArray(v)) return v.map(_cTexto).filter(Boolean);
  const s = _cTexto(v);
  return s ? [s] : [];
}

function normalizarConceitos(obj) {
  const lista = (obj && Array.isArray(obj.conceitos)) ? obj.conceitos : [];
  return lista.filter((c) => c && (_cTexto(c.premissa) || _cTexto(c.titulo))).slice(0, 6).map((c) => ({
    titulo: _cTexto(c.titulo),
    genero: causoGenero(_cTexto(c.genero)).id,
    premissa: _cTexto(c.premissa),
    quem: _cTexto(c.quem),
    quer: _cTexto(c.quer),
    virada: _cTexto(c.virada),
    absurdo: _cTexto(c.absurdo),
    graca: _cTexto(c.graca),
    estrutura: _cTexto(c.estrutura),
    porqueFunciona: _cTexto(c.porqueFunciona),
    risco: _cTexto(c.risco),
  }));
}

function normalizarDossie(obj, conceito) {
  const o = obj || {};
  const c = conceito || {};
  const mundo = o.mundo || {};
  const voz = o.voz || {};
  return {
    titulo: _cTexto(o.titulo) || _cTexto(c.titulo),
    genero: causoGenero(_cTexto(o.genero) || _cTexto(c.genero)).id,
    estrutura: _cTexto(o.estrutura) || _cTexto(c.estrutura),
    personagens: (Array.isArray(o.personagens) ? o.personagens : [])
      .filter((p) => p && _cTexto(p.nome)).slice(0, 8)
      .map((p) => ({
        nome: _cTexto(p.nome), fama: _cTexto(p.fama), quer: _cTexto(p.quer),
        jeito: _cTexto(p.jeito), mania: _cTexto(p.mania),
      })),
    mundo: {
      lugar: _cTexto(mundo.lugar), pontos: _cLista(mundo.pontos),
      costume: _cTexto(mundo.costume), detalhes: _cLista(mundo.detalhes),
    },
    voz: { quem: _cTexto(voz.quem), relacao: _cTexto(voz.relacao), porqueConta: _cTexto(voz.porqueConta) },
    beats: _cLista(o.beats),
    // O absurdo e a graça sobrevivem à normalização mesmo quando a IA esquece
    // de repeti-los: o conceito escolhido é a rede.
    absurdo: _cTexto(o.absurdo) || _cTexto(c.absurdo),
    graca: _cTexto(o.graca) || _cTexto(c.graca),
    curvaExagero: _cLista(o.curvaExagero),
    obrigatorio: _cLista(o.obrigatorio),
    proibido: _cLista(o.proibido),
    final: _cTexto(o.final),
    conceito: c,
  };
}

function normalizarCritica(obj, criticoId) {
  const o = obj || {};
  const permitidas = (CAUSO_CRITICOS[criticoId] || {}).dimensoes || [];
  const notas = (Array.isArray(o.notas) ? o.notas : [])
    .filter((n) => n && permitidas.indexOf(_cTexto(n.dimensao)) >= 0 && Number.isFinite(Number(n.nota)))
    .map((n) => ({
      dimensao: _cTexto(n.dimensao),
      nota: Math.max(0, Math.min(10, Number(n.nota))),
      problema: _cTexto(n.problema),
      correcao: _cTexto(n.correcao),
    }));
  return { critico: criticoId, notas, resumo: _cTexto(o.resumo) };
}

/* -------------------------------------------------------------------------- */
/* §6 — Escolha do conceito: a concorrência                                    */
/* -------------------------------------------------------------------------- */

/**
 * Entre os conceitos propostos, escolhe o que a mesa vai desenvolver.
 *
 * A escolha é FEITA NO CÓDIGO, e de propósito: perguntar a uma LLM "qual destes
 * quatro é o melhor?" costuma devolver o primeiro da lista. O critério aqui é
 * verificável — quanto o conceito se afasta do que a mesa já contou e quanto
 * dele é concreto — e o desempate é o que a própria etapa de concepção
 * declarou como risco.
 */
function escolherConceito(conceitos, memoria) {
  const m = memoria || {};
  const lista = (conceitos || []).slice();
  if (!lista.length) return null;

  // A memória chega normalizada de `causoMemoriaDe`, mas normalizar dos dois
  // lados é o que impede a comparação de falhar em silêncio quando alguém
  // monta a memória à mão — e falhar em silêncio aqui significa a mesa contar
  // a mesma história de novo sem ninguém perceber.
  const jaUsados = (lista) => (lista || []).map(_cNorm);
  const estruturasUsadas = jaUsados(m.estruturas);
  const generosUsados = jaUsados(m.generos);

  const pontuar = (c) => {
    let p = 0;
    const est = _cNorm(c.estrutura);
    const gen = _cNorm(c.genero);
    // Novidade de forma: desenho ou gênero repetido perde.
    if (est && estruturasUsadas.indexOf(est) >= 0) p -= 4;
    if (gen && generosUsados.indexOf(gen) >= 0) p -= 1;
    /* A GRAÇA PESA, E A FALTA DELA CUSTA.
     *
     * Sem isto a escolha era cega ao humor: pontuava novidade de forma e
     * concretude, e um conceito emocional bem desenvolvido ganhava de um
     * absurdo enxuto. Era a causa dominante das histórias saírem sóbrias.
     *
     * A ausência da coisa impossível é PENALIDADE, não falta de bônus: um
     * conceito sem ela não é um causo um pouco pior — é outra coisa, e não é o
     * que esta ferramenta faz. Entre dois conceitos que têm o absurdo, aí sim
     * decidem o desenvolvimento e a novidade de forma. */
    if (_cTexto(c.absurdo)) p += 4; else p -= 3;
    if (_cTexto(c.graca)) p += 2;
    // Concretude: premissa com verbo e coisa no mundo vale mais que abstração.
    p += Math.min(3, Math.floor(_cTexto(c.premissa).split(/\s+/).length / 12));
    if (_cTexto(c.virada)) p += 2;
    if (_cTexto(c.quer)) p += 2;
    // Quem declarou o próprio risco pensou na história; quem não declarou, não.
    if (_cTexto(c.risco)) p += 1;
    return p;
  };

  const comNota = lista.map((c) => ({ conceito: c, pontos: pontuar(c) }));
  comNota.sort((a, b) => b.pontos - a.pontos);
  return { escolhido: comNota[0].conceito, ranking: comNota };
}

/* -------------------------------------------------------------------------- */
/* §7 — Memória da mesa                                                        */
/* -------------------------------------------------------------------------- */

/** O que ficou das histórias anteriores — só FORMA, nunca assunto. */
function causoMemoriaDe(historico, limite) {
  const itens = (Array.isArray(historico) ? historico : []).slice(0, limite || 20);
  const memoria = { aberturas: [], fechos: [], nomes: [], estruturas: [], generos: [] };
  itens.forEach((it) => {
    if (!it) return;
    const a = it.assinatura || causoAssinatura(it.conteudo || '');
    if (a.abertura) memoria.aberturas.push(a.abertura);
    if (a.fecho) memoria.fechos.push(a.fecho);
    const d = it.dossie || {};
    (d.personagens || []).forEach((p) => { if (p && p.nome) memoria.nomes.push(_cNorm(p.nome)); });
    if (d.estrutura) memoria.estruturas.push(_cNorm(d.estrutura));
    if (d.genero) memoria.generos.push(_cNorm(d.genero));
  });
  Object.keys(memoria).forEach((k) => { memoria[k] = [...new Set(memoria[k])]; });
  return memoria;
}

/* -------------------------------------------------------------------------- */
/* §8 — A mesa inteira                                                         */
/* -------------------------------------------------------------------------- */

const CAUSO_MAX_REVISOES = 2;

function _cLimpar(texto) {
  let t = String(texto == null ? '' : texto).trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
  return (typeof cleanText === 'function') ? cleanText(t).trim() : t.trim();
}

/**
 * Roda a mesa: conceitos → escolha → dossiê → contar → críticos em paralelo →
 * juiz (código) → reescrita → conferência final.
 *
 * @param {object} opts
 *   ideia     o que o usuário escreveu
 *   memoria   o que a mesa já contou (forma, não assunto)
 *   tamanho   indicação de extensão (opcional)
 *   onEtapa(chave, titulo, desc)
 *   call(prompt)  chamada de IA — injetável; é o que torna a mesa testável
 */
async function runCausoPipeline(opts) {
  const o = opts || {};
  const chamar = o.call || (typeof callLLM === 'function' ? callLLM : null);
  if (!chamar) throw new Error('Sem função de chamada de IA.');
  const ideia = String(o.ideia || '').trim();
  const memoria = o.memoria || {};
  const etapa = (k, t, d) => { if (typeof o.onEtapa === 'function') o.onEtapa(k, t, d); };
  const lerJSON = (r) => (typeof extractJSON === 'function' ? extractJSON(r && r.content) : null);
  const etapas = [];
  let modelo = '';

  // 1) CONCEPÇÃO — quatro histórias possíveis, não uma.
  etapa('conceitos', 'Procurando a história…', 'Quatro caminhos possíveis para essa ideia.');
  const rConc = await chamar(buildConceitosPrompt(ideia, memoria));
  modelo = (rConc && rConc.model) || modelo;
  const conceitos = normalizarConceitos(lerJSON(rConc));
  if (!conceitos.length) throw new Error('Não foi possível encontrar uma história nessa ideia.');
  const escolha = escolherConceito(conceitos, memoria);
  etapas.push('conceitos');

  // 2) DOSSIÊ — personagens, mundo, voz e plano do conceito escolhido.
  etapa('dossie', 'Montando a mesa…', `${escolha.escolhido.titulo || 'Conceito escolhido'}: gente, lugar e voz.`);
  const rDoss = await chamar(buildDossiePrompt(escolha.escolhido, ideia, memoria));
  modelo = (rDoss && rDoss.model) || modelo;
  const dossie = normalizarDossie(lerJSON(rDoss), escolha.escolhido);
  etapas.push('dossie');

  // 3) CONTAR.
  etapa('contar', 'Contando…', dossie.voz.quem ? `Na voz de ${dossie.voz.quem}.` : 'Escrevendo o causo.');
  const rTexto = await chamar(buildContarPrompt(dossie, { tamanho: o.tamanho }));
  modelo = (rTexto && rTexto.model) || modelo;
  let atual = _cLimpar(rTexto && rTexto.content);
  if (!atual) throw new Error('A IA não devolveu a história.');
  etapas.push('contar');

  const criticosIds = causoCriticosDe(dossie.genero);
  let local = conferirCausoLocal(atual, dossie, { memoria, genero: dossie.genero });
  let juizo = null;
  let criticas = [];

  for (let volta = 0; volta <= CAUSO_MAX_REVISOES; volta++) {
    // 4) CRÍTICOS EM PARALELO — independentes, cada um com a sua lente.
    etapa('criticos', 'A mesa está lendo…', `${criticosIds.length} críticos, cada um com a sua lente.`);
    const respostas = await Promise.all(criticosIds.map(async (id) => {
      try {
        const r = await chamar(buildCriticoPrompt(id, atual, dossie, local.achados));
        return normalizarCritica(lerJSON(r), id);
      } catch (_) {
        // Um crítico que falha não derruba a mesa: os outros continuam, e a
        // conferência medida continua valendo.
        return { critico: id, notas: [], resumo: '' };
      }
    }));
    criticas = respostas;
    etapas.push('criticos');

    // 5) O JUIZ — código, não opinião. Nota baixa não se esconde na média.
    juizo = julgarCauso(criticas, local.achados);
    if (juizo.aprovado || volta === CAUSO_MAX_REVISOES) break;

    // 6) REESCRITA — só o que o juiz mandou.
    etapa('reescrita', 'Corrigindo…', juizo.ordens.length === 1
      ? `1 ponto: ${juizo.ordens[0].dimensao}.`
      : `${juizo.ordens.length} pontos, do mais grave para o menos.`);
    let novo = '';
    try {
      const rRe = await chamar(buildReescreverCausoPrompt(atual, juizo.ordens, dossie));
      modelo = (rRe && rRe.model) || modelo;
      novo = _cLimpar(rRe && rRe.content);
    } catch (_) { novo = ''; }
    if (!novo) break;

    // A reescrita precisa MELHORAR o que foi medido. Se sair com mais achados
    // do que entrou, fica a anterior — é a trava contra a revisão que destrói.
    const localNovo = conferirCausoLocal(novo, dossie, { memoria, genero: dossie.genero });
    if (localNovo.achados.length > local.achados.length) {
      etapas.push('reescrita-descartada');
      break;
    }
    atual = novo;
    local = localNovo;
    etapas.push('reescrita');
  }

  etapa('pronto', 'Pronto.', juizo && juizo.aprovado ? 'A mesa aprovou.' : 'Entregando a melhor versão.');
  return {
    conteudo: atual,
    dossie,
    conceitos,
    conceitoEscolhido: escolha.escolhido,
    criticas,
    juizo,
    local,
    assinatura: causoAssinatura(atual),
    etapas,
    model: modelo,
  };
}
