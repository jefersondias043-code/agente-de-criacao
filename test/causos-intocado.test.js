// CAUSOS — o modo que já funciona não pode mudar UM BYTE
//
// Pedido do usuário, e é a condição de tudo o mais: "não gostaria de modificar
// o funcionamento do modo que já existe… ele já apresenta um resultado
// excelente e deve continuar funcionando exatamente com a qualidade que possui
// hoje."
//
// A qualidade do Causos mora em duas coisas: o TEXTO EXATO dos prompts (é o que
// a IA lê) e as CONTAS da conferência (é o que reprova sem pedir licença). Um
// advérbio a menos na doutrina é mudança de comportamento que nenhum teste de
// estrutura pegaria — e que só apareceria semanas depois, no resultado.
//
// Por isso este arquivo guarda ASSINATURAS (SHA-256) dos prompts e dos juízos
// gerados com entradas fixas. Ele foi escrito ANTES do seletor de modos e as
// assinaturas abaixo foram tiradas do motor de então: é o Causos que o usuário
// aprovou, congelado. Se alguma mudar, a mudança é real — e precisa ser
// decidida de propósito, não descoberta depois pelo resultado.
//
// QUANDO A MUDANÇA FOR INTENCIONAL: `node scripts/causos-assinaturas.mjs` e
// cole a saída aqui. O script e este teste leem as MESMAS entradas de
// test/fixtures/causos-golden.mjs — se cada um tivesse a sua cópia, atualizar
// as assinaturas poderia "consertar" o teste medindo outro texto.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';
import { assinaturasCausos } from './fixtures/causos-golden.mjs';

let atual;
beforeAll(() => {
  clearStorage();
  const M = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js', 'causos-motor.js'],
    ['causoBlocoDoutrina', 'buildConceitosPrompt', 'buildDossiePrompt', 'buildContarPrompt',
      'buildCriticoPrompt', 'buildReescreverCausoPrompt', 'conferirCausoLocal', 'julgarCauso',
      'causoCriticosDe', 'CAUSO_GENEROS', 'CAUSO_DIMENSOES']);
  atual = assinaturasCausos(M);
});

/* AS ASSINATURAS DO CAUSOS.
 *
 * ATUALIZADAS NO r235 e no r236, as duas vezes de propósito.
 *
 * r235: o usuário pediu histórias de vídeo curto (1 a 1min30) e controle
 * rigoroso de repetição. Os prompts dos críticos mudaram porque eles RECEBEM
 * o que a conferência achou, e a conferência ganhou duas contas novas
 * (duração e repetição). A do JUIZ mudou por um defeito que só apareceu
 * medindo de ponta a ponta: com duas contas caindo na mesma dimensão
 * (`ritmo`), o juiz guardava um problema por dimensão e a segunda sumia.
 *
 * r236: testado o r235 de verdade, o relato foi que a ferramenta estava
 * CORTANDO a história no meio para caber no limite, em vez de planejá-la
 * naquele tamanho desde o início. Três coisas mudaram, e só três: o DOSSIÊ
 * passou a resolver o tamanho no plano (poucos beats, terminando no
 * desfecho); o CONTAR ganhou a prioridade explícita — completude antes de
 * tamanho — e a instrução de nunca parar logo depois do clímax; o REESCREVER
 * ganhou o mesmo reforço, porque a trava textual do r235 não bastou sozinha
 * na prática.
 *
 * O que NÃO mudou no r236, e é o que prova que o texto de exemplo
 * (`test/fixtures/causos-golden.mjs`) já terminava bem: a CONFERÊNCIA
 * (`conferirCausoLocal`) ganhou uma conta nova — `causoTerminaAbrupto`,
 * dimensão `final` — mas ela não achou problema nenhum no texto fixo, então
 * `conferencia` e `juizo` (que depende dela) ficaram bit a bit iguais. Os
 * críticos não mudaram de prompt. A doutrina, os conceitos, a convocação de
 * críticos e a tabela de dimensões continuam intocados desde sempre. */
const ESPERADO = {
  doutrina: '54f6da77197421d5',
  conceitos: '2673fcc4f1a9c88c',
  dossie: 'b1edb46d8469a6f1',
  contar: '51f0fc765d8acc55',
  criticoNarrativa: '66d8463a8398cb8d',
  criticoExagero: 'e8452e418db98411',
  reescrever: 'c9b3b2ff8ad194be',
  conferencia: 'de6b819abab40bc6',
  juizo: 'e074334f9e0cf4a0',
  criticos: 'pescador:narrativa+oralidade+originalidade+humor+exagero | assombracao:narrativa+oralidade+originalidade+humor+misterio | engracado:narrativa+oralidade+originalidade+humor | lenda:narrativa+oralidade+originalidade+humor+misterio | vida:narrativa+oralidade+originalidade+humor',
  dimensoes: 'oralidade=7,originalidade=7,coerencia=7,personagens=7,causalidade=7,exagero=6,ritmo=6,humor=7,absurdo=7,misterio=6,final=7,brasilidade=7,autenticidade=8',
};

describe('o texto que a IA lê no modo Causos', () => {
  const casos = [
    ['a doutrina', 'doutrina'],
    ['o prompt de conceitos', 'conceitos'],
    ['o prompt do dossiê', 'dossie'],
    ['o prompt de contar', 'contar'],
    ['o prompt do crítico de narrativa', 'criticoNarrativa'],
    ['o prompt do crítico de exagero', 'criticoExagero'],
    ['o prompt de reescrita', 'reescrever'],
  ];
  for (const [nome, chave] of casos) {
    it(`${nome} não mudou`, () => {
      expect(atual[chave], `${nome} mudou — rode scripts/causos-assinaturas.mjs se foi de propósito`)
        .toBe(ESPERADO[chave]);
    });
  }
});

describe('as contas do modo Causos', () => {
  it('a conferência medida acha exatamente o que achava', () => {
    expect(atual.conferencia).toBe(ESPERADO.conferencia);
  });

  it('o juiz decide igual', () => {
    expect(atual.juizo).toBe(ESPERADO.juizo);
  });

  it('a mesa convoca os mesmos críticos para cada gênero', () => {
    expect(atual.criticos).toBe(ESPERADO.criticos);
  });

  it('as dimensões e os mínimos não mudaram', () => {
    expect(atual.dimensoes).toBe(ESPERADO.dimensoes);
  });
});

describe('a rede de proteção está viva', () => {
  it('as assinaturas foram mesmo calculadas — nenhuma é vazia', () => {
    // Sem isto, um `assinaturasCausos` que devolvesse {} deixaria tudo acima
    // comparando undefined com undefined e passando.
    for (const [k, v] of Object.entries(ESPERADO)) {
      expect(atual[k], `assinatura ausente: ${k}`).toBeTruthy();
      expect(String(atual[k]).length, `assinatura vazia: ${k}`).toBeGreaterThan(8);
      expect(typeof v).toBe('string');
    }
  });
});
