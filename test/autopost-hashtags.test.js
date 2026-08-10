// HASHTAGS DO AUTOPOST — derivadas do conteúdo, não do nicho escolhido
//
// Relato: as hashtags pareciam definidas de antemão pela categoria — escolher
// um nicho trazia sempre o mesmo conjunto, em vez de tags feitas para AQUELE
// conteúdo.
//
// Medido no prompt que sai para a IA (a Groq não é alcançável do ambiente de
// desenvolvimento, então o que dá para medir é o que ela RECEBE):
//
//   tags prontas oferecidas como escolha    24 → 0
//     dessas, ligadas ao conteúdo            0
//   regras "nicho → hashtag" embutidas       9 → 0
//   molde JSON com conjunto colável        sim → não
//
// As 24 incluíam um mapa explícito ("trabalho/carreira → #trabalho", "receitas
// → #culinaria", "lifestyle → #parati") e um molde de resposta já preenchido
// com tags reais. Com um cardápio desses, escolher do cardápio é o caminho mais
// barato — e o pacote sai preso à categoria.
//
// Prompt, porém, é pedido. O que estes testes protegem de verdade é a
// CONFERÊNCIA no código (`auditarHashtags`), que roda depois de cada geração,
// mede se as tags saíram do conteúdo e alimenta o refino quando não saíram.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
const api = ler('autopost-ia/js/api.js');
const pkg = ler('autopost-ia/js/package.js');
const app = ler('autopost-ia/js/app.js');

let A;
beforeAll(() => {
  const nomes = ['REGRAS_HASHTAGS', 'RUBRICA_PACOTE', 'HASHTAGS_GENERICAS', 'hashtagEhGenerica',
    'palavrasDoConteudo', 'hashtagAncorada', 'auditarHashtags', 'penalidadeHashtags',
    'MIN_HASHTAGS_ANCORADAS'];
  (0, eval)([api, pkg].join('\n;\n') + `\n;globalThis.__AP__ = { ${nomes.join(', ')} };`);
  A = globalThis.__AP__;
});

// Conteúdo real de teste: um relato com assunto, objeto e situação concretos.
const CONTEUDO = `Hoje eu fui na assistência técnica arrumar a máquina de lavar da minha vó.
O técnico olhou, mexeu num fio solto atrás e disse que não ia cobrar nada.
Ela tinha juntado duzentos reais achando que ia perder tudo.`;

const pacoteCom = (tags) => ({ hashtags: tags.map((t) => ({ tag: t, tipo: 'nicho' })) });

describe('o prompt não entrega mais um cardápio de hashtags', () => {
  it('acabou o mapa "nicho → hashtag"', () => {
    // Era a forma mais direta do defeito relatado: escolheu o nicho, recebeu a
    // tag. Nove regras dessas, uma para cada categoria.
    const mapa = [...A.REGRAS_HASHTAGS.matchAll(/→\s*#?[a-z0-9]+/g)];
    expect(mapa.length, 'ainda há mapeamento nicho → tag').toBe(0);
  });

  it('o molde da resposta não vem com tags reais para copiar', () => {
    // O molde é o formato exato que a IA vai devolver — tag real ali é a
    // sugestão mais forte que existe.
    const valores = [...pkg.matchAll(/"tag"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(valores.length, 'o molde precisa continuar existindo').toBeGreaterThan(0);
    valores.forEach((v) => {
      // Vale qualquer marcador que NÃO seja uma hashtag utilizável: "<descrição
      // do que colocar>" ou "...". O que não pode é uma tag pronta.
      expect(/^[a-z0-9]+$/.test(v), `"${v}" é uma hashtag colável, não um marcador`).toBe(false);
    });
  });

  it('manda derivar do conteúdo e diz onde olhar', () => {
    expect(A.REGRAS_HASHTAGS).toMatch(/DERIVADAS DESTE CONTEÚDO/);
    ['nomes próprios', 'situação específica', 'assunto concreto']
      .forEach((t) => expect(A.REGRAS_HASHTAGS, t).toContain(t));
  });

  it('diz explicitamente que a categoria é contexto, não fonte de hashtag', () => {
    expect(A.REGRAS_HASHTAGS).toMatch(/NÃO é fonte de hashtag/);
    expect(A.REGRAS_HASHTAGS).toMatch(/Dois vídeos da mesma categoria.*hashtags diferentes/s);
  });

  it('cobra uma prova de especificidade antes de devolver', () => {
    expect(A.REGRAS_HASHTAGS).toMatch(/PROVA OBRIGATÓRIA/);
    expect(A.REGRAS_HASHTAGS).toMatch(/Pelo menos 3 das 5/);
  });

  it('as tags que sobraram no prompt estão lá para serem proibidas ou como exemplo alheio', () => {
    // O exemplo de raciocínio cita tags — de um vídeo que não é o do usuário, e
    // dito com todas as letras. Sem essa marca, ele viraria outro cardápio.
    expect(A.REGRAS_HASHTAGS).toMatch(/não as reaproveite/);
    expect(A.REGRAS_HASHTAGS).toMatch(/NUNCA use tag de plataforma/);
  });

  it('o juiz passou a reprovar conjunto genérico', () => {
    const r = A.RUBRICA_PACOTE.find((x) => x.id === 'hashtags');
    expect(r.desc).toMatch(/DERIVADAS do conteúdo/);
    expect(r.desc).toMatch(/qualquer vídeo da mesma categoria/);
  });
});

describe('a conferência sabe o que é tag de plataforma', () => {
  it('reconhece as que cabem em qualquer vídeo', () => {
    ['fyp', 'foryou', 'parati', 'viral', 'tiktok', 'reels', 'shorts', 'trending']
      .forEach((t) => expect(A.hashtagEhGenerica(t), t).toBe(true));
  });

  it('não confunde com tag de assunto', () => {
    ['maquinadelavar', 'assistenciatecnica', 'consertodeeletro', 'forro', 'caruaru']
      .forEach((t) => expect(A.hashtagEhGenerica(t), t).toBe(false));
  });

  it('reconhece mesmo com #, maiúscula ou acento', () => {
    ['#FYP', 'ParaTi', 'Viral'].forEach((t) => expect(A.hashtagEhGenerica(t), t).toBe(true));
  });
});

describe('a conferência sabe o que veio do conteúdo', () => {
  const palavras = () => A.palavrasDoConteudo(CONTEUDO);

  it('tag composta conta quando carrega uma palavra do conteúdo', () => {
    expect(A.hashtagAncorada('maquinadelavar', palavras())).toBe(true);
    expect(A.hashtagAncorada('assistenciatecnica', palavras())).toBe(true);
  });

  it('tag curta conta quando está dentro de uma palavra do conteúdo', () => {
    // "tecnico" aparece no texto; a tag "tecnic" não seria buscável, mas
    // "tecnico" tem de casar com "tecnico" e "tecnica".
    expect(A.hashtagAncorada('tecnico', palavras())).toBe(true);
  });

  it('tag sem relação nenhuma não conta', () => {
    ['futebol', 'maquiagem', 'investimentos'].forEach((t) =>
      expect(A.hashtagAncorada(t, palavras()), t).toBe(false));
  });

  it('palavra comum demais não vira âncora', () => {
    // Sem esta guarda, "parati" contaria como ancorada em QUALQUER texto que
    // tivesse a palavra "para" — e passaria justamente a tag mais genérica.
    expect(A.palavrasDoConteudo('para que isso como aquilo')).toEqual([]);
    expect(A.hashtagAncorada('parati', A.palavrasDoConteudo('isso é para você'))).toBe(false);
  });

  it('acento e caixa não atrapalham', () => {
    expect(A.hashtagAncorada('MaquinaDeLavar', A.palavrasDoConteudo('a máquina quebrou'))).toBe(true);
  });
});

describe('o veredito sobre um conjunto de hashtags', () => {
  it('conjunto genérico é reprovado, e a mensagem diz o que trocar', () => {
    const r = A.auditarHashtags(pacoteCom(['fyp', 'viral', 'parati', 'storytime', 'relato']), CONTEUDO);
    expect(r.ok).toBe(false);
    expect(r.genericas.length).toBe(3);
    expect(r.problemas.join(' ')).toMatch(/plataforma/);
    expect(r.problemas.join(' ')).toMatch(/termo que aparece no conteúdo/);
  });

  it('conjunto do nicho, mas alheio ao conteúdo, também é reprovado', () => {
    // O caso do relato: tags plausíveis para a CATEGORIA, nenhuma para o vídeo.
    const r = A.auditarHashtags(
      pacoteCom(['storytime', 'relato', 'historiasreais', 'desabafo', 'indignacao']), CONTEUDO);
    expect(r.ok).toBe(false);
    expect(r.genericas.length, 'nenhuma é de plataforma — o problema é outro').toBe(0);
    expect(r.ancoradas.length).toBeLessThan(A.MIN_HASHTAGS_ANCORADAS);
  });

  it('conjunto derivado do conteúdo passa', () => {
    const r = A.auditarHashtags(
      pacoteCom(['assistenciatecnica', 'historiareal', 'maquinadelavar', 'tecnicohonesto', 'gratidao']),
      CONTEUDO);
    expect(r.ok, r.problemas.join(' | ')).toBe(true);
    expect(r.ancoradas.length).toBeGreaterThanOrEqual(A.MIN_HASHTAGS_ANCORADAS);
  });

  it('uma tag de plataforma no meio de um conjunto bom já reprova', () => {
    const r = A.auditarHashtags(
      pacoteCom(['assistenciatecnica', 'maquinadelavar', 'tecnicohonesto', 'gratidao', 'fyp']),
      CONTEUDO);
    expect(r.ok).toBe(false);
    expect(r.genericas).toEqual(['fyp']);
  });

  it('aceita hashtag em texto puro — é o formato depois da edição manual', () => {
    const r = A.auditarHashtags({ hashtags: ['maquinadelavar', 'assistenciatecnica'] }, CONTEUDO);
    expect(r.ancoradas.length).toBe(2);
    expect(r.ok).toBe(true);
  });

  it('pacote sem hashtags não quebra nem inventa problema', () => {
    // Lista vazia é outra falha, tratada em outro lugar; aqui não há o que medir.
    expect(A.auditarHashtags({}, CONTEUDO).problemas).toEqual([]);
    expect(A.auditarHashtags(null, '').ok).toBe(true);
  });
});

describe('a conferência muda o que é entregue', () => {
  it('entre duas versões, a que personaliza ganha o desempate', () => {
    const generico = A.auditarHashtags(pacoteCom(['fyp', 'viral', 'parati', 'storytime', 'relato']), CONTEUDO);
    const derivado = A.auditarHashtags(
      pacoteCom(['assistenciatecnica', 'historiareal', 'maquinadelavar', 'tecnicohonesto', 'gratidao']), CONTEUDO);
    expect(A.penalidadeHashtags(derivado)).toBe(0);
    // 88 do juiz para o genérico contra 82 para o derivado: o derivado leva.
    expect(88 - A.penalidadeHashtags(generico)).toBeLessThan(82 - A.penalidadeHashtags(derivado));
  });

  it('a geração roda a conferência com o conteúdo em mãos', () => {
    expect(app).toMatch(/const auditoria = auditarHashtags\(pacote, texto\)/);
  });

  it('nota alta com hashtag genérica não encerra o trabalho', () => {
    // Era o buraco: o juiz é uma LLM e aprovava conjunto genérico; aprovado, o
    // laço parava e o pacote ia para a tela como estava.
    expect(app).toMatch(/if \(avaliacao\.nota_total >= NOTA_ALVO && auditoria\.ok\)/);
  });

  it('o que a conferência achou vai para o refino, em bloco próprio', () => {
    expect(app).toMatch(/problemasHashtags: auditoria\.problemas/);
    expect(pkg).toMatch(/CONFERÊNCIA DAS HASHTAGS \(verificação automática/);
  });

  it('o botão "outra versão" das hashtags também passa pela conferência', () => {
    // É onde clica quem não gostou das tags. Devolver outro conjunto genérico
    // seria repetir o problema com outras palavras.
    expect(app).toMatch(/if \(campo === 'hashtags'\) \{\s*\n\s*const a = auditarHashtags/);
    expect(app).toMatch(/gerarVariacaoCampo\(campo, conteudo, item\.pacote \|\| \{\}, briefing, a\.problemas\)/);
    // E só troca se a segunda tentativa não for pior que a primeira.
    expect(app).toMatch(/penalidadeHashtags\(b\) <= penalidadeHashtags\(a\)/);
    expect(pkg).toMatch(/CONFERÊNCIA DA TENTATIVA ANTERIOR/);
  });

  it('o desempate usa a nota descontada, mas o usuário continua vendo a do juiz', () => {
    expect(app).toMatch(/notaEfetiva = avaliacao\.nota_total - penalidadeHashtags\(auditoria\)/);
    expect(app).toMatch(/nota: melhor\.avaliacao\.nota_total/);
  });
});

describe('vale no arquivo que o usuário abre', () => {
  it('o autopost-ia.html assado carrega as regras novas e a conferência', () => {
    const assado = ler('autopost-ia.html');
    expect(assado).toContain('DERIVADAS DESTE CONTEÚDO');
    expect(assado).toContain('function auditarHashtags');
    expect(assado).not.toContain('src="js/package.js"');
  });
});
