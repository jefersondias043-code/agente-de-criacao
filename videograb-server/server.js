/**
 * VideoGrab — servidor Web.
 *
 * O aplicativo original fazia requisições HTTP diretas às plataformas, o que
 * não é possível a partir do navegador (CORS). Este servidor executa a mesma
 * lógica de extração no backend e faz proxy do download do vídeo.
 *
 * Plataformas suportadas: Instagram, TikTok e YouTube (src/platforms.js).
 *
 * Fluxo: /api/extract (SSE) detecta a plataforma, roda a cascata de
 * estratégias e devolve um ticket de download; /api/download?id=<ticket>
 * transmite o vídeo com os cabeçalhos definidos pelo extrator. Como a URL
 * do vídeo nunca vem do cliente, não há superfície para SSRF.
 */

import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { detectPlatform, SUPPORTED_LABEL } from './src/platforms.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Raiz do app (a pasta acima de videograb-server/). Este mesmo servidor serve a
// plataforma INTEIRA — assim um único processo local roda o app E a API do
// VideoGrab, e o card de status já abre conectado (mesma origem). Continua
// funcionando também via file:// (a API permite CORS '*').
const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

app.disable('x-powered-by');

// O frontend vive embutido na plataforma (videograb.html), em outra origem —
// inclusive file://, onde o Origin chega como "null". GET simples não exige
// preflight; Content-Disposition precisa ser exposto para o nome do arquivo.
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  next();
});

// O frontend embutido pinga ao abrir para mostrar se o servidor está de pé.
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Tickets de download: id efêmero -> { url, headers, prefix }
// ---------------------------------------------------------------------------

const TICKET_TTL_MS = 10 * 60 * 1000;
const tickets = new Map();

function createTicket(info) {
  const ticketId = crypto.randomUUID();
  tickets.set(ticketId, { ...info, expiresAt: Date.now() + TICKET_TTL_MS });
  return ticketId;
}

function consumeTicket(ticketId) {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;
  if (Date.now() > ticket.expiresAt) {
    tickets.delete(ticketId);
    return null;
  }
  return ticket;
}

setInterval(() => {
  const now = Date.now();
  for (const [ticketId, ticket] of tickets) {
    if (now > ticket.expiresAt) tickets.delete(ticketId);
  }
}, 60 * 1000).unref();

// ---------------------------------------------------------------------------
// GET /api/extract?url=<link>
//
// Server-Sent Events. Emite `status` a cada etapa da extração, depois
// `result` com { downloadId, platform } ou `fail` com a mensagem de erro.
// ---------------------------------------------------------------------------

app.get('/api/extract', async (req, res) => {
  const link = String(req.query.url || '').trim();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let clientGone = false;
  req.on('close', () => {
    clientGone = true;
  });

  const platform = detectPlatform(link);
  if (!platform) {
    send('fail', { message: `Por favor, cole um link válido do ${SUPPORTED_LABEL}` });
    res.end();
    return;
  }

  try {
    const extracted = await platform.extract(link, (status) => {
      if (!clientGone) send('status', { status });
    });

    if (clientGone) {
      res.end();
      return;
    }

    if (extracted) {
      const downloadId = createTicket({
        url: extracted.url,
        headers: extracted.headers ?? {},
        prefix: platform.filePrefix,
      });
      send('result', { downloadId, platform: platform.id });
    } else {
      send('fail', { message: 'Não encontrou URL do vídeo. Tente outro link público.' });
    }
  } catch (e) {
    if (!clientGone) send('fail', { message: `Erro ao extrair: ${e.message}` });
  }

  res.end();
});

// ---------------------------------------------------------------------------
// GET /api/download?id=<ticket>
//
// Transmite o vídeo com os cabeçalhos do extrator, repassando Content-Length
// para o progresso no navegador. Nome do arquivo no mesmo formato do app
// original: <prefixo>_yyyy-MM-dd_HHmmss.mp4
// ---------------------------------------------------------------------------

app.get('/api/download', async (req, res) => {
  const ticket = consumeTicket(String(req.query.id || ''));

  if (!ticket) {
    res.status(410).json({ error: 'Download expirado. Extraia o link novamente.' });
    return;
  }

  try {
    const upstream = await fetch(ticket.url, {
      headers: ticket.headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });

    if (upstream.status !== 200 && upstream.status !== 206) {
      res.status(502).json({ error: `HTTP ${upstream.status}` });
      return;
    }

    const fileName = `${ticket.prefix}_${formatTimestamp(new Date())}.mp4`;
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    const body = Readable.fromWeb(upstream.body);
    body.on('error', () => res.destroy());
    res.on('close', () => body.destroy());
    body.pipe(res);
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({ error: e.message });
    } else {
      res.destroy();
    }
  }
});

// Mesmo formato do app original: DateFormat('yyyy-MM-dd_HHmmss')
function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

// Servir a plataforma INTEIRA (depois das rotas /api). GET / → index.html, e os
// módulos/estilos/HTMLs das ferramentas. Um único processo serve app + API.
app.use(express.static(APP_ROOT));

app.listen(PORT, () => {
  console.log(`Agente + VideoGrab rodando em http://localhost:${PORT}`);
});
