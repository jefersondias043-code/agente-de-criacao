// Padronização de microcopy (one-shot). Substitui strings EXATAS visíveis ao
// usuário por versões alinhadas ao padrão de voz da plataforma. Não altera lógica:
// só troca o TEXTO dentro de literais. Conta cada substituição para verificação.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = [
  'index.html', 'src/core.js', 'src/generate.js', 'src/extract.js', 'src/posters.js',
  'src/downloads.js', 'src/history.js', 'src/settings.js', 'src/handoff.js',
];

// Substituições GLOBAIS (string exata, aplicadas a todos os alvos; no-op onde ausente).
const GLOBAL = [
  // --- Toasts: sucesso (curto, ponto final, sem "!"/"com sucesso") ---
  ["'Matéria gerada com sucesso!'", "'Matéria gerada.'"],
  ["'Cartaz criado!'", "'Cartaz criado.'"],
  ["'Cartaz salvo!'", "'Cartaz salvo.'"],
  ["'Cartaz exportado!'", "'Cartaz exportado.'"],
  ["'Extração concluída!'", "'Extração concluída.'"],
  ["'Imagem adicionada!'", "'Imagem adicionada.'"],
  ["'Logo adicionada!'", "'Logo adicionada.'"],
  ["'Dados do portal salvos!'", "'Dados do portal salvos.'"],
  ["'Copiado!'", "'Texto copiado.'"],
  ["'Texto copiado!'", "'Texto copiado.'"],
  ["'Atualizado!'", "'Matéria atualizada.'"],
  ["'Removido.'", "'Cartaz removido.'"],
  ["' agora é o ativo!'", "' definido como ativo.'"],
  // --- Toasts: chave de API / modelo ---
  ["'API Key salva!'", "'Chave de API salva.'"],
  ["'API Key removida.'", "'Chave de API removida.'"],
  ["'API Key muito curta.'", "'A chave de API é muito curta.'"],
  // --- Toasts: validação/erro (claros, sem culpar o usuário) ---
  ["'Adicione algum conteúdo (texto ou extração).'", "'Adicione algum conteúdo — texto ou uma extração.'"],
  ["'Apenas imagens.'", "'Apenas imagens são aceitas.'"],
  ["'Imagem muito grande (máx 10 MB).'", "'A imagem é muito grande (máximo 10 MB).'"],
  ["'Máx 5 MB.'", "'A imagem é muito grande (máximo 5 MB).'"],
  ["'Erro ao exportar: '", "'Não foi possível exportar: '"],
  ["'Erro ao ler imagem: '", "'Não foi possível ler a imagem: '"],
  ["'Erro: '", "'Não foi possível adicionar a logo: '"],
  ["'Erro ao salvar (localStorage cheio?)'", "'Não foi possível salvar — o armazenamento do navegador pode estar cheio.'"],
  ["'Gerando imagem em alta resolução…'", "'Gerando o cartaz em alta resolução…'"],
  ["'Texto recebido — ajuste e gere.'", "'Texto recebido. É só ajustar e gerar.'"],
  // --- Loading da geração: menos jargão ---
  ["'Lead, contexto e desfecho.'", "'Título, lead e desenvolvimento.'"],
  ["'Microintervenções interpretativas.'", "'Ajustando o tom palavra a palavra.'"],
  ["'Revisando coerência final.'", "'Revisão final de coerência.'"],
  ["'Refinando linguagem…'", "'Refinando a linguagem…'"],
  // --- Placeholders (index.html) ---
  ['placeholder="Cole aqui as informações da matéria…"', 'placeholder="Cole aqui o texto da pauta…"'],
  ['placeholder="Cole o link do vídeo aqui (Instagram, TikTok, YouTube, etc.)"', 'placeholder="Cole o link do vídeo (Instagram, TikTok, YouTube…)"'],
  ['placeholder="Política, Esporte..."', 'placeholder="Ex.: Política, Esporte…"'],
  ['placeholder="Resumo curto, ~1 linha"', 'placeholder="Resumo em uma linha"'],
  ['placeholder="Ex: pauta da semana"', 'placeholder="Ex.: pauta da semana"'],
  // --- Helpers / textos de apoio (index.html) ---
  ['JPG/PNG, máx 10 MB.', 'JPG ou PNG, até 10 MB.'],
  ['Selecione uma extração da página "Extrair texto" para incluir no contexto.', 'Use um texto já extraído como contexto na geração.'],
  // --- Aviso de chave (index.html) ---
  ['<strong>Configure sua API Key</strong>', '<strong>Configure sua chave de API</strong>'],
  ['Antes de gerar, adicione sua chave do Groq nas Configurações.', 'Antes de gerar, adicione sua chave da Groq nas Configurações.'],
  // --- Settings: terminologia "API Key" -> "chave de API" ---
  ['API Key ${providerNames[provider]} configurada', 'Chave de API da ${providerNames[provider]} configurada'],
  ['Nenhuma API Key da ${providerNames[provider]} configurada.', 'Nenhuma chave de API da ${providerNames[provider]} configurada.'],
  ['<label class="label">API Key ${providerNames[provider]}</label>', '<label class="label">Chave de API · ${providerNames[provider]}</label>'],
  ['Remover a API Key da ${providerNames[provider]}?', 'Remover a chave de API da ${providerNames[provider]}?'],
  ['Pegue sua key em ${providerLinks[provider]}. Salva localmente no navegador.', 'Obtenha sua chave em ${providerLinks[provider]}. Fica salva apenas neste navegador.'],
];

// Substituições POR ARQUIVO (string ambígua entre módulos: 'Removida.').
const PER_FILE = {
  'src/extract.js': [["'Removida.'", "'Extração removida.'"]],
  'src/history.js': [["'Removida.'", "'Matéria removida.'"]],
};

let total = 0;
const misses = [];
for (const rel of TARGETS) {
  const p = path.join(root, rel);
  let txt = fs.readFileSync(p, 'utf8');
  const apply = (pairs, trackMiss) => {
    for (const [oldS, newS] of pairs) {
      const n = txt.split(oldS).length - 1;
      if (n > 0) { txt = txt.split(oldS).join(newS); total += n; }
      else if (trackMiss) misses.push(rel + '  ::  ' + oldS);
    }
  };
  apply(GLOBAL, false);
  if (PER_FILE[rel]) apply(PER_FILE[rel], true);
  fs.writeFileSync(p, txt);
}
console.log('Substituições aplicadas:', total);
if (misses.length) console.log('Per-file não encontrados:\n' + misses.join('\n'));
