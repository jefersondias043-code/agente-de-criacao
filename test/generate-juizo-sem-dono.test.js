// JUÍZO DE VALOR SEM DONO — quando o portal vira quem elogia.
//
// Defeito relatado em uso real, com o texto gerado em mãos: numa matéria sobre
// a compra de veículos em Acajutiba, o lead atribuía certo ("Segundo o
// prefeito…") e os TRÊS parágrafos seguintes seguiam afirmando "é um passo
// importante", "é um exemplo de como a gestão pública pode ser eficaz", "é um
// sinal de que a prefeitura está comprometida" — sem dono nenhum. Quem lê
// entende que a opinião é do portal. Eram palavras do prefeito.
//
// A regra "informação tem dono" (r192) já existia e não pegava isto, por dois
// motivos que estes testes travam:
//   1. ela era lida como regra sobre FATO (data, número, promessa). Avaliação
//      parece descrição e passava batido;
//   2. a auditoria olhava o texto INTEIRO: um único "segundo" no lead já a
//      satisfazia, e os parágrafos seguintes ficavam livres.
//
// Há ainda um segundo caminho para o mesmo estrago: a camada de comentário
// opinativo. Ela é opinião do VEÍCULO por design — mas repetir o elogio que a
// FONTE fez não é opinião do veículo, é a opinião da fonte com o autor trocado.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  A = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js'],
    ['EDITORIAL_ATTRIBUTION', 'COMENTARIO_BASE', 'SAFETY_MARCADORES_JUIZO',
      'SAFETY_JUIZO_VAZIO', 'SAFETY_MARCADORES_ATRIBUICAO', 'auditarRiscoJuridico',
      'buildWriterPrompt', 'buildEditorPrompt', 'buildPrompt']
  );
});

// O texto EXATO que o usuário recebeu do gerador.
const acajutiba = {
  titulo: 'Prefeito de Acajutiba Anuncia Aquisição de Veículos para o Município',
  subtitulo: 'Investimento de Mais de 900 Mil Reais visa Melhorar a Qualidade de Vida da População',
  lead: 'O prefeito Jadiel Souza anunciou a aquisição de seis novos veículos para o município de Acajutiba, um investimento de mais de 900 mil reais que visa melhorar a qualidade de vida da população. Segundo o prefeito, essa aquisição é um exemplo de gestão eficaz e responsável.',
  corpo: [
    'A aquisição dos veículos é um passo importante para a melhoria dos serviços públicos em Acajutiba. Com essa nova frota, a prefeitura poderá atender às necessidades da população de forma mais eficiente. É um exemplo de como a gestão pública pode ser eficaz quando se prioriza o bem-estar da comunidade.',
    'O investimento de mais de 900 mil reais é um sinal de que a prefeitura está comprometida em melhorar a qualidade de vida dos moradores de Acajutiba. A aquisição desses veículos é um reconhecimento do esforço da prefeitura em fornecer serviços de qualidade para a população. Além disso, é um exemplo de como a gestão pública pode ser transparente e responsável.',
    'A aquisição dos veículos também é um exemplo de como a prefeitura está trabalhando para melhorar a infraestrutura do município. Com essa nova frota, a prefeitura poderá realizar serviços de manutenção e reparo de forma mais eficiente, o que vai beneficiar a população como um todo. É um passo importante para o desenvolvimento de Acajutiba e para a melhoria da qualidade de vida de seus moradores.',
  ],
  resumo: '', hashtags: [],
};
const interpAcajutiba = {
  entidades: ['Prefeitura de Acajutiba', 'Jadiel Souza'], sensivel: [],
  atribuicoes: ['prefeito Jadiel Souza — anunciou a compra de seis veículos por mais de R$ 900 mil'],
};

describe('o texto relatado é reprovado agora', () => {
  it('a auditoria acusa — antes passava sem um único aviso', () => {
    const avisos = A.auditarRiscoJuridico(acajutiba, interpAcajutiba);
    const a = avisos.find((x) => x.tipo === 'juizo-sem-dono');
    expect(a, 'nenhum aviso de juízo sem dono').toBeTruthy();
    expect(a.aviso).toMatch(/avalia\(m\) sem dizer quem avalia/);
    expect(a.aviso).toMatch(/pode ficar mais curta/);
  });

  it('acusa os TRÊS parágrafos do corpo, e não o lead — que atribui', () => {
    const a = A.auditarRiscoJuridico(acajutiba, interpAcajutiba)
      .find((x) => x.tipo === 'juizo-sem-dono');
    // O lead tem "Segundo o prefeito": a fonte cobre o parágrafo dela.
    expect(a.aviso).not.toMatch(/\b1º/);
    ['2º', '3º', '4º'].forEach((n) => expect(a.aviso, n).toContain(n));
  });

  it('uma fonte no lead NÃO cobre a matéria inteira', () => {
    // Era exatamente esta a brecha: _temAlgum() sobre o texto todo.
    const soLead = { ...acajutiba, corpo: ['A compra é um passo importante para o município.'] };
    expect(A.auditarRiscoJuridico(soLead, interpAcajutiba)
      .find((x) => x.tipo === 'juizo-sem-dono')).toBeTruthy();
  });
});

describe('a versão corrigida passa', () => {
  const corrigido = {
    ...acajutiba,
    corpo: [
      'Segundo o prefeito, a nova frota deve melhorar o atendimento à população e é um exemplo de gestão eficaz.',
      'De acordo com a prefeitura, o investimento de mais de 900 mil reais demonstra o compromisso com os moradores do município.',
      'A prefeitura informou que os seis veículos já foram entregues. O material não detalha quais secretarias serão atendidas.',
    ],
  };

  it('juízo COM dono no próprio parágrafo não é acusado', () => {
    expect(A.auditarRiscoJuridico(corrigido, interpAcajutiba)
      .find((x) => x.tipo === 'juizo-sem-dono')).toBeFalsy();
  });

  it('matéria só de fato observável, sem juízo nenhum, não é acusada', () => {
    const seco = {
      titulo: 'T', subtitulo: 'S',
      lead: 'A prefeitura comprou seis veículos por mais de R$ 900 mil.',
      corpo: ['Os veículos foram entregues na sexta-feira, na sede da prefeitura.'],
      resumo: '', hashtags: [],
    };
    expect(A.auditarRiscoJuridico(seco, interpAcajutiba)
      .find((x) => x.tipo === 'juizo-sem-dono')).toBeFalsy();
  });
});

describe('a camada de comentário opinativo é tratada à parte', () => {
  // Com ela LIGADA o usuário PEDIU opinião do veículo: acusar todo parágrafo
  // opinativo seria brigar com o recurso. Mas elogio de fórmula continua
  // defeito — as próprias regras de comentário já o proíbem.
  it('com comentário ligado, o elogio de fórmula ainda é acusado', () => {
    const a = A.auditarRiscoJuridico(acajutiba, interpAcajutiba, 'positivos')
      .find((x) => x.tipo === 'juizo-sem-dono');
    expect(a).toBeTruthy();
    expect(a.aviso).toMatch(/Elogio de fórmula/);
    expect(a.aviso).toMatch(/opinião da fonte assinada pelo veículo/);
  });

  it('com comentário ligado, opinião ancorada e própria NÃO é acusada', () => {
    const ancorado = {
      titulo: 'T', subtitulo: 'S',
      lead: 'Segundo a prefeitura, seis veículos foram comprados por R$ 900 mil.',
      corpo: ['A prefeitura não divulgou o modelo dos veículos nem o prazo de uso. Seis carros para um município inteiro é frota que se esgota rápido.'],
      resumo: '', hashtags: [],
    };
    expect(A.auditarRiscoJuridico(ancorado, interpAcajutiba, 'positivos')
      .find((x) => x.tipo === 'juizo-sem-dono')).toBeFalsy();
  });

  it('o modo sem comentário é mais exigente que o modo com', () => {
    expect(A.SAFETY_JUIZO_VAZIO.length).toBeLessThan(A.SAFETY_MARCADORES_JUIZO.length);
    A.SAFETY_JUIZO_VAZIO.forEach((m) => expect(A.SAFETY_MARCADORES_JUIZO, m).toContain(m));
  });
});

describe('os marcadores de juízo', () => {
  it('cobrem as construções que apareceram no texto real', () => {
    ['é um exemplo de', 'é um sinal de', 'passo importante', 'é um reconhecimento', 'gestão eficaz']
      .forEach((m) => expect(A.SAFETY_MARCADORES_JUIZO, m).toContain(m));
  });

  it('nenhum é trecho de outro — senão o diagnóstico conta duas vezes', () => {
    // A mesma armadilha que já mordeu nos marcadores de comentário.
    const l = A.SAFETY_MARCADORES_JUIZO;
    const colisoes = [];
    l.forEach((a) => l.forEach((b) => { if (a !== b && b.includes(a)) colisoes.push(`"${a}" dentro de "${b}"`); }));
    expect(colisoes).toEqual([]);
  });

  it('não colidem com os marcadores de atribuição', () => {
    // Um marcador de juízo que contenha "segundo" nunca dispararia.
    const atrib = A.SAFETY_MARCADORES_ATRIBUICAO;
    A.SAFETY_MARCADORES_JUIZO.forEach((j) => {
      atrib.forEach((m) => expect(j.includes(m), `"${j}" contém "${m}"`).toBe(false));
    });
  });
});

describe('a regra chega aos prompts', () => {
  const interp = { fatos: ['f'], citacoes: [], atribuicoes: ['prefeito — anunciou a compra'] };

  it('o bloco de atribuição ganhou a seção de juízo, com o caso real', () => {
    const b = A.EDITORIAL_ATTRIBUTION;
    expect(b).toMatch(/JUÍZO DE VALOR TAMBÉM TEM DONO/);
    expect(b).toMatch(/AVALIAÇÃO NÃO É DESCRIÇÃO/);
    expect(b).toContain('Acajutiba');
    expect(b).toMatch(/TROCA O AUTOR/);
  });

  it('ensina as três saídas, inclusive cortar', () => {
    const b = A.EDITORIAL_ATTRIBUTION;
    expect(b).toMatch(/TEM DONO NO MATERIAL/);
    expect(b).toMatch(/NÃO TEM DONO.*corte/);
    expect(b).toMatch(/NUNCA invente um dono/);
    // O escape: sem permissão explícita de encurtar, o modelo enche de novo.
    expect(b).toMatch(/PODE FICAR MAIS CURTA/);
  });

  it('a camada de comentário passa a dizer de quem é a opinião', () => {
    const c = A.COMENTARIO_BASE;
    expect(c).toMatch(/DE QUEM É ESTA OPINIÃO/);
    expect(c).toMatch(/NÃO É COMENTÁRIO reescrever/);
    expect(c).toMatch(/assinar o release/);
    expect(c).toMatch(/PARÁGRAFO SÓ DE JUÍZO NÃO EXISTE/);
  });

  it('redator e editor conferem parágrafo a parágrafo', () => {
    expect(A.buildWriterPrompt(interp, 'Jornalístico', 'Neutro')).toMatch(/7c\. JUÍZO SEM DONO/);
    expect(A.buildEditorPrompt(acajutiba, {}, 'Jornalístico', 'Neutro', [], [])).toMatch(/3c\./);
    expect(A.buildPrompt('Jornalístico', 'Neutro', 'pauta').prompt).toMatch(/8c\. JUÍZO SEM DONO/);
  });

  it('os três avisam que fonte de um parágrafo não cobre o outro', () => {
    [A.buildWriterPrompt(interp, 'Jornalístico', 'Neutro'),
      A.buildEditorPrompt(acajutiba, {}, 'Jornalístico', 'Neutro', [], []),
      A.buildPrompt('Jornalístico', 'Neutro', 'pauta').prompt,
    ].forEach((p, i) => expect(p, `prompt ${i}`).toMatch(/não cobre o (terceiro|outro)|anterior não vale/i));
  });
});
