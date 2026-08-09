'use strict';
/* ============================================================
   CATEGORIA DO VÍDEO — o nicho, informado ANTES de gerar.

   Por que existe: o pacote saía sem nenhuma informação de nicho.
   `montarBriefing()` mandava `niche: ''` para o gerador, e o prompt
   já tinha a linha "Nicho/palavras-chave do canal" esperando por ela
   — só que ela nunca chegava preenchida. Com isso, hashtag e palavra-
   chave eram deduzidas só do texto transcrito, que muitas vezes não
   diz a que público aquilo se destina.

   Cada categoria carrega um CONTEXTO, não só um rótulo. Rótulo
   sozinho ("Culinária") acrescenta pouco; o que muda hashtag e
   palavra-chave é saber quem assiste e com que vocabulário busca.
   ============================================================ */

const CATEGORIAS_VIDEO = [
  { id: 'noticias',    emoji: '📰', label: 'Notícias e política',
    ctx: 'Jornalismo, política e atualidades. Público busca por fato, local e nomes envolvidos; termos de busca costumam ser o assunto + a cidade/estado. Evite hashtag de entretenimento genérico.' },
  { id: 'storytime',   emoji: '🎙️', label: 'Relato pessoal (storytime)',
    ctx: 'História real contada em primeira pessoa. O público procura pela SITUAÇÃO ("chefe tóxico", "cliente mal-educado"), não pelo nome de quem conta. Hashtags de comunidade e de emoção funcionam melhor que as de tema.' },
  { id: 'comedia',     emoji: '😂', label: 'Comédia e humor',
    ctx: 'Esquete, piada, imitação, situação cômica. Busca-se pelo formato e pelo bordão; a linguagem é de deboche leve. Palavras-chave curtas e faladas rendem mais que termos formais.' },
  { id: 'educacao',    emoji: '📚', label: 'Educação e tutoriais',
    ctx: 'Ensina algo passo a passo. O público busca pela DÚVIDA que tem ("como fazer X", "o que significa Y") — palavras-chave em forma de pergunta e de problema são as que trazem tráfego.' },
  { id: 'tecnologia',  emoji: '💻', label: 'Ciência e tecnologia',
    ctx: 'Tecnologia, ciência, IA, gadgets. Público técnico busca por nome de produto, ferramenta e versão. Termos em inglês convivem naturalmente com os em português.' },
  { id: 'negocios',    emoji: '📈', label: 'Negócios e finanças',
    ctx: 'Empreendedorismo, carreira, dinheiro, investimento. Busca-se por objetivo financeiro e por dor profissional. Evite promessa de retorno — a plataforma penaliza e o público desconfia.' },
  { id: 'saude',       emoji: '🩺', label: 'Saúde e bem-estar',
    ctx: 'Saúde, treino, alimentação, saúde mental. Público busca por sintoma, objetivo e rotina. Cuidado com afirmação de resultado ou promessa de cura: prefira linguagem de experiência.' },
  { id: 'esportes',    emoji: '⚽', label: 'Esportes',
    ctx: 'Jogo, atleta, time, campeonato. Busca-se por nome próprio (time, jogador, competição) e por rodada/data — nomes próprios valem mais que termos genéricos.' },
  { id: 'musica',      emoji: '🎵', label: 'Música e dança',
    ctx: 'Música, performance, dança, bastidor. Busca-se por artista, música e trend. O nome da faixa e do desafio costumam ser a palavra-chave mais forte.' },
  { id: 'games',       emoji: '🎮', label: 'Games',
    ctx: 'Jogos, gameplay, dicas, notícias do setor. Público busca por nome do jogo, plataforma, patch e personagem. Jargão da comunidade é vantagem, não ruído.' },
  { id: 'moda',        emoji: '💄', label: 'Moda e beleza',
    ctx: 'Moda, maquiagem, cabelo, cuidados. Busca-se por peça, produto, ocasião e resultado desejado. Nome de marca e tipo de pele/cabelo são termos de alta intenção.' },
  { id: 'culinaria',   emoji: '🍳', label: 'Culinária',
    ctx: 'Receita, técnica, ingrediente, restaurante. Público busca pelo NOME DO PRATO e pela restrição ("sem glúten", "barato", "de air fryer"). Ingrediente principal é palavra-chave obrigatória.' },
  { id: 'viagem',      emoji: '✈️', label: 'Viagem e turismo',
    ctx: 'Destino, roteiro, dica de viagem. Busca-se pelo lugar e pelo tipo de viagem (barata, em família, primeira vez). Nome do destino é sempre a palavra-chave principal.' },
  { id: 'automotivo',  emoji: '🚗', label: 'Automotivo',
    ctx: 'Carro, moto, mecânica, review. Busca-se por marca, modelo, ano e problema específico. Nome do modelo vale mais que qualquer termo genérico.' },
  { id: 'familia',     emoji: '👨‍👩‍👧', label: 'Família e relacionamentos',
    ctx: 'Maternidade, paternidade, casal, criação de filhos. Público busca pela FASE ("recém-nascido", "adolescente") e pelo conflito vivido. Tom de identificação supera tom de conselho.' },
  { id: 'religiao',    emoji: '🙏', label: 'Religião e espiritualidade',
    ctx: 'Fé, mensagem, reflexão espiritual. Busca-se por passagem, data litúrgica e sentimento. Respeite a linguagem própria da comunidade — termo trocado soa de fora.' },
  { id: 'pets',        emoji: '🐶', label: 'Pets e animais',
    ctx: 'Animais de estimação, adestramento, cuidados, resgate. Busca-se por espécie, raça e comportamento ("por que meu cachorro…"). Raça é palavra-chave de alta intenção.' },
  { id: 'casa',        emoji: '🏠', label: 'Casa, decoração e DIY',
    ctx: 'Reforma, decoração, organização, faça-você-mesmo. Busca-se por cômodo, orçamento e problema de espaço. "Gastando pouco" e "aluguel" são recortes que puxam busca.' },
  { id: 'arte',        emoji: '🎨', label: 'Arte e cultura',
    ctx: 'Arte, literatura, cinema, teatro, processo criativo. Busca-se por obra, autor e técnica. Nome próprio da obra costuma ser o termo mais buscado.' },
  { id: 'motivacao',   emoji: '🔥', label: 'Motivação e desenvolvimento',
    ctx: 'Superação, hábitos, produtividade, disciplina. Busca-se pelo obstáculo ("procrastinação", "medo de começar") mais que pela solução. Frase de impacto funciona como palavra-chave.' },
  { id: 'entretenimento', emoji: '🎬', label: 'Entretenimento e celebridades',
    ctx: 'Famosos, novela, reality, cultura pop. Busca-se por nome da pessoa e do programa, e pelo acontecimento do momento. Nome próprio é insubstituível aqui.' },
];

const CATEGORIA_FAVS_KEY = 'autopost_categorias_favoritas';
const CATEGORIA_ULTIMA_KEY = 'autopost_categoria_ultima';

/** Categoria pelo id (null quando 'auto' ou desconhecida). */
function categoriaPorId(id) {
  if (!id || id === 'auto') return null;
  return CATEGORIAS_VIDEO.find((c) => c.id === id) || null;
}

/** Ids favoritados, filtrados contra o catálogo (favorito órfão some sozinho). */
function categoriasFavoritas() {
  try {
    const cru = JSON.parse(localStorage.getItem(CATEGORIA_FAVS_KEY) || '[]');
    if (!Array.isArray(cru)) return [];
    return cru.filter((id) => categoriaPorId(id));
  } catch (_) { return []; }
}

function salvarFavoritas(ids) {
  try { localStorage.setItem(CATEGORIA_FAVS_KEY, JSON.stringify(ids)); } catch (_) { /* modo privado */ }
}

/** Liga/desliga o favorito e devolve o estado novo. */
function alternarFavorita(id) {
  if (!categoriaPorId(id)) return false;
  const favs = categoriasFavoritas();
  const i = favs.indexOf(id);
  if (i >= 0) favs.splice(i, 1); else favs.push(id);
  salvarFavoritas(favs);
  return i < 0;
}

function categoriaEhFavorita(id) {
  return categoriasFavoritas().indexOf(id) >= 0;
}

/** Catálogo na ORDEM DE EXIBIÇÃO: favoritas primeiro, resto na ordem original. */
function categoriasOrdenadas() {
  const favs = categoriasFavoritas();
  const marca = (c) => Object.assign({}, c, { fav: favs.indexOf(c.id) >= 0 });
  const favoritas = favs.map((id) => marca(categoriaPorId(id))).filter(Boolean);
  const resto = CATEGORIAS_VIDEO.filter((c) => favs.indexOf(c.id) < 0).map(marca);
  return favoritas.concat(resto);
}

/** Última categoria usada — pré-seleciona na próxima vez. */
function categoriaUltima() {
  try {
    const id = localStorage.getItem(CATEGORIA_ULTIMA_KEY);
    return categoriaPorId(id) ? id : 'auto';
  } catch (_) { return 'auto'; }
}

function salvarCategoriaUltima(id) {
  try {
    if (id && id !== 'auto') localStorage.setItem(CATEGORIA_ULTIMA_KEY, id);
    else localStorage.removeItem(CATEGORIA_ULTIMA_KEY);
  } catch (_) { /* modo privado */ }
}

/** Linha de nicho para o briefing do gerador (vai em `briefing.niche`). */
function categoriaParaBriefing(id) {
  const c = categoriaPorId(id);
  return c ? `${c.label} — ${c.ctx}` : '';
}

/** Rótulo curto, para o checklist e para o contexto do juiz. */
function categoriaLabel(id) {
  const c = categoriaPorId(id);
  return c ? c.label : '';
}
