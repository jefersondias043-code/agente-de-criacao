// Entradas fixas e assinaturas do modo CAUSOS — compartilhadas entre o teste
// (test/causos-intocado.test.js) e o gerador (scripts/causos-assinaturas.mjs),
// para que os dois meçam exatamente a mesma coisa. Se cada um tivesse a sua
// cópia das entradas, atualizar as assinaturas poderia "consertar" o teste
// medindo outro texto.
import { createHash } from 'node:crypto';

export const sha = (s) => createHash('sha256').update(String(s), 'utf8').digest('hex').slice(0, 16);

export const IDEIA = 'um vizinho que jurava ter pescado um peixe do tamanho de um bezerro';

export const MEMORIA = {
  estruturas: ['a espera que não acaba', 'o mentiroso desmascarado'],
  nomes: ['Seu Juvenal', 'Dona Cida'],
  aberturas: ['Foi num sábado de manhã', 'Meu tio contava que'],
};

export const CONCEITO = {
  titulo: 'O peixe que entortou o motor',
  genero: 'pescador',
  premissa: 'Um homem volta da pescaria com uma história que cresce a cada vizinho que pergunta.',
  quem: 'Seu Nicolau, pescador aposentado',
  quer: 'que alguém acredite nele',
  virada: 'o compadre aparece com uma foto',
  absurdo: 'um peixe que não coube na canoa e entortou o motor',
  graca: 'a teimosia de quem não volta atrás',
  estrutura: 'a mentira que cresce a cada vizinho',
  porqueFunciona: 'todo mundo conhece um assim',
  risco: 'ficar séria demais',
};

export const DOSSIE = {
  genero: 'pescador',
  conceito: CONCEITO,
  voz: { quem: 'o filho de Seu Nicolau, hoje adulto', comoFala: 'devagar, com pausa antes da mentira' },
  personagens: [{ nome: 'Seu Nicolau', quem: 'pescador aposentado' }],
  mundo: { lugar: 'uma vila de beira de rio' },
  plano: ['a volta da pescaria', 'a história cresce', 'o compadre aparece'],
};

export const TEXTO = `Meu pai voltou daquela pescaria com o motor entortado e a cara mais séria do mundo.
Disse que o peixe tinha puxado a canoa por meia hora rio abaixo antes de arrebentar a linha.
No começo era do tamanho de um cachorro. No fim da semana já não cabia na canoa.
Ninguém nunca viu o peixe, mas o motor entortado ficou lá no quintal até ele morrer.`;

export const ORDENS = [
  { dimensao: 'exagero', ordem: 'o absurdo chega pronto na primeira frase; faça crescer', problema: 'já chega grande', nota: 4 },
  { dimensao: 'humor', ordem: 'ninguém sorri em nenhum momento', problema: 'sóbria demais', nota: 5 },
];

export const CRITICAS = [
  { critico: 'narrativa', notas: [{ dimensao: 'coerencia', nota: 9, problema: '', correcao: '' },
    { dimensao: 'final', nota: 6, problema: 'o fim chega rápido', correcao: 'demore mais uma frase' }], resumo: 'boa' },
  { critico: 'oralidade', notas: [{ dimensao: 'oralidade', nota: 8, problema: '', correcao: '' }], resumo: 'ok' },
  { critico: 'humor', notas: [{ dimensao: 'humor', nota: 5, problema: 'não faz rir', correcao: 'use a teimosia' }], resumo: 'sóbria' },
];

/**
 * Calcula todas as assinaturas do modo Causos a partir dos símbolos do motor.
 * @param {Record<string, any>} M símbolos capturados de src/causos-motor.js
 */
export function assinaturasCausos(M) {
  const local = M.conferirCausoLocal(TEXTO, DOSSIE, { memoria: MEMORIA, genero: 'pescador' });
  return {
    doutrina: sha(M.causoBlocoDoutrina()),
    conceitos: sha(M.buildConceitosPrompt(IDEIA, MEMORIA)),
    dossie: sha(M.buildDossiePrompt(CONCEITO, IDEIA, MEMORIA)),
    contar: sha(M.buildContarPrompt(DOSSIE, { tamanho: 'medio' })),
    criticoNarrativa: sha(M.buildCriticoPrompt('narrativa', TEXTO, DOSSIE, local.achados)),
    criticoExagero: sha(M.buildCriticoPrompt('exagero', TEXTO, DOSSIE, local.achados)),
    reescrever: sha(M.buildReescreverCausoPrompt(TEXTO, ORDENS, DOSSIE)),
    conferencia: sha(JSON.stringify(local.achados)),
    juizo: sha(JSON.stringify(M.julgarCauso(CRITICAS, local.achados))),
    criticos: M.CAUSO_GENEROS.map((g) => `${g.id}:${M.causoCriticosDe(g.id).join('+')}`).join(' | '),
    dimensoes: M.CAUSO_DIMENSOES.map((d) => `${d.id}=${d.minimo}`).join(','),
  };
}
