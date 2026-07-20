'use strict';
/* ============================================================
   ANÁLISE DE POTENCIAL — opcional, sob demanda.
   Avalia o potencial de desempenho do conteúdo em 6 dimensões,
   com pontos fortes/fracos e sugestões. O resultado é salvo no
   item do histórico (persiste). 100% fora do fluxo principal.
   ============================================================ */

const ANALISE_DIMENSOES = [
  { id: 'gancho',           nome: 'Gancho' },
  { id: 'retencao',         nome: 'Retenção' },
  { id: 'clareza',          nome: 'Clareza da mensagem' },
  { id: 'interesse',        nome: 'Nível de interesse' },
  { id: 'compartilhamento', nome: 'Compartilhamento' },
  { id: 'engajamento',      nome: 'Engajamento' }
];

async function analisarConteudo(transcricao) {
  const texto = String(transcricao || '').trim();
  if (texto.length < 20) throw new Error('Conteúdo curto demais para analisar.');

  const sistema = 'Você é um analista sênior de conteúdo para redes sociais no Brasil. A partir da transcrição/texto de um conteúdo, avalie de forma realista e útil o POTENCIAL de desempenho dele. Baseie-se SOMENTE no que está no texto — não invente fatos. Seja específico e direto. Responda APENAS com JSON válido, sem markdown.';

  const usuario = `Analise o conteúdo abaixo e devolva EXATAMENTE este JSON:
{
  "nota_geral": <inteiro 0-100, probabilidade de bom desempenho>,
  "classificacao": "ALTO" | "MÉDIO" | "BAIXO",
  "veredito": "<frase curta de 6 a 12 palavras resumindo o potencial>",
  "dimensoes": [
    { "id": "gancho", "score": <0-10>, "comentario": "<1 frase>" },
    { "id": "retencao", "score": <0-10>, "comentario": "<1 frase>" },
    { "id": "clareza", "score": <0-10>, "comentario": "<1 frase>" },
    { "id": "interesse", "score": <0-10>, "comentario": "<1 frase>" },
    { "id": "compartilhamento", "score": <0-10>, "comentario": "<1 frase>" },
    { "id": "engajamento", "score": <0-10>, "comentario": "<1 frase>" }
  ],
  "pontos_fortes": ["<frase>", "..."],
  "pontos_fracos": ["<frase>", "..."],
  "sugestoes": ["<sugestão prática>", "..."]
}
Use exatamente esses 6 id de dimensão. Cada lista deve ter de 2 a 4 itens curtos e acionáveis.

CONTEÚDO:
"""
${texto}
"""`;

  const json = await callLLM(sistema, usuario, true, 1400);
  return normalizarAnalise(json);
}

function normalizarAnalise(json) {
  json = json || {};
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
  const nota = clamp(json.nota_geral, 0, 100);
  let clas = String(json.classificacao || '').toUpperCase();
  if (clas === 'MEDIO') clas = 'MÉDIO';
  if (!['ALTO', 'MÉDIO', 'BAIXO'].includes(clas)) clas = nota >= 70 ? 'ALTO' : nota >= 45 ? 'MÉDIO' : 'BAIXO';
  const dimIn = Array.isArray(json.dimensoes) ? json.dimensoes : [];
  const dimensoes = ANALISE_DIMENSOES.map(def => {
    const achou = dimIn.find(d => d && String(d.id) === def.id) || {};
    return { id: def.id, nome: def.nome, score: clamp(achou.score, 0, 10), comentario: String(achou.comentario || '').trim() };
  });
  const lista = (v) => (Array.isArray(v) ? v.map(s => String(s || '').trim()).filter(Boolean).slice(0, 4) : []);
  return {
    nota_geral: nota,
    classificacao: clas,
    veredito: String(json.veredito || '').trim(),
    dimensoes: dimensoes,
    pontos_fortes: lista(json.pontos_fortes),
    pontos_fracos: lista(json.pontos_fracos),
    sugestoes: lista(json.sugestoes)
  };
}
