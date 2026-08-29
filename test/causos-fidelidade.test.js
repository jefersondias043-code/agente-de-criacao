// FIDELIDADE AO PEDIDO — a mesa para de trocar de assunto
//
// Relato do usuário: as histórias saem impressionantes e FOGEM do que ele
// escreveu no campo de ideia. Ele descreve o vídeo dele e recebe outra coisa.
//
// A causa não era o acaso — a mesa estava OTIMIZADA para se afastar:
//
//   1. a etapa de conceitos pedia "quatro histórias possíveis… não quatro
//      versões da mesma coisa", ou seja, premiava divergir do pedido;
//   2. a escolha entre os quatro pontuava novidade, graça e desenvolvimento,
//      e era CEGA à ideia do usuário;
//   3. da terceira etapa em diante a ideia não existia mais: contar, críticos
//      e reescrita trabalhavam a partir do dossiê — um documento que a própria
//      mesa escreveu, e que já era interpretação;
//   4. das treze dimensões medidas, nenhuma perguntava se era a história pedida.
//
// Quatro portas para o mesmo defeito. Este arquivo tranca as quatro.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let C;
beforeEach(() => {
  clearStorage();
  C = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
     'causos-motor.js', 'dialogos-motor.js'],
    ['causoTermosDaIdeia', 'causoFidelidade', 'causoBlocoIdeia', 'escolherConceito',
     'conferirCausoLocal', 'conferirDialogoLocal', 'buildConceitosPrompt',
     'buildContarPrompt', 'buildCriticoPrompt', 'buildReescreverCausoPrompt',
     'buildDialogoContarPrompt', 'buildDialogoCriticoPrompt', 'buildDialogoReescreverPrompt',
     'CAUSO_DIMENSOES', 'DIALOGO_DIMENSOES', 'runCausoPipeline']);
});

describe('quais palavras do pedido são o pedido', () => {
  it('guarda o que é concreto: gente, bicho, lugar, objeto, número', () => {
    const t = C.causoTermosDaIdeia('meu avô pescou três tambaquis no rio Negro');
    expect(t).toContain('tambaquis');
    expect(t).toContain('negro');
    expect(t).toContain('tres');
    // O VERBO não entra: "pescou" é honrado por "voltou do rio com três
    // tambaquis". Cobrá-lo literalmente reprovaria a história que mostra.
    expect(t).not.toContain('pescou');
  });

  it('descarta palavra de QUALIDADE — é o que a história prova, não o que ela cita', () => {
    // "Uma história bem contada nunca escreve 'impossível': ela mostra."
    // Cobrar essas palavras literalmente seria cobrar má escrita.
    const t = C.causoTermosDaIdeia('uma história engraçada e impossível sobre um peixe');
    expect(t).toContain('peixe');
    expect(t).not.toContain('engracada');
    expect(t).not.toContain('impossivel');
  });

  it('descarta o andaime do pedido ("quero um vídeo sobre…")', () => {
    const t = C.causoTermosDaIdeia('quero um vídeo contando a história de uma vaca');
    expect(t).toEqual(['vaca']);
  });
});

describe('a conta acusa TROCA DE ASSUNTO, não paráfrase', () => {
  const IDEIA = 'meu tio Zé e a galinha que fugiu do quintal em Sobradinho';

  it('história que guarda os substantivos e parafraseia o VERBO passa', () => {
    // O risco desta conta é o falso alarme: reprovar a boa escrita, que mostra
    // em vez de dizer. Aqui o "fugiu" do pedido virou "atravessou a cerca" — e
    // isso é exatamente o que uma boa história faz. Os nomes que o usuário deu
    // (galinha, quintal, Sobradinho) continuam todos lá.
    const texto = 'O Zé criava aquela galinha no quintal desde pintinho. Numa '
      + 'tarde de sábado a danada atravessou a cerca e saiu andando pela rua '
      + 'principal de Sobradinho como quem sabe onde vai.';
    expect(C.causoFidelidade(texto, IDEIA).problemas).toEqual([]);
  });

  it('perder a MAIORIA dos nomes é acusado, mesmo guardando um', () => {
    // Guardar "galinha" e jogar fora o quintal e a cidade não é paráfrase: é
    // outra história com um adereço do pedido.
    const texto = 'O Zé correu atrás da galinha a tarde inteira e foi parar no '
      + 'terreiro do vizinho.';
    expect(C.causoFidelidade(texto, IDEIA).problemas).toHaveLength(1);
  });

  it('história sobre OUTRA COISA é acusada', () => {
    const texto = 'A dona Maria vendia bolo na feira de São Paulo e sonhava em '
      + 'abrir uma confeitaria no centro da cidade.';
    const r = C.causoFidelidade(texto, IDEIA);
    expect(r.problemas).toHaveLength(1);
    expect(r.problemas[0]).toMatch(/trocou de assunto/i);
    expect(r.problemas[0]).toMatch(/galinha/);
  });

  it('a acusação NOMEIA o que sumiu — ordem acionável, não conselho vago', () => {
    const r = C.causoFidelidade('uma conversa sobre futebol na praia', IDEIA);
    expect(r.problemas[0]).toMatch(/"galinha"/);
    expect(r.problemas[0]).toMatch(/mostrando esses elementos em cena/);
  });

  it('plural e flexão casam com o singular do pedido', () => {
    const r = C.causoFidelidade('as galinhas fugiram e o Zé pescava', 'Zé e a galinha, pescaria');
    expect(r.problemas).toEqual([]);
  });

  it('ideia vaga demais não inventa defeito', () => {
    // Sem termos concretos não há o que conferir. Acusar aqui seria criar um
    // problema onde o usuário não deu informação nenhuma.
    expect(C.causoFidelidade('qualquer texto', 'uma história boa').conferido).toBe(false);
    expect(C.causoFidelidade('qualquer texto', '').problemas).toEqual([]);
  });
});

describe('fidelidade é dimensão, e não se compensa', () => {
  it.each([['CAUSO_DIMENSOES'], ['DIALOGO_DIMENSOES']])('%s tem fidelidade com o mínimo mais alto', (tabela) => {
    const dims = C[tabela];
    const fid = dims.find((d) => d.id === 'fidelidade');
    expect(fid).toBeTruthy();
    // Talento nas outras dimensões não compensa ter mudado de assunto.
    dims.forEach((d) => expect(fid.minimo).toBeGreaterThanOrEqual(d.minimo));
  });

  it('a conferência do Causos reprova por fidelidade quando a ideia sumiu', () => {
    const r = C.conferirCausoLocal('A dona Maria vendia bolo na feira paulista.', {},
      { ideia: 'meu tio Zé e a galinha que fugiu do quintal' });
    expect(r.achados.some((a) => a.dimensao === 'fidelidade')).toBe(true);
  });

  it('a conferência dos Diálogos usa a MESMA conta — o pedido não muda de natureza', () => {
    const r = C.conferirDialogoLocal('— Bom dia.\n— Bom dia.', {},
      { ideia: 'meu tio Zé e a galinha que fugiu do quintal' });
    expect(r.achados.some((a) => a.dimensao === 'fidelidade')).toBe(true);
  });

  it('sem ideia, nenhuma conferência inventa achado de fidelidade', () => {
    // Garante que a mudança é ADITIVA: quem chamava sem ideia não muda de vida.
    const r = C.conferirCausoLocal('qualquer história', {}, {});
    expect(r.achados.some((a) => a.dimensao === 'fidelidade')).toBe(false);
  });
});

describe('a ideia atravessa a cadeia inteira', () => {
  const IDEIA = 'meu tio Zé e a galinha que fugiu do quintal';

  it('o bloco do pedido diz que é dado, não sugestão', () => {
    const b = C.causoBlocoIdeia(IDEIA);
    expect(b).toMatch(/INVIOLÁVEL/);
    expect(b).toMatch(/Sua liberdade está em COMO contar/);
    expect(b).toContain(IDEIA);
  });

  it.each([
    ['buildContarPrompt', (f, i) => f({ genero: 'engracado' }, { ideia: i })],
    ['buildCriticoPrompt', (f, i) => f('narrativa', 'texto', { genero: 'engracado' }, [], i)],
    ['buildReescreverCausoPrompt', (f, i) => f('texto', [], { genero: 'engracado' }, i)],
    ['buildDialogoContarPrompt', (f, i) => f({ genero: 'boteco' }, { ideia: i })],
    ['buildDialogoCriticoPrompt', (f, i) => f('ouvido', 'texto', {}, [], i)],
    ['buildDialogoReescreverPrompt', (f, i) => f('texto', [], {}, i)],
  ])('%s recebe o pedido do usuário', (nome, chamar) => {
    // Antes, da terceira etapa em diante ninguém mais via o que foi pedido.
    expect(chamar(C[nome], IDEIA)).toContain(IDEIA);
  });

  it('a etapa de conceitos varia o CONTAR, não os fatos', () => {
    const p = C.buildConceitosPrompt(IDEIA, {});
    expect(p).toMatch(/QUATRO maneiras de contar ESSA história/);
    expect(p).toMatch(/O que NÃO varia são os fatos do pedido/);
    expect(p).toMatch(/Trocar o assunto por um mais interessante é o erro mais grave/);
  });
});

describe('a escolha entre os quatro deixa de ser cega ao pedido', () => {
  const infiel = {
    titulo: 'A confeiteira de São Paulo', genero: 'vida', premissa: 'Maria abre uma confeitaria',
    quem: 'Maria', quer: 'vender bolo', virada: 'o forno quebra', absurdo: 'um bolo gigante',
    graca: 'a teimosia', estrutura: 'crescente', porqueFunciona: 'emociona', risco: 'ficar sério',
  };
  const fiel = {
    titulo: 'O Zé e a galinha', genero: 'engracado', premissa: 'A galinha do Zé fugiu do quintal',
    quem: 'tio Zé', quer: 'pegar a galinha', virada: 'a galinha volta sozinha',
    absurdo: 'uma galinha que atravessou a cidade', graca: 'a teimosia do Zé',
    estrutura: 'perseguicao', porqueFunciona: 'todo mundo tem um tio assim', risco: 'ficar sério',
  };

  it('entre um conceito fiel e um mais criativo, ganha o fiel', () => {
    // Era a porta mais silenciosa das quatro: mesmo com a etapa de conceitos
    // corrigida, uma escolha cega poderia premiar justamente o que fugiu.
    const e = C.escolherConceito([infiel, fiel], {}, 'meu tio Zé e a galinha que fugiu do quintal');
    expect(e.escolhido.titulo).toBe('O Zé e a galinha');
  });

  it('sem ideia, a escolha continua exatamente como era', () => {
    const e = C.escolherConceito([infiel, fiel], {});
    expect(e.escolhido).toBeTruthy();
  });
});
