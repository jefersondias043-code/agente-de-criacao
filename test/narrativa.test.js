// NARRATIVA — o diagnóstico "situação × história".
//
// Este motor é a trava da ferramenta: enquanto ele disser "situação", nenhum
// conteúdo é escrito. Um falso "história" faz o app produzir texto bonito sobre
// nada; um falso "situação" trava o usuário com a resposta certa na mão. Por
// isso as regras do lema estão cobertas uma a uma, incluindo os casos em que a
// pessoa responde a pergunta com a própria ausência ("nada me impede").
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (f) => fs.readFileSync(path.join(srcDir, f), 'utf8');

let N;
beforeAll(() => {
  const code = ['catalogs.js', 'core.js', 'narrativa.js'].map(read).join('\n;\n')
    + '\n;globalThis.__NARR__ = { diagnosticarNarrativa, buildNarrativaPrompt,'
    + ' buildExtracaoNarrativaPrompt, buildAfiacaoNarrativaPrompt, narrativaTitulo,'
    + ' narrativaVazia, NARR_LEMA, NARR_FORMATOS, NARR_TONS, NARR_PERGUNTAS };';
  (0, eval)(code);
  N = globalThis.__NARR__;
});

/** História completa e saudável — base dos testes de contraste. */
const HISTORIA = {
  protagonista: 'Dona Marlene, dona da padaria da esquina',
  desejo: 'quer reabrir a padaria do pai antes do fim do ano',
  obstaculo: 'o imóvel foi penhorado e o irmão dela quer vender o ponto',
  risco: 'pode perder as economias da aposentadoria e a relação com o irmão',
};

const status = (d, id) => d.perguntas.find((p) => p.id === id).status;

describe('as três perguntas do lema', () => {
  it('história completa recebe veredito de história', () => {
    const d = N.diagnosticarNarrativa(HISTORIA);
    expect(d.veredito).toBe('historia');
    expect(d.pronto).toBe(true);
    expect(d.perguntas.map((p) => p.status)).toEqual(['ok', 'ok', 'ok']);
    expect(d.score).toBe(100);
  });

  it('sem nenhuma resposta é situação, não história', () => {
    const d = N.diagnosticarNarrativa({});
    expect(d.veredito).toBe('situacao');
    expect(d.pronto).toBe(false);
    expect(d.perguntas.every((p) => p.status === 'faltando')).toBe(true);
    expect(d.resumo).toMatch(/situação/i);
  });

  it('cada pergunta sem resposta trava sozinha', () => {
    for (const campo of ['desejo', 'obstaculo', 'risco']) {
      const parcial = { ...HISTORIA, [campo]: '' };
      const d = N.diagnosticarNarrativa(parcial);
      expect(d.pronto, campo).toBe(false);
      expect(status(d, campo), campo).toBe('faltando');
    }
  });

  it('o diagnóstico é determinístico', () => {
    const a = N.diagnosticarNarrativa(HISTORIA);
    const b = N.diagnosticarNarrativa(HISTORIA);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('desejo', () => {
  it('"nada" como resposta é o mesmo que não responder', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, desejo: 'nada' });
    expect(status(d, 'desejo')).toBe('faltando');
  });

  it('desejo abstrato e curto é apontado como fraco, sem travar', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, desejo: 'quer ter sucesso' });
    expect(status(d, 'desejo')).toBe('fraco');
    expect(d.pronto).toBe(true);                 // é história, mas dá para melhorar
    expect(d.perguntas[0].dica).toBeTruthy();    // e a ferramenta diz como
  });

  it('tema sem ação (substantivo solto) é fraco', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, desejo: 'mais dinheiro no mês' });
    expect(status(d, 'desejo')).toBe('fraco');
  });

  it('objetivo concreto com verbo passa', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, desejo: 'quer comprar o terreno vizinho até dezembro' });
    expect(status(d, 'desejo')).toBe('ok');
  });
});

describe('obstáculo', () => {
  it('"nada o impede" é ausência de conflito e trava', () => {
    for (const resposta of ['nada', 'nada o impede', 'ninguém', 'não sei']) {
      const d = N.diagnosticarNarrativa({ ...HISTORIA, obstaculo: resposta });
      expect(status(d, 'obstaculo'), resposta).toBe('faltando');
      expect(d.pronto, resposta).toBe(false);
    }
  });

  it('obstáculo que se resolve com facilidade também trava — sem conflito não há envolvimento', () => {
    for (const resposta of ['é só pedir um empréstimo', 'nada demais, é fácil resolver', 'basta esperar']) {
      const d = N.diagnosticarNarrativa({ ...HISTORIA, obstaculo: resposta });
      expect(status(d, 'obstaculo'), resposta).toBe('faltando');
    }
  });

  it('obstáculo genérico demais é fraco', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, obstaculo: 'falta tempo' });
    expect(status(d, 'obstaculo')).toBe('fraco');
  });

  it('repetir o desejo não conta como obstáculo', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, obstaculo: HISTORIA.desejo });
    expect(status(d, 'obstaculo')).toBe('fraco');
  });

  it('avisa quando obstáculo e risco foram preenchidos com a mesma frase', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, risco: HISTORIA.obstaculo });
    expect(d.avisos.join(' ')).toMatch(/obstáculo e o risco/i);
  });

  // Regressão: um obstáculo bem escrito quase nunca repete as palavras do
  // desejo ("reabrir a padaria" × "o imóvel foi penhorado"). Nenhuma heurística
  // lexical pode acusar isso — o custo de um falso alarme aqui é o usuário
  // deixar de confiar no diagnóstico inteiro.
  it('não inventa defeito em história bem escrita', () => {
    const d = N.diagnosticarNarrativa(HISTORIA);
    expect(d.avisos).toEqual([]);
  });
});

describe('risco', () => {
  it('"não arrisca nada" trava — sem nada em jogo não há tensão', () => {
    for (const resposta of ['nada', 'não arrisca nada', 'nenhum']) {
      const d = N.diagnosticarNarrativa({ ...HISTORIA, risco: resposta });
      expect(status(d, 'risco'), resposta).toBe('faltando');
      expect(d.pronto, resposta).toBe(false);
    }
  });

  it('risco sem perda declarada é fraco', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, risco: 'vai ficar bem cansado' });
    expect(status(d, 'risco')).toBe('fraco');
  });

  it('perda explícita passa', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, risco: 'pode perder o emprego que sustenta a família' });
    expect(status(d, 'risco')).toBe('ok');
  });
});

describe('protagonista e placar', () => {
  it('sem protagonista o veredito continua, mas com aviso e desconto', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, protagonista: '' });
    expect(d.pronto).toBe(true);
    expect(d.avisos.join(' ')).toMatch(/protagonista/i);
    expect(d.score).toBeLessThan(100);
  });

  it('avisa quando o desejo é a ideia bruta copiada', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, ideia: HISTORIA.desejo });
    expect(d.avisos.join(' ')).toMatch(/ideia/i);
  });

  it('o placar fica entre 0 e 100 mesmo no pior caso', () => {
    const d = N.diagnosticarNarrativa({ desejo: 'nada', obstaculo: 'nada', risco: 'nada', ideia: 'x' });
    expect(d.score).toBeGreaterThanOrEqual(0);
    expect(d.score).toBeLessThanOrEqual(100);
  });

  it('mais respostas fortes valem mais pontos', () => {
    const fraca = N.diagnosticarNarrativa({ ...HISTORIA, desejo: 'quer ter sucesso' });
    const forte = N.diagnosticarNarrativa(HISTORIA);
    expect(forte.score).toBeGreaterThan(fraca.score);
  });
});

describe('acentuação e caixa não mudam o veredito', () => {
  it('trata "É só" e "e so" igual', () => {
    const a = N.diagnosticarNarrativa({ ...HISTORIA, obstaculo: 'É só pedir ajuda' });
    const b = N.diagnosticarNarrativa({ ...HISTORIA, obstaculo: 'e so pedir ajuda' });
    expect(status(a, 'obstaculo')).toBe(status(b, 'obstaculo'));
  });

  it('"Ninguém." com pontuação continua sendo ausência', () => {
    const d = N.diagnosticarNarrativa({ ...HISTORIA, obstaculo: 'Ninguém.' });
    expect(status(d, 'obstaculo')).toBe('faltando');
  });
});

describe('prompt de produção', () => {
  it('carrega o lema, a história e a estrutura do formato', () => {
    const { prompt, formato } = N.buildNarrativaPrompt({
      narrativa: HISTORIA, formatoId: 'carrossel', tomId: 'direto', tamanhoId: 'medio',
    });
    expect(prompt).toContain(N.NARR_LEMA);
    expect(prompt).toContain(HISTORIA.desejo);
    expect(prompt).toContain(HISTORIA.obstaculo);
    expect(prompt).toContain(HISTORIA.risco);
    expect(prompt).toContain(HISTORIA.protagonista);
    expect(formato.id).toBe('carrossel');
    formato.estrutura.forEach((e) => expect(prompt).toContain(e));
  });

  it('proíbe resolver o conflito com facilidade e inventar fatos', () => {
    const { prompt } = N.buildNarrativaPrompt({ narrativa: HISTORIA });
    expect(prompt).toMatch(/não pode ser resolvido por acaso/i);
    expect(prompt).toMatch(/não invente/i);
  });

  it('formato desconhecido cai no primeiro formato em vez de quebrar', () => {
    const { formato } = N.buildNarrativaPrompt({ narrativa: HISTORIA, formatoId: 'inexistente' });
    expect(formato.id).toBe(N.NARR_FORMATOS[0].id);
  });

  it('inclui a voz do perfil quando há um selecionado', () => {
    const { prompt } = N.buildNarrativaPrompt({
      narrativa: HISTORIA,
      perfil: { name: 'Municípios Bahia', handle: '@mb', tagline: 'Notícias que conectam.' },
    });
    expect(prompt).toContain('Municípios Bahia');
    expect(prompt).toContain('Notícias que conectam.');
  });

  it('sem perfil não deixa cabeçalho órfão no prompt', () => {
    const { prompt } = N.buildNarrativaPrompt({ narrativa: HISTORIA, perfil: null });
    expect(prompt).not.toContain('PERFIL QUE PUBLICA');
  });
});

describe('prompts de apoio', () => {
  it('a extração proíbe inventar o que a ideia não sustenta', () => {
    const p = N.buildExtracaoNarrativaPrompt('Vi um senhor consertando bicicletas na calçada.');
    expect(p).toContain('Vi um senhor consertando bicicletas na calçada.');
    expect(p).toMatch(/string vazia/i);
    expect(p).toMatch(/NÃO invente/);
  });

  it('a afiação pede escalada de obstáculos sem trocar a história', () => {
    const p = N.buildAfiacaoNarrativaPrompt(HISTORIA);
    expect(p).toMatch(/escalada/i);
    expect(p).toMatch(/Não acrescente fatos novos/i);
    expect(p).toContain(HISTORIA.desejo);
  });
});

describe('catálogos e rascunho', () => {
  it('todo formato tem rótulo, descrição e estrutura', () => {
    N.NARR_FORMATOS.forEach((f) => {
      expect(f.id, f.id).toBeTruthy();
      expect(f.label, f.id).toBeTruthy();
      expect(f.desc, f.id).toBeTruthy();
      expect(Array.isArray(f.estrutura) && f.estrutura.length, f.id).toBeTruthy();
    });
    expect(new Set(N.NARR_FORMATOS.map((f) => f.id)).size).toBe(N.NARR_FORMATOS.length);
  });

  it('as três perguntas da interface são as três do lema', () => {
    expect(N.NARR_PERGUNTAS.map((p) => p.id)).toEqual(['desejo', 'obstaculo', 'risco']);
    N.NARR_PERGUNTAS.forEach((p) => expect(N.NARR_LEMA).toContain(p.pergunta));
  });

  it('o rascunho vazio já vem com formato, tom e extensão válidos', () => {
    const v = N.narrativaVazia();
    expect(N.NARR_FORMATOS.some((f) => f.id === v.formatoId)).toBe(true);
    expect(N.NARR_TONS.some((t) => t.id === v.tomId)).toBe(true);
  });

  it('o título do histórico usa o desejo e não estoura', () => {
    expect(N.narrativaTitulo(HISTORIA)).toContain('reabrir a padaria');
    const longo = N.narrativaTitulo({ desejo: 'x'.repeat(200) });
    expect(longo.length).toBeLessThanOrEqual(70);
  });
});
