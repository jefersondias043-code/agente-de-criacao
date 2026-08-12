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

/* AS ASSINATURAS DO CAUSOS APROVADO (r211–r226), tiradas do motor de antes do
 * seletor de modos. */
const ESPERADO = {
  doutrina: '54f6da77197421d5',
  conceitos: '2673fcc4f1a9c88c',
  dossie: '89417112e3618b9b',
  contar: '5bc23b15774356d8',
  criticoNarrativa: '68ac017051d027ae',
  criticoExagero: '59652b92e16b1fb0',
  reescrever: 'a761c508b0181ea5',
  conferencia: '9b554c015267a076',
  juizo: '9ae6d0aeea312884',
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
