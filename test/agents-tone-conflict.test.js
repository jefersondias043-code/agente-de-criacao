// COERÊNCIA DE TOM — quando o texto de origem puxa para o lado contrário.
//
// O defeito: a fonte diz "sucesso extraordinário", o usuário pede tom
// pessimista, e a palavra atravessa para a matéria. O resultado elogia e
// critica o mesmo acontecimento em parágrafos diferentes.
//
// A regra: em conflito entre a fonte e a configuração, manda a configuração —
// mas só sobre a FORMA. O acontecimento é intocável, e citação entre aspas é
// reproduzida literalmente mesmo contrariando o tom.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  A = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js'],
    ['detectarConflitosDeTom', 'semCitacoes', 'toneValence', 'buildEditorPrompt',
      'runEditorAgent', 'buildWriterPrompt', 'buildInterpreterPrompt',
      'normalizeInterpretation', 'interpretationToBlock', 'buildPrompt', 'TONES']
  );
});

const materia = (lead, corpo) => ({
  titulo: 'Título', subtitulo: 'Sub', lead, corpo: corpo || [], resumo: '', hashtags: [],
});

describe('valência derivada do catálogo de tons', () => {
  it('tons positivos e negativos têm lado', () => {
    expect(A.toneValence('Otimista')).toBe(1);
    expect(A.toneValence('Inspirador')).toBe(1);
    expect(A.toneValence('Pessimista')).toBe(-1);
    expect(A.toneValence('Alarmista')).toBe(-1);
  });
  it('tons neutros e emocionais não têm lado a defender', () => {
    expect(A.toneValence('Neutro')).toBe(0);
    expect(A.toneValence('Formal')).toBe(0);
    expect(A.toneValence('Dramático')).toBe(0);
  });
  it('tom desconhecido não quebra', () => {
    expect(A.toneValence('NaoExiste')).toBe(0);
  });
  it('todo tom do catálogo é classificável', () => {
    A.TONES.forEach((g) => g.items.forEach((i) => {
      expect(typeof A.toneValence(i.id), i.id).toBe('number');
    }));
  });
});

describe('detecção do vazamento', () => {
  it('acha elogio da fonte em matéria pessimista', () => {
    const c = A.detectarConflitosDeTom(
      materia('A obra foi um sucesso e atendeu 500 famílias.'), 'Pessimista');
    expect(c).toContain('sucesso');
  });

  it('acha crítica da fonte em matéria otimista', () => {
    const c = A.detectarConflitosDeTom(
      materia('O caos no trânsito piorou com a obra.'), 'Otimista');
    expect(c).toContain('caos');
  });

  it('texto já coerente com o tom não acusa nada', () => {
    expect(A.detectarConflitosDeTom(
      materia('A obra atendeu 500 famílias e ampliou o atendimento.'), 'Otimista')).toEqual([]);
  });

  it('tom sem lado não é verificado', () => {
    expect(A.detectarConflitosDeTom(
      materia('A obra foi um sucesso e também um desastre.'), 'Neutro')).toEqual([]);
  });

  it('varre o corpo inteiro, não só o lead', () => {
    const c = A.detectarConflitosDeTom(
      materia('A obra atendeu 500 famílias.', ['O resultado foi exemplar.']), 'Pessimista');
    expect(c).toContain('exemplar');
  });
});

describe('citação é intocável', () => {
  it('juízo DENTRO de aspas não conta como conflito', () => {
    const c = A.detectarConflitosDeTom(
      materia('O secretário afirmou que a entrega foi "um sucesso extraordinário".'), 'Pessimista');
    expect(c).toEqual([]);
  });

  it('mas o mesmo juízo FORA das aspas conta', () => {
    const c = A.detectarConflitosDeTom(
      materia('A entrega foi um sucesso, disse o secretário: "os números falam".'), 'Pessimista');
    expect(c).toContain('sucesso');
  });

  it('semCitacoes remove só o trecho entre aspas', () => {
    expect(A.semCitacoes('Ele disse "foi ótimo" ontem')).not.toContain('ótimo');
    expect(A.semCitacoes('Ele disse "foi ótimo" ontem')).toContain('ontem');
  });
});

describe('o revisor recebe os trechos exatos a consertar', () => {
  it('o prompt lista o conflito e manda resolver primeiro', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Pessimista', ['sucesso', 'conquista']);
    expect(p).toContain('CONFLITO DE TOM DETECTADO');
    expect(p).toContain('sucesso, conquista');
    expect(p).toContain('preservando o ACONTECIMENTO');
  });

  it('sem conflito, o prompt não ganha a seção', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Pessimista', []);
    expect(p).not.toContain('CONFLITO DE TOM DETECTADO');
  });

  it('o prompt protege a citação de ser reescrita', () => {
    const p = A.buildEditorPrompt(materia('x'), {}, 'Jornalístico', 'Otimista', ['caos']);
    expect(p).toContain('dentro de uma CITAÇÃO');
  });

  it('runEditorAgent detecta sozinho e registra o que achou', async () => {
    const call = async () => ({ content: JSON.stringify({
      titulo: 'Título', subtitulo: 'Sub',
      lead: 'A obra atendeu 500 famílias, número abaixo da fila de espera.',
      corpo: [], resumo: '',
    }), model: 'stub' });
    const r = await A.runEditorAgent(
      materia('A obra foi um sucesso e atendeu 500 famílias.'), {}, 'Jornalístico', 'Pessimista', call);
    expect(r.conflitos).toContain('sucesso');
    expect(r.conflitosRestantes).toEqual([]);   // a revisão resolveu
  });
});

describe('a separação entre fato e juízo na origem', () => {
  it('o interpretador é mandado registrar o fato em linguagem NEUTRA', () => {
    const p = A.buildInterpreterPrompt('pauta');
    expect(p).toContain('linguagem NEUTRA');
    expect(p).toContain('SEPARE O FATO DO JUÍZO');
  });

  it('a carga avaliativa da fonte vira campo próprio', () => {
    const p = A.buildInterpreterPrompt('pauta');
    expect(p).toContain('"carga_original"');
    expect(p).toContain('"viés_da_fonte"');
  });

  it('a citação é poupada da neutralização', () => {
    expect(A.buildInterpreterPrompt('pauta')).toContain('As CITAÇÕES são exceção');
  });

  it('normaliza os campos novos', () => {
    const i = A.normalizeInterpretation({
      assunto: 'x', carga_original: ['sucesso extraordinário'], 'viés_da_fonte': 'positivo',
    }, 'txt');
    expect(i.cargaOriginal).toEqual(['sucesso extraordinário']);
    expect(i.viesDaFonte).toBe('POSITIVO');
  });

  it('sem os campos, assume viés neutro', () => {
    expect(A.normalizeInterpretation({ assunto: 'x' }, 'txt').viesDaFonte).toBe('NEUTRO');
  });

  it('o redator vê o juízo da fonte marcado como coisa a NÃO herdar', () => {
    const bloco = A.interpretationToBlock({
      fatos: ['f'], cargaOriginal: ['sucesso extraordinário'], viesDaFonte: 'POSITIVO',
    });
    expect(bloco).toContain('NÃO herde estas expressões');
    expect(bloco).toContain('Viés do texto de origem: POSITIVO');
  });
});

describe('a regra de prioridade chega a quem escreve', () => {
  it('o redator sabe que o tom da fonte não manda', () => {
    const p = A.buildWriterPrompt({ fatos: ['f'] }, 'Jornalístico', 'Pessimista');
    expect(p).toContain('QUEM MANDA NO TOM É A ESCOLHA DO USUÁRIO');
    expect(p).toContain('UNIDADE');
  });

  it('o redator é lembrado de que o acontecimento não muda', () => {
    const p = A.buildWriterPrompt({ fatos: ['f'] }, 'Jornalístico', 'Otimista');
    expect(p).toContain('Mudou de quem é a avaliação');
  });

  it('o modo rápido recebe a mesma regra', () => {
    expect(A.buildPrompt('Jornalístico', 'Pessimista', 'conteúdo').prompt)
      .toContain('QUEM MANDA NO TOM É A ESCOLHA DO USUÁRIO');
  });
});
