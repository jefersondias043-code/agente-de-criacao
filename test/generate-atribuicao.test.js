// ATRIBUIÇÃO — de quem é a afirmação.
//
// Defeito relatado em uso real: a matéria escrevia "as obras da Ponte
// Salvador-Itaparica começam em 1º de agosto" como se o veículo garantisse a
// data. O que existe é um governador tendo anunciado isso — e a diferença não
// é de estilo: a obra pode atrasar, e aí o erro passa a ser do jornal.
//
// A regra "informação tem dono" JÁ EXISTIA no prompt. Não bastava, por três
// motivos que estes testes travam:
//   1. o agente de interpretação extraía o fato SEM a fonte, então o redator
//      não tinha como atribuir — a informação chegava órfã;
//   2. a regra vivia dentro do bloco de segurança jurídica, enquadrada como
//      precaução para pauta de crime;
//   3. a auditoria determinística só cobrava atribuição em assunto criminal.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  A = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js'],
    ['EDITORIAL_ATTRIBUTION', 'EDITORIAL_SAFETY', 'buildPrompt', 'buildWriterPrompt',
      'buildEditorPrompt', 'buildInterpreterPrompt', 'normalizeInterpretation',
      'interpretationToBlock', 'auditarRiscoJuridico']
  );
});

const materia = (lead, corpo) => ({
  titulo: 'Título', subtitulo: 'Sub', lead, corpo: corpo || [], resumo: '', hashtags: [],
});

describe('o bloco de atribuição', () => {
  it('existe como regra de REDAÇÃO, separada do bloco jurídico', () => {
    expect(A.EDITORIAL_ATTRIBUTION).toBeTruthy();
    expect(A.EDITORIAL_ATTRIBUTION).toContain('TODA INFORMAÇÃO TEM DONO');
    expect(A.EDITORIAL_ATTRIBUTION).not.toBe(A.EDITORIAL_SAFETY);
  });

  it('lista o que precisa de fonte — e o que dispensa', () => {
    const b = A.EDITORIAL_ATTRIBUTION;
    ['anúncio', 'previsão', 'estimativa', 'balanço', 'causa', 'avaliação']
      .forEach((t) => expect(b.toLowerCase(), t).toContain(t));
    expect(b).toMatch(/DISPENSA FONTE/);
    expect(b).toMatch(/ocorrido e verificável/);
  });

  it('traz o caso relatado como exemplo, errado e certo', () => {
    const b = A.EDITORIAL_ATTRIBUTION;
    expect(b).toContain('Ponte Salvador-Itaparica');
    expect(b).toMatch(/✗ ERRADO/);
    expect(b).toMatch(/✓ CERTO/);
    expect(b).toMatch(/Segundo o governador/);
  });

  it('ensina as construções e os verbos neutros', () => {
    const b = A.EDITORIAL_ATTRIBUTION;
    ['segundo', 'de acordo com', 'conforme', 'informou', 'anunciou']
      .forEach((c) => expect(b.toLowerCase(), c).toContain(c));
    expect(b).toMatch(/admitiu.*confessou/);   // os que já julgam
  });

  it('evita o excesso: atribuir não é "segundo" em toda frase', () => {
    expect(A.EDITORIAL_ATTRIBUTION).toMatch(/NÃO é encher o texto/);
    expect(A.EDITORIAL_ATTRIBUTION).toMatch(/cobre o parágrafo inteiro/);
  });
});

describe('o interpretador preserva o dono da informação', () => {
  // Causa-raiz: sem isso o redator recebe afirmações órfãs e não TEM COMO
  // atribuir, por mais que o prompt dele mande.
  it('pede o fato já com a fonte, e mostra o caso da ponte', () => {
    const p = A.buildInterpreterPrompt('pauta qualquer');
    expect(p).toMatch(/JÁ COM A FONTE/);
    expect(p).toMatch(/Segundo o governador, as obras começam em 1º de agosto/);
    expect(p).toMatch(/NUNCA 'as obras começam em 1º de agosto'/);
  });

  it('tem um campo próprio para quem afirmou o quê', () => {
    const p = A.buildInterpreterPrompt('pauta');
    expect(p).toContain('"atribuicoes"');
    expect(p).toMatch(/QUEM DISSE É PARTE DO FATO/);
    expect(p).toMatch(/declaração, anúncio, nota, relatório, previsão ou estimativa/);
  });

  it('distingue declaração de acontecimento observável', () => {
    const p = A.buildInterpreterPrompt('pauta');
    expect(p).toMatch(/NÃO são acontecimentos: são DECLARAÇÕES/);
    expect(p).toMatch(/a ponte foi interditada/);
  });

  it('manda registrar quando o material não diz quem informou', () => {
    expect(A.buildInterpreterPrompt('pauta')).toMatch(/NÃO diz de quem veio a informação/);
  });

  it('o campo sobrevive à normalização e chega ao redator', () => {
    const i = A.normalizeInterpretation({
      assunto: 'Ponte', fatos: ['Segundo o governador, as obras começam em 1º de agosto'],
      atribuicoes: ['governador Jerônimo Rodrigues — anunciou o início das obras para 1º de agosto'],
    }, 'pauta');
    expect(i.atribuicoes).toEqual(['governador Jerônimo Rodrigues — anunciou o início das obras para 1º de agosto']);
    const bloco = A.interpretationToBlock(i);
    expect(bloco).toContain('ATRIBUIÇÕES');
    expect(bloco).toContain('Jerônimo Rodrigues');
  });

  it('interpretação antiga (sem o campo) não quebra', () => {
    const i = A.normalizeInterpretation({ assunto: 'X', fatos: ['a'] }, 'pauta');
    expect(i.atribuicoes).toEqual([]);
    expect(A.interpretationToBlock(i)).not.toContain('ATRIBUIÇÕES');
  });
});

describe('os dois modos de geração cobram a atribuição', () => {
  const interp = { fatos: ['f'], citacoes: [], atribuicoes: ['governador — anunciou a data'] };

  it('modo rápido leva o bloco e a verificação', () => {
    const p = A.buildPrompt('Jornalístico', 'Neutro', 'pauta').prompt;
    expect(p).toContain('TODA INFORMAÇÃO TEM DONO');
    expect(p).toMatch(/8b\. ATRIBUIÇÃO/);
  });

  it('modo agentes leva o bloco, o mapa e a verificação', () => {
    const p = A.buildWriterPrompt(interp, 'Jornalístico', 'Neutro');
    expect(p).toContain('TODA INFORMAÇÃO TEM DONO');
    expect(p).toMatch(/A lista "ATRIBUIÇÕES" acima é o seu mapa/);
    expect(p).toMatch(/7b\. ATRIBUIÇÃO/);
  });

  it('vale em qualquer estilo e tom — não é regra de pauta policial', () => {
    [['Publicitário', 'Otimista'], ['Crônica', 'Nostálgico'], ['Editorial', 'Provocativo']]
      .forEach(([e, t]) => {
        expect(A.buildPrompt(e, t, 'pauta').prompt, `${e}/${t}`).toContain('TODA INFORMAÇÃO TEM DONO');
        expect(A.buildWriterPrompt(interp, e, t), `${e}/${t}`).toContain('TODA INFORMAÇÃO TEM DONO');
      });
  });
});

describe('o editor não pode apagar a atribuição ao enxugar', () => {
  it('é avisado de que "segundo X" não é perífrase', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Neutro', [], []);
    expect(p).toMatch(/NÃO são perífrase/);
    expect(p).toMatch(/jamais o dono da afirmação/);
  });

  it('confere no fim se alguma atribuição sumiu', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Neutro', [], []);
    expect(p).toMatch(/3b\. Alguma atribuição/);
    expect(p).toMatch(/passou a afirmar por conta própria/);
  });
});

describe('a auditoria cobra atribuição em QUALQUER pauta', () => {
  // Antes só disparava em assunto criminal — e o defeito foi num anúncio de obra.
  const semFonte = materia(
    'As obras da Ponte Salvador-Itaparica começam em 1º de agosto.',
    ['O investimento é de R$ 4,5 bilhões e deve gerar 5 mil empregos.']);
  const comFonte = materia(
    'Segundo o governador, as obras da Ponte Salvador-Itaparica começam em 1º de agosto.',
    ['De acordo com o governo do estado, o investimento é de R$ 4,5 bilhões.']);
  const interpComDeclaracoes = {
    entidades: ['Governo do Estado'], sensivel: [],
    atribuicoes: ['governador — anunciou o início das obras', 'governo do estado — informou o valor'],
  };

  it('acusa a matéria que assume a promessa como sua', () => {
    const avisos = A.auditarRiscoJuridico(semFonte, interpComDeclaracoes);
    const a = avisos.find((x) => x.tipo === 'sem-atribuicao');
    expect(a).toBeTruthy();
    expect(a.aviso).toMatch(/2 informação\(ões\) declarada\(s\)/);
    expect(a.aviso).toMatch(/o erro passa a ser seu/);
  });

  it('não acusa quando a matéria atribui', () => {
    const avisos = A.auditarRiscoJuridico(comFonte, interpComDeclaracoes);
    expect(avisos.find((x) => x.tipo === 'sem-atribuicao')).toBeFalsy();
  });

  it('não acusa quando a pauta não tinha declaração nenhuma', () => {
    // Pauta só de acontecimento observado não precisa de fonte.
    const avisos = A.auditarRiscoJuridico(semFonte, { entidades: [], sensivel: [], atribuicoes: [] });
    expect(avisos.find((x) => x.tipo === 'sem-atribuicao')).toBeFalsy();
  });

  it('a checagem antiga de pauta criminal continua valendo', () => {
    const crime = materia('A operação policial terminou com a apreensão de documentos ligados a fraude na empresa.');
    const avisos = A.auditarRiscoJuridico(crime, { entidades: ['Polícia'], sensivel: ['CRIMINAL'], atribuicoes: [] });
    expect(avisos.find((x) => x.tipo === 'sem-atribuicao')).toBeTruthy();
  });
});
