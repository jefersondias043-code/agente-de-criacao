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
    + ' narrativaVazia, narrElenco, narrPapel, narrBlocoElenco,'
    + ' NARR_LEMA, NARR_FORMATOS, NARR_TONS, NARR_PERGUNTAS, NARR_PAPEIS };';
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

describe('elenco', () => {
  const COM_ELENCO = {
    ...HISTORIA,
    elenco: [
      { nome: 'Paulo, o irmão', papel: 'antagonista', quer: 'quer vender o ponto e dividir o dinheiro' },
      { nome: 'Seu Vitor, do balcão', papel: 'aliado', quer: 'quer o emprego de volta' },
    ],
    formatoId: 'carrossel',
  };

  it('elenco completo não gera nenhum aviso', () => {
    const d = N.diagnosticarNarrativa(COM_ELENCO);
    expect(d.avisos).toEqual([]);
    expect(d.elenco).toBe(2);
    expect(d.score).toBe(100);
  });

  it('o elenco não interfere nos três portões do lema', () => {
    // O veredito continua sendo do protagonista: elenco impecável não salva uma
    // história sem obstáculo, e elenco problemático não derruba uma história boa.
    const semObstaculo = N.diagnosticarNarrativa({ ...COM_ELENCO, obstaculo: '' });
    expect(semObstaculo.pronto).toBe(false);

    const elencoRuim = N.diagnosticarNarrativa({
      ...HISTORIA,
      elenco: [{ nome: 'Alguém', papel: 'aliado', quer: '' }],
    });
    expect(elencoRuim.pronto).toBe(true);
    expect(elencoRuim.avisos.length).toBeGreaterThan(0);
  });

  it('personagem sem desejo é apontado como cenário', () => {
    const d = N.diagnosticarNarrativa({
      ...HISTORIA,
      elenco: [{ nome: 'Seu Vitor', papel: 'aliado', quer: '' }],
    });
    expect(d.avisos.join(' ')).toMatch(/Seu Vitor/);
    expect(d.avisos.join(' ')).toMatch(/cenário/i);
  });

  it('antagonista sem desejo recebe a cobrança mais dura', () => {
    const d = N.diagnosticarNarrativa({
      ...HISTORIA,
      elenco: [{ nome: 'Paulo', papel: 'antagonista', quer: '' }],
    });
    expect(d.avisos.join(' ')).toMatch(/não consegue se opor/i);
  });

  it('linha em branco recém-adicionada não conta como defeito', () => {
    const d = N.diagnosticarNarrativa({
      ...HISTORIA,
      elenco: [{ nome: '', papel: 'antagonista', quer: '' }],
    });
    expect(d.avisos).toEqual([]);
    expect(d.elenco).toBe(0);
  });

  it('personagem só com desejo, sem nome, é apontado', () => {
    const d = N.diagnosticarNarrativa({
      ...HISTORIA,
      elenco: [{ nome: '', papel: 'aliado', quer: 'quer que ela desista' }],
    });
    expect(d.avisos.join(' ')).toMatch(/sem nome/i);
  });

  it('nome repetido é apontado, ignorando acento e caixa', () => {
    const d = N.diagnosticarNarrativa({
      ...HISTORIA,
      elenco: [
        { nome: 'Antônio', papel: 'aliado', quer: 'quer ajudar' },
        { nome: 'antonio', papel: 'rival', quer: 'quer o mesmo ponto' },
      ],
    });
    expect(d.avisos.join(' ')).toMatch(/repetido/i);
  });

  it('protagonista repetido dentro do elenco é apontado', () => {
    const d = N.diagnosticarNarrativa({
      ...HISTORIA,
      protagonista: 'Dona Marlene',
      elenco: [{ nome: 'dona marlene', papel: 'aliado', quer: 'quer reabrir' }],
    });
    expect(d.avisos.join(' ')).toMatch(/protagonista está listado também/i);
  });

  it('avisa quando o elenco não cabe no formato — e o limite acompanha o formato', () => {
    const seis = Array.from({ length: 6 }, (_, i) => ({
      nome: 'Personagem ' + (i + 1), papel: 'aliado', quer: 'quer alguma coisa',
    }));
    const reels = N.diagnosticarNarrativa({ ...HISTORIA, elenco: seis, formatoId: 'reels' });
    expect(reels.avisos.join(' ')).toMatch(/sustenta cerca de 2/);

    const video = N.diagnosticarNarrativa({ ...HISTORIA, elenco: seis, formatoId: 'youtube' });
    expect(video.avisos.join(' ')).toMatch(/sustenta cerca de 5/);

    const cinco = seis.slice(0, 5);
    expect(N.diagnosticarNarrativa({ ...HISTORIA, elenco: cinco, formatoId: 'youtube' }).avisos).toEqual([]);
  });

  it('o formato Diálogo cobra pelo menos um personagem', () => {
    const semElenco = N.diagnosticarNarrativa({ ...HISTORIA, formatoId: 'dialogo' });
    expect(semElenco.avisos.join(' ')).toMatch(/Diálogo pede pelo menos um personagem/i);
    expect(semElenco.pronto).toBe(true);   // avisa, não trava

    const comElenco = N.diagnosticarNarrativa({ ...COM_ELENCO, formatoId: 'dialogo' });
    expect(comElenco.avisos).toEqual([]);
  });

  it('cada aviso do elenco custa uma vez só, por mais personagens que haja', () => {
    const tres = ['A', 'B', 'C'].map((nome) => ({ nome, papel: 'aliado', quer: '' }));
    const d = N.diagnosticarNarrativa({ ...HISTORIA, elenco: tres, formatoId: 'youtube' });
    expect(d.avisos.length).toBe(1);       // um aviso listando os três
    expect(d.avisos[0]).toMatch(/A, B, C/);
  });
});

describe('elenco no prompt', () => {
  const COM_ELENCO = {
    ...HISTORIA,
    elenco: [
      { nome: 'Paulo', papel: 'antagonista', quer: 'quer vender o ponto' },
      { nome: 'Seu Vitor', papel: 'aliado', quer: '' },
    ],
  };

  it('leva nomes, papéis e desejos declarados', () => {
    const { prompt } = N.buildNarrativaPrompt({ narrativa: COM_ELENCO, formatoId: 'carrossel' });
    expect(prompt).toContain('== ELENCO (além do protagonista) ==');
    expect(prompt).toContain('Paulo — Antagonista');
    expect(prompt).toContain('quer vender o ponto');
    expect(prompt).toContain('Seu Vitor — Aliado');
  });

  it('proíbe inventar personagem e manda usar os nomes como estão', () => {
    const { prompt } = N.buildNarrativaPrompt({ narrativa: COM_ELENCO });
    expect(prompt).toMatch(/Não crie personagens além dos listados/i);
    expect(prompt).toMatch(/nomes exatamente como estão/i);
    expect(prompt).toMatch(/Ninguém novo entra com nome próprio/i);
  });

  it('mantém o protagonista no centro', () => {
    const { prompt } = N.buildNarrativaPrompt({ narrativa: COM_ELENCO });
    expect(prompt).toMatch(/é o desejo DELE que impulsiona/i);
  });

  it('personagem sem desejo declarado não vira convite para inventar', () => {
    const { prompt } = N.buildNarrativaPrompt({ narrativa: COM_ELENCO });
    expect(prompt).toMatch(/não foi declarado — não invente/i);
  });

  it('sem elenco, nem o cabeçalho aparece', () => {
    const { prompt } = N.buildNarrativaPrompt({ narrativa: HISTORIA });
    expect(prompt).not.toContain('ELENCO');
    expect(N.narrBlocoElenco(HISTORIA)).toBe('');
  });

  it('a extração pede o elenco e proíbe inventar personagem', () => {
    const p = N.buildExtracaoNarrativaPrompt('Dois irmãos brigam pela padaria do pai.');
    expect(p).toContain('"elenco"');
    expect(p).toMatch(/nem personagens que não estejam no material/i);
    expect(p).toMatch(/O protagonista NÃO entra no elenco/);
    N.NARR_PAPEIS.forEach((papel) => expect(p).toContain(papel.id));
  });

  it('a afiação avalia o elenco em vez de deixar isso para o diagnóstico local', () => {
    const p = N.buildAfiacaoNarrativaPrompt(COM_ELENCO);
    expect(p).toMatch(/dispensavel/);
    expect(p).toMatch(/o que ele faz COM o objetivo do protagonista/i);
    expect(p).toContain('Paulo');
  });
});

describe('catálogos e rascunho', () => {
  it('todo formato tem rótulo, descrição, estrutura e limite de elenco', () => {
    N.NARR_FORMATOS.forEach((f) => {
      expect(f.id, f.id).toBeTruthy();
      expect(f.label, f.id).toBeTruthy();
      expect(f.desc, f.id).toBeTruthy();
      expect(Array.isArray(f.estrutura) && f.estrutura.length, f.id).toBeTruthy();
      expect(typeof f.elencoMax, f.id).toBe('number');
      expect(f.elencoMax, f.id).toBeGreaterThan(0);
    });
    expect(new Set(N.NARR_FORMATOS.map((f) => f.id)).size).toBe(N.NARR_FORMATOS.length);
  });

  it('as três perguntas da interface são as três do lema', () => {
    expect(N.NARR_PERGUNTAS.map((p) => p.id)).toEqual(['desejo', 'obstaculo', 'risco']);
    N.NARR_PERGUNTAS.forEach((p) => expect(N.NARR_LEMA).toContain(p.pergunta));
  });

  it('o rascunho vazio já vem com formato, tom, extensão e elenco válidos', () => {
    const v = N.narrativaVazia();
    expect(N.NARR_FORMATOS.some((f) => f.id === v.formatoId)).toBe(true);
    expect(N.NARR_TONS.some((t) => t.id === v.tomId)).toBe(true);
    expect(v.elenco).toEqual([]);
  });

  it('história salva antes do elenco continua legível', () => {
    // Migração: o campo não existia. Ler um rascunho antigo não pode quebrar
    // nem inventar personagens.
    const antiga = { protagonista: 'X', desejo: 'quer voltar para casa', obstaculo: 'perdeu o passaporte', risco: 'pode perder o emprego' };
    expect(N.narrElenco(antiga)).toEqual([]);
    const d = N.diagnosticarNarrativa(antiga);
    expect(d.pronto).toBe(true);
    expect(d.elenco).toBe(0);
  });

  it('todo formato, tom e extensão tem descrição para a legenda da tela', () => {
    // Regressão: as legendas eram atualizadas só no evento de troca do select,
    // então reabrir uma história do histórico mostrava o formato certo com a
    // descrição do formato anterior. Hoje quem escreve os selects também
    // escreve as legendas — e isso exige que todo item tenha `desc`.
    [...N.NARR_FORMATOS, ...N.NARR_TONS].forEach((i) => {
      expect(i.desc, i.id).toBeTruthy();
    });
  });

  it('papel desconhecido não quebra o rótulo', () => {
    expect(N.narrPapel('inexistente').id).toBe(N.NARR_PAPEIS[0].id);
    expect(N.narrPapel('aliado').label).toBe('Aliado');
  });

  it('o título do histórico usa o desejo e não estoura', () => {
    expect(N.narrativaTitulo(HISTORIA)).toContain('reabrir a padaria');
    const longo = N.narrativaTitulo({ desejo: 'x'.repeat(200) });
    expect(longo.length).toBeLessThanOrEqual(70);
  });
});
