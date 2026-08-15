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
  { id: 'absurdo', pergunta: 'O exagero parte de algo real e cresce sem sair do mundo — dá para duvidar sem descartar?', minimo: 7 },
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

/* FANTASIA — o defeito que faz a pessoa sair do vídeo.
 *
 * O exagero de um causo é de TAMANHO: um peixe grande demais, uma vaca que deu
 * duzentos litros. A coisa existe; o tamanho é que é mentira, e é aí que mora a
 * dúvida — "será que é verdade?".
 *
 * Fantasia é outra coisa: fada, magia, bicho que fala, gente que voa. Quem ouve
 * reconhece na primeira frase, ganha CERTEZA de que nunca aconteceu, e para de
 * ouvir. Não é exagero forte demais — é exagero do tipo errado, e destrói
 * exatamente o que sustenta o causo.
 *
 * (Este verificador nasceu de um erro meu: a doutrina anterior mandava o
 * impossível acontecer, e dava "o peixe fala" como exemplo. A ferramenta
 * obedeceu e passou a entregar reino encantado.) */
const CAUSO_FANTASIA = [
  'fada', 'fadas', 'duende', 'duendes', 'saci', 'curupira', 'bruxa', 'bruxo',
  'feiticeira', 'feitico', 'magia', 'magico', 'magica', 'encantamento',
  'reino encantado', 'castelo encantado', 'varinha', 'pocao', 'unicornio',
  'dragao', 'sereia', 'elfo', 'duende', 'genio da lampada', 'tapete voador',
  'superpoder', 'poderes magicos', 'disco voador', 'alienigena', 'extraterrestre',
  'nave espacial', 'viagem no tempo', 'maquina do tempo', 'portal', 'teletransporte',
  'imortal', 'ressuscitou', 'ressucitou', 'vampiro', 'lobisomem', 'zumbi',
];

/* Bicho que fala. O papagaio fica de fora: papagaio fala mesmo. */
const _CAUSO_BICHOS = 'peixe|vaca|boi|touro|cachorro|cadela|cavalo|egua|galinha|galo|porco|gato|burro|jumento|onca|cobra|bode|carneiro|pato|sapo';
const _CAUSO_FALAR = 'falou|disse|respondeu|perguntou|gritou|explicou|contou|avisou|reclamou|xingou';
const CAUSO_BICHO_FALANTE = new RegExp(
  `\\b(?:o|a|um|uma)?\\s*(${_CAUSO_BICHOS})\\b[^.!?\\n]{0,25}?\\b(${_CAUSO_FALAR})\\b`, 'i');

function causoFantasia(texto) {
  const t = _cNorm(texto);
  const achadas = CAUSO_FANTASIA.filter((f) => new RegExp(`(^|[^a-z0-9])${f}([^a-z0-9]|$)`).test(t));
  const problemas = [];
  if (achadas.length) {
    problemas.push(`a história saiu do mundo real: "${[...new Set(achadas)].join('", "')}". Quem ouve reconhece a invenção e para de ouvir. O exagero tem de ser de TAMANHO — uma coisa que existe, num tamanho que ninguém acredita.`);
  }
  const bicho = CAUSO_BICHO_FALANTE.exec(String(texto || ''));
  if (bicho) {
    problemas.push(`bicho falando ("${bicho[0].trim()}") — isso é fantasia, e mata a dúvida na hora. O bicho pode fazer coisa espantosa; falar, não.`);
  }
  return { problemas, achadas };
}

/* O EXAGERO COMBINADO CHEGOU AO TEXTO?
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
    problemas: [`o exagero combinado ("${absurdo}") não aparece na história. Sem ele sobra um texto bem escrito e sério — que é o oposto do que este causo tem de ser.`],
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
  const fant = causoFantasia(texto);
  // Tamanho e repetição: o formato é vídeo curto, e a mesma informação voltando
  // é o que mais alonga sem fazer a história andar.
  const dur = causoDuracao(texto);
  const rep = causoRepeticao(texto);
  const fim = causoTerminaAbrupto(texto);

  const achados = []
    .concat(oral.problemas.map((p) => ({ dimensao: 'oralidade', texto: p })))
    .concat(cont.problemas.map((p) => ({ dimensao: 'coerencia', texto: p })))
    .concat(orig.problemas.map((p) => ({ dimensao: 'originalidade', texto: p })))
    .concat(exag.problemas.map((p) => ({ dimensao: 'exagero', texto: p })))
    .concat(abs.problemas.map((p) => ({ dimensao: 'absurdo', texto: p })))
    .concat(fant.problemas.map((p) => ({ dimensao: 'absurdo', texto: p })))
    .concat(dur.problemas.map((p) => ({ dimensao: 'ritmo', texto: p })))
    .concat(rep.problemas.map((p) => ({ dimensao: 'ritmo', texto: p })))
    .concat(fim.problemas.map((p) => ({ dimensao: 'final', texto: p })));

  return { achados, oralidade: oral, continuidade: cont, originalidade: orig, exagero: exag, absurdo: abs, fantasia: fant, duracao: dur, repeticao: rep, fim, ok: achados.length === 0 };
}

/** As palavras de uma frase que carregam conteúdo (≥4 letras, fora das vazias). */
const CAUSO_VAZIAS = new Set([
  'que', 'para', 'com', 'uma', 'nao', 'por', 'mais', 'como', 'mas', 'dos', 'das',
  'nas', 'nos', 'pelo', 'pela', 'isso', 'esse', 'essa', 'este', 'esta', 'ele',
  'ela', 'eles', 'elas', 'voce', 'seu', 'sua', 'meu', 'minha', 'aqui', 'ali',
  'muito', 'quando', 'onde', 'porque', 'entao', 'tambem', 'ainda', 'depois',
  'antes', 'sobre', 'tem', 'ter', 'foi', 'ser', 'esta', 'estava', 'era', 'sao',
  'vai', 'vou', 'fazer', 'faz', 'dizer', 'disse', 'todo', 'toda', 'todos',
  'todas', 'cada', 'outro', 'outra', 'assim', 'bem', 'ja', 'so', 'lhe', 'dele',
]);
function _cConteudo(texto) {
  return _cNorm(texto).split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !CAUSO_VAZIAS.has(w));
}
/* ---- 3. TAMANHO E REPETIÇÃO ------------------------------------------------
 *
 * Relato: "as histórias estão ficando excessivamente longas e repetitivas… a
 * ferramenta desenvolve uma ideia, mas continua prolongando a história mesmo
 * depois de já ter transmitido aquilo que precisava."
 *
 * O destino é vídeo curto — TikTok, Shorts, Reels —, e o alvo é 1 a 1min30 de
 * narração. Isso é CONTÁVEL: palavra por segundo é a mesma conta que o Julgador
 * já usa para dizer em que segundo o vídeo perde a pessoa.
 *
 * E a repetição também é contável, que é o ponto mais importante do pedido: o
 * defeito não é só comprimento, é a mesma informação voltando com outras
 * palavras. Duas frases que dizem a mesma coisa não fazem a história andar —
 * fazem quem ouve perceber que já entendeu e sair.
 *
 * NADA AQUI CORTA A HISTÓRIA. A conta mede e reprova; quem reescreve é o
 * reescritor, com a ordem na mão. Cortar por conta seria o "corte artificial"
 * que o usuário pediu para evitar. */

/* Fala corrida de causo, em português, roda perto de 2,6 palavras por
 * segundo. A taxa nasceu no Julgador (removido no r244) e ficou aqui, que é
 * onde ela ainda é usada. */
const CAUSO_PALAVRAS_POR_SEGUNDO = 2.6;

/* A janela do formato. O teto é o que reprova; o piso existe porque história
 * de vinte segundos não teve tempo de armar a mentira. */
const CAUSO_SEG_ALVO_MIN = 60;
const CAUSO_SEG_ALVO_MAX = 90;
/* Reprova só acima disto: entre 90 e 105 segundos a história está no espírito
 * do formato, e reprovar por dez segundos empurraria a mesa para o corte seco
 * — o defeito que o pedido manda evitar. */
const CAUSO_SEG_TETO = 105;
const CAUSO_SEG_PISO = 35;

function causoSegundos(palavras) {
  return Math.round(palavras / CAUSO_PALAVRAS_POR_SEGUNDO);
}

function _cSegundosEmTexto(seg) {
  const m = Math.floor(seg / 60);
  const r = seg % 60;
  return m ? `${m}min${r ? ` e ${r}s` : ''}` : `${r}s`;
}

/** Quanto tempo esta história leva para ser contada. */
function causoDuracao(texto) {
  const palavras = String(texto || '').trim().split(/\s+/)
    .filter((p) => p && /[a-zà-ÿ0-9]/i.test(p)).length;
  const segundos = causoSegundos(palavras);
  const problemas = [];
  if (segundos > CAUSO_SEG_TETO) {
    const sobra = segundos - CAUSO_SEG_ALVO_MAX;
    problemas.push(`a história leva ${_cSegundosEmTexto(segundos)} para ser contada — ${_cSegundosEmTexto(sobra)} além do formato (o alvo é 1 a 1min30). Não corte o fim: tire o que não faz a história andar, e chegue no acontecimento mais cedo.`);
  } else if (segundos && segundos < CAUSO_SEG_PISO) {
    problemas.push(`a história leva só ${_cSegundosEmTexto(segundos)} — nesse tempo não dá para armar a mentira e sustentar a dúvida. Falta acontecimento, não palavra.`);
  }
  return { problemas, segundos, palavras };
}

/* Quanto de uma frase precisa estar contido na outra para as duas dizerem a
 * mesma coisa. Mesmo valor do Julgador, achado lá por medição: Jaccard a 0,6
 * não pegava nada, e continência a 0,7 pega o que uma pessoa reconheceria. */
const CAUSO_CONTINENCIA = 0.7;

/**
 * A MESMA INFORMAÇÃO VOLTANDO — o coração do pedido.
 *
 * Compara cada frase com todas as anteriores por CONTINÊNCIA: quanto do
 * conteúdo da menor está dentro da maior. Frase curta demais não entra na
 * conta (quatro palavras de conteúdo), senão "e aí ele foi" casaria com meio
 * texto.
 */
function causoRepeticao(texto) {
  const frases = _cFrases(texto);
  const conteudos = frases.map(_cConteudo);
  const achados = [];
  for (let j = 1; j < frases.length; j++) {
    if (conteudos[j].length < 4) continue;
    for (let i = 0; i < j; i++) {
      if (conteudos[i].length < 4) continue;
      const a = new Set(conteudos[i]);
      const comuns = [...new Set(conteudos[j])].filter((w) => a.has(w));
      const menor = Math.min(a.size, new Set(conteudos[j]).size);
      if (menor && comuns.length / menor >= CAUSO_CONTINENCIA) {
        achados.push({ frase: frases[j], repeteA: frases[i] });
        break;   // uma marcação por frase basta
      }
    }
  }
  const problemas = achados.map((a) =>
    `esta parte repete o que já foi dito: "${a.frase.slice(0, 70)}" diz de novo o que "${a.repeteA.slice(0, 55)}" já tinha dito. Quem ouve já entendeu — corte uma das duas.`);
  return { problemas, achados };
}

/* TERMINA NO MEIO — o sintoma mais grosseiro do corte malfeito.
 *
 * Relato, depois do r235: "parece que a ferramenta está simplesmente cortando
 * a história no meio para conseguir atender ao limite de duração… não deve
 * acontecer de a história simplesmente parar depois do clímax, deixando a
 * sensação de que faltou alguma coisa."
 *
 * Isto NÃO julga se o desfecho é BOM — isso já é trabalho do crítico de
 * narrativa (dimensão `final`, "o encerramento recompensa a espera?"). Isto
 * pega o sintoma mais grosseiro, que é mecânico e não precisa de opinião: o
 * texto para sem terminar a frase, ou termina numa palavra que só serve para
 * introduzir o que viria depois. Um causo pode deixar coisa SEM EXPLICAR — é
 * doutrina —, mas a última frase tem de estar de pé. */
const CAUSO_PALAVRAS_DE_MEIO = new Set([
  'e', 'mas', 'que', 'porque', 'quando', 'se', 'como', 'para', 'pra', 'por',
  'com', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em',
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'ao', 'aos', 'à', 'às',
]);

function causoTerminaAbrupto(texto) {
  const t = String(texto || '').trim();
  if (!t) return { problemas: [] };
  if (!/[.!?…"'”’)]$/.test(t)) {
    return { problemas: ['a história para sem terminar a frase — sem ponto, interrogação ou exclamação no fim. Parece corte, não fim de história.'] };
  }
  const semPontuacao = t.replace(/[.!?…"'”’)]+$/, '').trim();
  const ultima = _cNorm(semPontuacao).split(/[^a-z0-9]+/).filter(Boolean).pop() || '';
  if (CAUSO_PALAVRAS_DE_MEIO.has(ultima)) {
    return { problemas: [`a última frase termina em "${ultima}" — uma palavra que pede continuação, não que fecha. Parece corte, não fim de história.`] };
  }
  return { problemas: [] };
}

/* -------------------------------------------------------------------------- */
/* §3 — O juiz é código                                                        */
/* -------------------------------------------------------------------------- */

/* Nota que uma medição feita no código impõe. Não é opinião: se a conta achou
 * o problema, a dimensão não pode passar como se estivesse boa. */
const CAUSO_NOTA_DE_ACHADO = 5;

/* Quantos problemas distintos uma dimensão leva para o reescritor. Trinta
 * frases repetidas viram trinta linhas de ordem, e ninguém corrige trinta
 * coisas de uma vez: três exemplos dizem o que é o defeito, e o resto vira
 * contagem. */
const CAUSO_MAX_PROBLEMAS_POR_DIMENSAO = 3;

/**
 * Recebe o que os críticos disseram e o que a conta mediu, e decide.
 *
 * A REGRA: nota baixa não se esconde na média. Qualquer dimensão abaixo do
 * mínimo dela reprova a história inteira — 95+95+95+95+40 não é 84.
 */
function julgarCauso(criticas, achadosLocais, modo) {
  const porDimensao = new Map();
  // Sem modo, é o Causos — a chamada de antes continua valendo palavra por
  // palavra, e é isso que o teste de assinatura exige.
  const dimensaoDe = (modo && typeof modo.dimensao === 'function') ? modo.dimensao : causoDimensao;

  const registrar = (dimensao, nota, problema, correcao, fonte) => {
    const dim = dimensaoDe(dimensao);
    if (!dim) return;
    let e = porDimensao.get(dim.id);
    if (!e) {
      e = { dimensao: dim.id, nota, problema, correcao, fonte, minimo: dim.minimo, problemas: [], sobraram: 0 };
      porDimensao.set(dim.id, e);
    } else if (nota < e.nota) {
      // Fica sempre a PIOR avaliação da dimensão: dois críticos olhando a mesma
      // coisa, vale o que viu o defeito, não o que não viu. (Empate mantém o
      // primeiro, como sempre foi.)
      e.nota = nota; e.problema = problema; e.correcao = correcao; e.fonte = fonte;
    }
    /* A NOTA É UMA SÓ POR DIMENSÃO; OS PROBLEMAS, NÃO.
     *
     * Antes, só o problema da pior nota chegava ao reescritor. Com duas contas
     * novas caindo na mesma dimensão (r235: tamanho e repetição em `ritmo`),
     * isso apagava uma das duas: história comprida E repetitiva mandava
     * encurtar e nunca mandava tirar a repetição — que é justamente o ponto
     * principal do pedido. Empatadas em 5, ficava a primeira e ponto.
     *
     * Agora a dimensão junta os problemas distintos. A nota continua sendo uma
     * só, e o painel continua mostrando o pior: o que muda é o que o reescritor
     * recebe para corrigir. */
    /* A CORREÇÃO NA FRENTE DO PROBLEMA, como sempre foi na ordem: o crítico que
     * diz "clichê" e "troque a abertura" está mandando trocar a abertura. Coletar
     * o problema no lugar da correção troca uma ordem acionável por um
     * diagnóstico — o reescritor fica sabendo o que está errado e não o que
     * fazer. */
    const t = String(correcao || problema || '').trim();
    if (!t || e.problemas.indexOf(t) >= 0) return;
    if (e.problemas.length < CAUSO_MAX_PROBLEMAS_POR_DIMENSAO) e.problemas.push(t);
    else e.sobraram++;
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
    ordens: reprovadas.map((r) => {
      const lista = (r.problemas || []).length
        ? r.problemas.slice()
        : [r.correcao || r.problema || `melhorar ${r.dimensao}`];
      const resto = r.sobraram
        ? ` (e mais ${r.sobraram} trecho${r.sobraram > 1 ? 's' : ''} com o mesmo defeito)`
        : '';
      return {
        dimensao: r.dimensao,
        ordem: lista.join(' TAMBÉM: ') + resto,
        problema: r.problema,
        nota: r.nota,
      };
    }),
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
    '',
    'O TESTE DA PULGA ATRÁS DA ORELHA — o mais importante de todos:',
    'Quem ouve tem de terminar SEM SABER se acredita. "Será que é verdade? Será que é mentira?" é o estado exato em que a pessoa precisa ficar.',
    'No instante em que ela tem CERTEZA de que aquilo nunca aconteceu, ela para de ouvir. E ela ganha essa certeza na hora em que a história sai do mundo real.',
    '',
    'POR ISSO: o absurdo é de TAMANHO, não de natureza. A coisa EXISTE; o que não existe é aquele tamanho.',
    'Um peixe que não coube na canoa e entortou o motor. Uma vaca que deu duzentos litros num dia só. Uma chuva que não parou por três meses. Um homem que comeu quarenta ovos numa sentada e foi trabalhar. Tudo isso é gente, bicho e trabalho de todo dia — no tamanho errado.',
    '',
    'PROIBIDO, sem exceção: fada, duende, saci, bruxa, magia, feitiço, reino encantado, poder sobrenatural, bicho que fala, gente que voa, viagem no tempo, disco voador, defunto que levanta e conversa. Nada disso existe no cotidiano de ninguém — quem ouve reconhece na primeira frase, sabe que é invenção e pula fora.',
    'Se a história tiver assombração, ela NUNCA é confirmada: foi um barulho, uma luz, um vulto que podia ser o boi do vizinho. A dúvida é que faz o causo; a confirmação mata.',
    '',
    'QUEM É SÉRIO AQUI É O CONTADOR, NÃO A HISTÓRIA. Ele jura que aconteceu, com cara de quem não está mentindo, e defende cada detalhe com número, nome e lugar. A seriedade dele é o que sustenta a dúvida — e é a única seriedade permitida.',
    'Uma história bem escrita e sóbria é um defeito. Uma história de fantasia é um defeito PIOR: a primeira é chata, a segunda faz a pessoa sair.',
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
    'Cada uma precisa ter um EXAGERO que parte de algo real: uma coisa que existe na vida de qualquer um, levada a um tamanho que ninguém acredita. Peixe grande demais, vaca leiteira demais, chuva longa demais, sujeito teimoso demais.',
    'NÃO invente coisa que não existe no mundo — fada, magia, bicho falando, gente voando. Quem ouve reconhece a invenção na primeira frase e para de ouvir. O alvo é a pessoa terminar sem saber se acredita.',
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
    '      "absurdo": "o exagero: diga a coisa REAL de que ele parte e o tamanho mentiroso a que chega (ex.: um peixe → um peixe que não coube na canoa e entortou o motor)",',
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
    c.absurdo ? `O EXAGERO (parte de algo real): ${c.absurdo}` : '',
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
    /* r236: o pedido foi explícito sobre ONDE isto tem de ser resolvido —
     * "antes de desenvolver a história, a IA deve saber que está criando um
     * conteúdo destinado a um vídeo curto e estruturar os acontecimentos" desde
     * o planejamento. Até aqui o tamanho só era dito na hora de CONTAR — o
     * dossiê podia planejar uma história de fôlego normal, e o contador
     * recebia acontecimentos demais para o tempo que tinha. O resultado real
     * foi exatamente o relatado: histórias cortadas no meio, ou paradas logo
     * depois do clímax, porque a história planejada era grande demais para o
     * formato e alguém — o contador ou, pior, o reescritor — teve de cortá-la
     * depois de pronta. */
    '== O TAMANHO, JÁ NO PLANO ==',
    `Isto vai virar vídeo curto: contado em voz alta, tem de caber entre 1 minuto e 1min30 — perto de ${Math.round(CAUSO_SEG_ALVO_MIN * CAUSO_PALAVRAS_POR_SEGUNDO)} a ${Math.round(CAUSO_SEG_ALVO_MAX * CAUSO_PALAVRAS_POR_SEGUNDO)} palavras. Resolva isso AQUI, no plano — não é a hora de contar que decide o tamanho, é a hora de planejar.`,
    'POUCOS acontecimentos, cada um ganhando o seu lugar: de 3 a 5 beats bastam para uma história de vídeo curto. Isto não é uma saga — é o suficiente para apresentar a situação, uma virada, e o desfecho. Planejar mais do que isso é planejar uma história que vai precisar ser cortada depois de escrita.',
    'O ÚLTIMO beat da lista TEM de ser o desfecho — o que fecha a história de verdade, não um resumo do que já aconteceu. Ele não é opcional, e quem for contar não pode inventá-lo na hora nem deixá-lo de fora.',
    '',
    'Devolva SOMENTE JSON, sem cercas:',
    '{',
    '  "titulo": "curto",',
    '  "genero": "' + g.id + '",',
    '  "estrutura": "o desenho de como contar",',
    '  "personagens": [{ "nome": "", "fama": "como é conhecido no lugar", "quer": "", "jeito": "como fala e o que evita dizer", "mania": "" }],',
    '  "mundo": { "lugar": "nome do lugar", "pontos": ["a venda do fulano", "a ponte velha"], "costume": "o que aquele povo faz que ninguém mais faz", "detalhes": ["o cachorro", "o barulho do motor"] },',
    '  "voz": { "quem": "quem conta", "relacao": "o que tem a ver com a história", "porqueConta": "" },',
    '  "beats": ["o que acontece, passo a passo, com as coisas concretas deste mundo — de 3 a 5, terminando no desfecho"],',
    '  "curvaExagero": ["se for história de exagero: o que é quase normal, depois estranho, depois improvável, depois inacreditável"],',
    '  "obrigatorio": ["coisas que a história PRECISA ter"],',
    '  "proibido": ["coisas que estragariam esta história"],',
    '  "absurdo": "o exagero, concretizado: a coisa real de que parte e o tamanho mentiroso a que chega. Nada fora do mundo — sem magia, sem bicho falando, sem sobrenatural confirmado",',
    '  "graca": "de onde vem o riso nesta versão",',
    '  "final": "o desfecho de verdade, que TEM de estar entre os beats — o que acontece no fim, e o que fica sem explicação"',
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
    linhas.push('== O EXAGERO ==');
    linhas.push(d.absurdo);
    linhas.push('Isto ACONTECE na história, e ninguém acha estranho. Não explique, não justifique, não sugira que foi sonho ou engano. Conte como quem conta que choveu.');
    linhas.push('Sustente com detalhe de gente que estava lá: número, nome, hora, quem viu. É o detalhe que segura a dúvida de pé.');
    linhas.push('E não saia do mundo: o exagero é de tamanho, nunca de natureza. Nada de magia, bicho que fala, gente que voa ou sobrenatural confirmado — na hora em que a história vira fantasia, quem ouve tem certeza de que é mentira e vai embora.');
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
  linhas.push('');
  linhas.push('== O TAMANHO É PARTE DA HISTÓRIA ==');
  linhas.push(`Isto vai virar vídeo curto. Contado em voz alta, tem de caber entre 1 minuto e 1min30 — algo perto de ${Math.round(CAUSO_SEG_ALVO_MIN * CAUSO_PALAVRAS_POR_SEGUNDO)} a ${Math.round(CAUSO_SEG_ALVO_MAX * CAUSO_PALAVRAS_POR_SEGUNDO)} palavras.`);
  /* r236: a prioridade explícita que faltava. Sem isto, "caiba no tamanho" e
   * "termine direito" competiam sem hierarquia — e quando competiam de
   * verdade, o tamanho vencia, porque é o mais fácil de checar. */
  linhas.push('Mas o tamanho é a ÚLTIMA das cinco prioridades, nesta ordem: (1) a história TEM de estar completa — começo, meio e fim; (2) sem repetição nem enchimento; (3) no ritmo de vídeo curto; (4) perto do tamanho pedido; (5) terminando de um jeito natural, não forçado. As quatro primeiras vêm antes do número de palavras — nenhuma delas se sacrifica pela quinta.');
  linhas.push('NÃO escreva uma história longa e corte no fim. Construa já nesse tamanho: escolha os acontecimentos que cabem e conte só esses. É melhor uma história pequena inteira do que uma grande pela metade.');
  linhas.push('');
  linhas.push('CADA FRASE TEM DE FAZER A HISTÓRIA ANDAR. Se uma frase não acrescenta acontecimento, não muda o que se sabe e não muda o que se sente, ela sobra — e sobra atrapalha, porque quem ouve percebe que já entendeu e sai.');
  linhas.push('NÃO REPITA O QUE JÁ DISSE. Dito uma vez, está dito. Não reforce com outras palavras, não retome para "deixar claro", não resuma no fim o que acabou de acontecer. Repetição é o jeito mais comum de uma história boa ficar chata.');
  linhas.push('TERMINE QUANDO ACABOU. No instante em que a história entregou o que tinha para entregar, pare. Não amarre pontas, não comente, não feche com uma frase de efeito.');
  linhas.push('');
  linhas.push('A HISTÓRIA TEM DE TER COMEÇO, MEIO E FIM DENTRO DESSE TAMANHO. Nunca pare logo depois do ponto alto sem fechar — o desfecho tem de estar escrito, mesmo que em uma frase só. Uma história um pouco mais longa ou mais curta que o alvo, mas inteira, é sempre melhor que uma do tamanho certo e cortada pela metade.');
  if (o.tamanho) linhas.push(`- Extensão pedida: ${o.tamanho}.`);
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
    persona: 'Você entende de mentira contada com convicção. Sabe que o prazer da história de pescador não está no peixe: está em ver o homem sustentando o tamanho do peixe com cara séria. E sabe que a mentira boa NUNCA sai do mundo real — ela infla o que existe.',
    dimensoes: ['exagero', 'absurdo'],
    olhar: [
      'O exagero parte de uma coisa que EXISTE, ou a história inventou coisa que não existe no mundo (magia, bicho falando, gente voando)? Isto é o mais grave: quem ouve ganha certeza de que é mentira e para de ouvir.',
      'Depois de ouvir, dá para ficar em dúvida — "será que é verdade?" — ou dá para ter certeza de que não é?',
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
      'A assombração foi CONFIRMADA? Se o texto mostra o fantasma e garante que era um, acabou a dúvida e acabou o causo. Tem de restar a chance de ter sido o boi do vizinho, o vento, a cachaça.',
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
/* O reescritor recebe SÓ o que reprovou. Quando o que reprovou é tamanho ou
 * repetição, ele precisa saber que a saída não é cortar o fim — é tirar o que
 * não faz a história andar. Sem isso, "encurte" vira truncar. */
function buildReescreverCausoPrompt(texto, ordens, dossie) {
  const linhas = [];
  linhas.push('Você é quem corrige o causo. Recebe a história e uma lista fechada de problemas.');
  linhas.push('Isto NÃO é uma história nova: é esta mesma, sem esses defeitos. O que não está na lista, você não toca.');
  linhas.push('');
  /* O REESCRITOR TAMBÉM ESCREVE — logo, também precisa da doutrina.
   *
   * Sem ela, o reescritor recebia "tire a fada daqui" e podia devolver um
   * duende: obedecia à ordem e reincidia no mesmo defeito, porque ninguém lhe
   * disse por que fada é proibida. Era o único prompt de escrita da mesa sem a
   * regra que a ferramenta inteira existe para cumprir. */
  linhas.push(causoBlocoDoutrina());
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
  /* ENCURTAR NÃO É TRUNCAR. Sem esta linha, "a história está longa demais" vira
   * cortar o fim — e a história perde justamente o pagamento. O que sai é o que
   * não faz a história andar, em qualquer lugar do texto. */
  linhas.push('Se o que reprovou foi TAMANHO ou REPETIÇÃO: não corte o fim nem resuma a história. Tire as frases que não acrescentam acontecimento, as explicações do que já foi mostrado e as informações que voltam com outras palavras. O fim fica; o que sai é a gordura do meio.');
  /* r236: a trava textual acima não bastou sozinha — na prática a história
   * saía cortada mesmo assim. Isto é reforço, não substituição: diz o mesmo
   * de outro jeito e pede uma conferência explícita antes de responder. */
  linhas.push('COMPLETUDE VEM ANTES DO TAMANHO: se encolher o bastante para caber no alvo estragaria o desfecho, encolha menos — ou não encolha. Uma história um pouco mais longa, mas inteira, vale mais do que uma do tamanho certo sem fim.');
  linhas.push('Antes de responder, confira: a história que você vai devolver tem começo, meio e fim? Ela chega a um desfecho de verdade, ou some logo depois do ponto alto? Se sumir, não é isto que você devolve — encolha menos e tente de novo.');
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

/* -------------------------------------------------------------------------- */
/* §6 — OS MODOS DA MESA                                                       */
/* -------------------------------------------------------------------------- */

/* O MESMO MOTOR, CABEÇAS DIFERENTES.
 *
 * O que faz o Causos funcionar não é o assunto dele — é o processo: quatro
 * caminhos em vez de um, dossiê antes da escrita, críticos independentes que
 * não leem uns aos outros, juiz de código que não perdoa nota baixa, e
 * reescrita só do que reprovou. Esse processo serve para qualquer formato.
 *
 * O que muda de um modo para o outro é a CABEÇA: a doutrina, os gêneros, as
 * dimensões avaliadas, os críticos convocados e o que a conta mede.
 *
 * O MODO `causos` APONTA PARA AS FUNÇÕES QUE JÁ EXISTIAM, sem uma vírgula de
 * diferença. Não há aqui uma "versão generalizada" do Causos: há o Causos, do
 * jeito que estava, mais uma indireção no ponto de chamada. É a única forma de
 * garantir o que o usuário pediu — que o modo aprovado não seja descaracterizado
 * —, e test/causos-intocado.test.js compara as assinaturas para provar.
 *
 * Para acrescentar um terceiro formato, escreva a cabeça dele e registre aqui.
 * Nada no pipeline precisa saber que ele existe. */
const CAUSO_MODOS = {
  causos: {
    id: 'causos',
    label: 'Causos e histórias dos mais antigos',
    descricao: 'Histórias de pescador, assombração, caso engraçado, lenda do lugar. O absurdo é de tamanho, não de natureza — e quem ouve termina sem saber se acredita.',
    rotuloIdeia: 'A ideia',
    exemplo: 'um vizinho que jurava ter pescado um peixe do tamanho de um bezerro',
    generos: () => CAUSO_GENEROS,
    dimensoes: () => CAUSO_DIMENSOES,
    dimensao: causoDimensao,
    criticosDe: causoCriticosDe,
    conferir: conferirCausoLocal,
    doutrina: causoBlocoDoutrina,
    prompts: {
      conceitos: buildConceitosPrompt,
      dossie: buildDossiePrompt,
      contar: buildContarPrompt,
      critico: buildCriticoPrompt,
      reescrever: buildReescreverCausoPrompt,
    },
  },
};

/* O modo de diálogos vive em src/dialogos-motor.js, carregado ANTES deste
 * arquivo. O registro é condicional para que o motor continue de pé se aquele
 * arquivo faltar — a plataforma abre por file:// e um script a menos não pode
 * derrubar a ferramenta inteira. */
if (typeof conferirDialogoLocal === 'function') {
  CAUSO_MODOS.dialogos = {
    id: 'dialogos',
    label: 'Diálogos naturais',
    descricao: 'Conversas que parecem estar acontecendo: gente que se interrompe, desconversa, responde torto. Sem narrador e sem rubrica — só o que sai da boca.',
    rotuloIdeia: 'A conversa',
    exemplo: 'dois amigos discutindo quem vai pagar a conta do bar',
    generos: () => DIALOGO_GENEROS,
    dimensoes: () => DIALOGO_DIMENSOES,
    dimensao: dialogoDimensao,
    criticosDe: dialogoCriticosDe,
    conferir: conferirDialogoLocal,
    doutrina: dialogoBlocoDoutrina,
    prompts: {
      conceitos: buildDialogoConceitosPrompt,
      dossie: buildDialogoDossiePrompt,
      contar: buildDialogoContarPrompt,
      critico: buildDialogoCriticoPrompt,
      reescrever: buildDialogoReescreverPrompt,
    },
  };
}

const CAUSO_MODO_PADRAO = 'causos';

/** O modo pedido, ou o Causos. Id desconhecido cai no padrão em vez de quebrar:
 *  um rascunho antigo no localStorage não pode deixar a ferramenta sem motor. */
function causoModo(id) {
  return CAUSO_MODOS[id] || CAUSO_MODOS[CAUSO_MODO_PADRAO];
}

/** Os modos disponíveis, para a tela desenhar o seletor. */
function causoModosDisponiveis() {
  return Object.keys(CAUSO_MODOS).map((id) => {
    const m = CAUSO_MODOS[id];
    return { id: m.id, label: m.label, descricao: m.descricao, rotuloIdeia: m.rotuloIdeia, exemplo: m.exemplo };
  });
}

const CAUSO_MAX_REVISOES = 2;

/** A reescrita PIOROU? Duas perguntas — "sim" para qualquer uma decide:
 *  1. saiu com MAIS achados no total do que tinha antes (a trava original);
 *  2. INTRODUZIU um corte (dimensão `final`) que não existia antes — mesmo
 *     que o total tenha melhorado. Completude nunca é moeda de troca (r236):
 *     "a ferramenta simplesmente cortando a história no meio para conseguir
 *     atender ao limite de duração". A pergunta 1 sozinha não pega isto: uma
 *     reescrita pode trocar um achado de tamanho por um achado de corte —
 *     mesma contagem — e passaria pela pergunta 1 sem ser notada.
 *
 *  Um corte que JÁ existia ANTES da reescrita não conta como introduzido: não
 *  é uma regressão desta reescrita, e a próxima volta do juiz continua livre
 *  para cobrá-lo. A trava é contra piorar, não contra existir. */
function causoRevisaoPiorou(antes, depois) {
  const a = (antes && antes.achados) || [];
  const d = (depois && depois.achados) || [];
  if (d.length > a.length) return true;
  const jaTinhaCorte = a.some((x) => x.dimensao === 'final');
  const agoraTemCorte = d.some((x) => x.dimensao === 'final');
  return agoraTemCorte && !jaTinhaCorte;
}

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
  // O modo escolhe a cabeça; o processo abaixo é o mesmo para todos.
  const modo = causoModo(o.modo);
  const etapa = (k, t, d) => { if (typeof o.onEtapa === 'function') o.onEtapa(k, t, d); };
  const lerJSON = (r) => (typeof extractJSON === 'function' ? extractJSON(r && r.content) : null);
  const etapas = [];
  let modelo = '';

  // 1) CONCEPÇÃO — quatro histórias possíveis, não uma.
  etapa('conceitos', 'Procurando a história…', 'Quatro caminhos possíveis para essa ideia.');
  const rConc = await chamar(modo.prompts.conceitos(ideia, memoria));
  modelo = (rConc && rConc.model) || modelo;
  const conceitos = normalizarConceitos(lerJSON(rConc));
  if (!conceitos.length) throw new Error('Não foi possível encontrar uma história nessa ideia.');
  const escolha = escolherConceito(conceitos, memoria);
  etapas.push('conceitos');

  // 2) DOSSIÊ — personagens, mundo, voz e plano do conceito escolhido.
  etapa('dossie', 'Montando a mesa…', `${escolha.escolhido.titulo || 'Conceito escolhido'}: gente, lugar e voz.`);
  const rDoss = await chamar(modo.prompts.dossie(escolha.escolhido, ideia, memoria));
  modelo = (rDoss && rDoss.model) || modelo;
  const dossie = normalizarDossie(lerJSON(rDoss), escolha.escolhido);
  etapas.push('dossie');

  // 3) CONTAR.
  etapa('contar', 'Contando…', dossie.voz.quem ? `Na voz de ${dossie.voz.quem}.` : 'Escrevendo o causo.');
  const rTexto = await chamar(modo.prompts.contar(dossie, { tamanho: o.tamanho }));
  modelo = (rTexto && rTexto.model) || modelo;
  let atual = _cLimpar(rTexto && rTexto.content);
  if (!atual) throw new Error('A IA não devolveu a história.');
  etapas.push('contar');

  const criticosIds = modo.criticosDe(dossie.genero);
  let local = modo.conferir(atual, dossie, { memoria, genero: dossie.genero });
  let juizo = null;
  let criticas = [];

  for (let volta = 0; volta <= CAUSO_MAX_REVISOES; volta++) {
    // 4) CRÍTICOS EM PARALELO — independentes, cada um com a sua lente.
    etapa('criticos', 'A mesa está lendo…', `${criticosIds.length} críticos, cada um com a sua lente.`);
    const respostas = await Promise.all(criticosIds.map(async (id) => {
      try {
        const r = await chamar(modo.prompts.critico(id, atual, dossie, local.achados));
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
    juizo = julgarCauso(criticas, local.achados, modo);
    if (juizo.aprovado || volta === CAUSO_MAX_REVISOES) break;

    // 6) REESCRITA — só o que o juiz mandou.
    etapa('reescrita', 'Corrigindo…', juizo.ordens.length === 1
      ? `1 ponto: ${juizo.ordens[0].dimensao}.`
      : `${juizo.ordens.length} pontos, do mais grave para o menos.`);
    let novo = '';
    try {
      const rRe = await chamar(modo.prompts.reescrever(atual, juizo.ordens, dossie));
      modelo = (rRe && rRe.model) || modelo;
      novo = _cLimpar(rRe && rRe.content);
    } catch (_) { novo = ''; }
    if (!novo) break;

    // A reescrita precisa MELHORAR o que foi medido — e não pode trocar
    // completude por tamanho. Ver `causoRevisaoPiorou`.
    const localNovo = modo.conferir(novo, dossie, { memoria, genero: dossie.genero });
    if (causoRevisaoPiorou(local, localNovo)) {
      etapas.push('reescrita-descartada');
      break;
    }
    atual = novo;
    local = localNovo;
    etapas.push('reescrita');
  }

  etapa('pronto', 'Pronto.', juizo && juizo.aprovado ? 'A mesa aprovou.' : 'Entregando a melhor versão.');
  return {
    modo: modo.id,
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
