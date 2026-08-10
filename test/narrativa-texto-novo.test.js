// TEXTO NOVO TEM DE SIGNIFICAR HISTÓRIA NOVA
//
// Defeito relatado: colar uma ideia nova na Narrativa e ver o conteúdo gerado
// continuar falando da ideia anterior.
//
// A causa foi uma regra certa que virou errada. `narrAplicarSugestao` nunca
// sobrescrevia uma resposta já preenchida — proteção correta enquanto as três
// respostas eram campos VISÍVEIS, escritos à mão. Quando a tela foi reduzida a
// um campo só, as respostas passaram a viver escondidas em `#n-interno`: a
// mesma regra passou a proteger resposta de OUTRA história, que o usuário não
// via nem tinha como apagar.
//
// Medido em navegador, com a IA dublada, duas ideias sem nenhuma relação
// (padaria → faculdade). O prompt de escrita da SEGUNDA:
//
//   antes  cita a primeira (padaria, penhorado, elenco da primeira)
//   depois cita só a segunda
//
// O contrário também é regra, e é o que impede a correção de virar outro
// defeito: ideia INALTERADA preserva tudo. Clicar de novo, ou responder à
// pergunta focada, não pode jogar fora o que já estava respondido.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');
const js = ler('src/narrativa.js');

let N;
beforeAll(() => {
  clearStorage();
  N = loadModules(['catalogs.js', 'core.js', 'poster-templates.js', 'narrativa.js', 'narrativa-motor.js'],
    ['State', 'narrativaVazia', 'narrativaDraft', 'narrIdeiaMudou', 'narrDescartarDerivados',
      'narrRestaurarDraft', 'narrAplicarSugestao', 'narrColetar', 'buildRoteiroPrompt', 'narrFormato', 'narrTom',
      'renderNarrResultado', 'narrLimparResultado', 'narrEsquecerResultadoDeOutraHistoria']);
});

/* Os campos da história vivem fora da vista desde a simplificação — é
 * justamente por isso que ficar com valor velho não denunciava nada. */
const montarTela = () => {
  document.body.innerHTML = `
    <textarea id="n-ideia"></textarea>
    <div id="n-pergunta-foco"></div>
    <div id="n-result-badge"></div><div id="n-result-area"></div>
    <div id="n-interno" hidden>
      <input id="n-protagonista" /><textarea id="n-desejo"></textarea>
      <textarea id="n-obstaculo"></textarea><textarea id="n-risco"></textarea>
      <div id="n-elenco-list"></div>
    </div>`;
};

/* Põe na tela o conteúdo de uma história já gerada, como depois de um clique. */
const mostrarConteudo = (texto) => {
  N.renderNarrResultado({ conteudo: texto, formato: 'Reels', tom: 'Direto', model: 'x' });
};

const historiaPronta = () => {
  const d = N.narrativaDraft();
  Object.assign(d, {
    ideia: 'Seu João quer reabrir a padaria do pai, fechada na pandemia.',
    ideiaOrigem: 'Seu João quer reabrir a padaria do pai, fechada na pandemia.',
    protagonista: 'Seu João',
    desejo: 'reabrir a padaria do pai',
    obstaculo: 'o imóvel foi penhorado',
    risco: 'as economias da aposentadoria',
    elenco: [{ id: 'a', nome: 'Dona Alzira', papel: 'antagonista', quer: 'vender o ponto' }],
  });
  return d;
};

beforeEach(() => {
  clearStorage();
  N.State.narrativaDraft = null;
  montarTela();
  // A tela começa sem conteúdo gerado — e o módulo tem de começar sabendo
  // disso, senão um teste herda o "tem conteúdo à vista" do anterior.
  N.narrLimparResultado();
});

describe('a história derivada pertence a uma ideia', () => {
  it('o rascunho guarda de qual ideia as respostas saíram', () => {
    // Sem esta marca não existe pergunta a fazer: nada distingue "resposta
    // desta ideia" de "sobra da anterior".
    expect(N.narrativaVazia()).toHaveProperty('ideiaOrigem', '');
  });

  it('ideia trocada é ideia trocada', () => {
    expect(N.narrIdeiaMudou({ ideia: 'história nova', ideiaOrigem: 'história velha' })).toBe(true);
  });

  it('mesmo texto não conta como troca, nem com espaço, caixa ou acento diferente', () => {
    // O usuário clica de novo, o campo é reescrito por `narrPreencher`, o texto
    // volta do rascunho. Nada disso é ideia nova.
    const igual = (a, b) => N.narrIdeiaMudou({ ideia: a, ideiaOrigem: b }) === false;
    expect(igual('Uma ideia', 'Uma ideia')).toBe(true);
    expect(igual('  Uma   ideia  ', 'Uma ideia')).toBe(true);
    expect(igual('UMA IDEIA', 'uma ideia')).toBe(true);
    expect(igual('Uma idéia', 'Uma ideia')).toBe(true);
  });

  it('rascunho sem marca conta como troca — é o caso de quem já estava com o defeito', () => {
    // Quem abrir o app com um rascunho gravado pela versão com defeito tem
    // exatamente a mistura reclamada guardada. A primeira leitura desfaz.
    expect(N.narrIdeiaMudou({ ideia: 'qualquer coisa', ideiaOrigem: '' })).toBe(true);
  });
});

describe('trocar a ideia descarta a história anterior', () => {
  it('limpa as respostas no rascunho E nos campos escondidos', () => {
    const d = historiaPronta();
    ['protagonista', 'desejo', 'obstaculo', 'risco'].forEach((c) => { document.querySelector('#n-' + c).value = d[c]; });

    N.narrDescartarDerivados(d);

    ['protagonista', 'desejo', 'obstaculo', 'risco'].forEach((c) => {
      expect(d[c], 'rascunho: ' + c).toBe('');
      // O campo escondido também: `narrColetar` lê da TELA, e um campo esquecido
      // devolveria a resposta velha ao rascunho no clique seguinte.
      expect(document.querySelector('#n-' + c).value, 'campo: ' + c).toBe('');
    });
  });

  it('o elenco da história anterior vai junto', () => {
    // Personagem da história velha em cena na história nova é a forma mais
    // visível do defeito: nome próprio que o usuário nunca escreveu.
    const d = historiaPronta();
    N.narrDescartarDerivados(d);
    expect(d.elenco).toEqual([]);
  });

  it('o elenco da história anterior some junto dos campos', () => {
    // (A pergunta focada, que também era limpa aqui, deixou de existir: quem
    // deduz o que falta agora é a IA, não o usuário.)
    const d = historiaPronta();
    N.narrDescartarDerivados(d);
    expect(d.elenco).toEqual([]);
    expect(document.querySelector('#n-desejo').value).toBe('');
  });

  it('a ideia em si não é apagada — é o que o usuário acabou de escrever', () => {
    const d = historiaPronta();
    d.ideia = 'Dona Lúcia voltou a estudar aos 60 anos.';
    N.narrDescartarDerivados(d);
    expect(d.ideia).toBe('Dona Lúcia voltou a estudar aos 60 anos.');
  });
});

describe('a leitura nova entra por cima, não por baixo', () => {
  it('com `forcar`, a sugestão substitui resposta já preenchida', () => {
    // Este é o pedaço que faltava: sem `forcar`, a leitura da ideia NOVA era
    // descartada em silêncio porque os campos "já estavam preenchidos".
    const d = historiaPronta();
    N.narrAplicarSugestao({ desejo: 'terminar a faculdade aos 60 anos' }, { forcar: true });
    expect(d.desejo).toBe('terminar a faculdade aos 60 anos');
  });

  it('sem `forcar`, o que já estava respondido é preservado', () => {
    // Continua valendo quando a ideia é a mesma: reextrair por cima apagaria a
    // resposta que o usuário acabou de dar na pergunta focada.
    const d = historiaPronta();
    N.narrAplicarSugestao({ desejo: 'outra coisa qualquer' });
    expect(d.desejo).toBe('reabrir a padaria do pai');
  });
});

describe('o clique amarra as duas pontas', () => {
  it('ideia nova: descarta antes de ler, e força a leitura por cima', () => {
    expect(js).toMatch(/const ideiaNova = narrIdeiaMudou\(d\);/);
    expect(js).toMatch(/if \(ideiaNova\) narrDescartarDerivados\(d\);/);
    expect(js).toMatch(/\{ forcar: ideiaNova \}/);
  });

  it('a leitura do material roda em TODO clique', () => {
    // Antes, a leitura só acontecia quando a ideia era nova ou o diagnóstico
    // reclamava — e com as respostas velhas no lugar o diagnóstico dizia
    // "pronto", então o material novo nunca era lido. Agora a leitura é a
    // primeira etapa do motor: acontece sempre, e a marca de origem é o que
    // decide se o que ela responde entra por cima ou preserva o que havia.
    expect(js).not.toMatch(/if \(\(ideiaNova \|\| !diag\.pronto\)/);
    expect(js).toMatch(/await runNarrativaPipeline\(/);
    expect(js).toMatch(/const aposLeitura = \(plano\)/);
  });

  it('e marca a origem depois de ler — senão descartaria de novo a cada clique', () => {
    expect(js).toMatch(/atual\.ideiaOrigem = atual\.ideia;/);
  });
});

describe('o conteúdo na tela pertence à ideia que o gerou', () => {
  // Visto em navegador durante a conferência: com a ideia nova já escrita, o
  // cartão logo abaixo ainda exibia o texto da história anterior, com o selo
  // "PRONTO". A geração já estava certa; a tela é que dizia o contrário.
  it('trocar a ideia tira da tela o conteúdo da história anterior', () => {
    const d = historiaPronta();
    mostrarConteudo('A PADARIA DE SEU JOÃO');
    expect(document.querySelector('#n-result-area').textContent).toContain('PADARIA');

    document.querySelector('#n-ideia').value = 'Dona Lúcia voltou a estudar aos 60 anos.';
    N.narrEsquecerResultadoDeOutraHistoria();

    expect(document.querySelector('#n-result-area').textContent).not.toContain('PADARIA');
    expect(document.querySelector('#n-result-area').textContent).toContain('Aguardando');
    expect(document.querySelector('#n-result-badge').innerHTML, 'o selo "Pronto" some junto').toBe('');
    expect(d.ideia).toBeTruthy();
  });

  it('a mesma ideia mantém o conteúdo na tela', () => {
    // Digitar e apagar uma vírgula não pode fazer o texto gerado desaparecer.
    historiaPronta();
    mostrarConteudo('A PADARIA DE SEU JOÃO');
    document.querySelector('#n-ideia').value = N.narrativaDraft().ideiaOrigem;
    N.narrEsquecerResultadoDeOutraHistoria();
    expect(document.querySelector('#n-result-area').textContent).toContain('PADARIA');
  });

  it('sem nada na tela, não há o que retirar', () => {
    historiaPronta();
    document.querySelector('#n-result-area').innerHTML = '<b>marca</b>';
    document.querySelector('#n-ideia').value = 'outra ideia completamente diferente';
    N.narrEsquecerResultadoDeOutraHistoria();
    expect(document.querySelector('#n-result-area').innerHTML).toBe('<b>marca</b>');
  });

  it('está ligado ao campo — inclusive ao × e ao arquivo anexado, que também disparam `input`', () => {
    expect(js).toMatch(/\$\('#n-ideia'\)\.addEventListener\('input', narrEsquecerResultadoDeOutraHistoria\)/);
  });

  it('o estado de espera não fala mais das três perguntas', () => {
    // A tela não tem mais perguntas para responder — mandar respondê-las era
    // instrução para uma versão que não existe.
    expect(js).not.toContain('Responda às três perguntas');
  });
});

describe('o que não pode quebrar junto', () => {
  it('reabrir do histórico marca a origem: aquelas respostas SÃO daquela ideia', () => {
    // Sem isto, reabrir uma história salva e clicar em criar jogaria fora as
    // respostas guardadas — o oposto de guardar a história inteira.
    const d = N.narrRestaurarDraft({
      narrativa: { ideia: 'a ideia salva', desejo: 'o desejo salvo' },
    });
    expect(d.ideiaOrigem).toBe('a ideia salva');
    expect(N.narrIdeiaMudou(d)).toBe(false);
  });

  it('vale também para história salva por versão antiga, sem o campo', () => {
    // Medido em navegador: sem esta marca, uma história antiga com resposta
    // escrita à mão ("reabrir a padaria e ensinar o ofício ao neto") voltava
    // para a leitura automática da IA no primeiro clique.
    const antiga = { narrativa: { ideia: 'ideia de 2024', desejo: 'escrito à mão' } };
    expect(antiga.narrativa).not.toHaveProperty('ideiaOrigem');
    expect(N.narrIdeiaMudou(N.narrRestaurarDraft(antiga))).toBe(false);
  });

  it('a história salva no histórico leva a marca junto', () => {
    // O item do histórico é uma cópia do rascunho; se a marca ficasse de fora,
    // toda reabertura cairia no caso "sem marca".
    expect(js).toMatch(/narrativa: Object\.assign\(\{\}, d\)/);
  });

  it('material vindo de outra ferramenta também troca a história', () => {
    // O handoff preservava as respostas e mandava usar "Limpar" — botão que a
    // tela de um campo só não tem mais. Preservar ali era o mesmo vazamento.
    expect(js).toMatch(/if \(trocou\) \{\s*\n\s*narrDescartarDerivados\(d\);/);
    expect(js).not.toContain('use "Limpar" se for outra história');
  });

  it('o prompt de escrita continua sendo montado da história, e só dela', () => {
    const p = N.buildRoteiroPrompt(
      { protagonista: 'Dona Lúcia', desejo: 'terminar a faculdade aos 60 anos',
        obstaculo: 'a bolsa foi cortada', risco: 'o respeito da família' },
      { formato: N.narrFormato('reels'), tom: N.narrTom('direto') });
    expect(p).toContain('terminar a faculdade aos 60 anos');
    expect(p).not.toContain('padaria');
  });
});
