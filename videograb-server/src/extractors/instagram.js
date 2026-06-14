/**
 * Extrator do Instagram.
 *
 * Porta fiel da lógica do aplicativo Flutter original
 * (litoral_noticia_downloader/lib/main.dart). As cinco estratégias são
 * executadas em cascata, na mesma ordem e com os mesmos cabeçalhos,
 * parâmetros e expressões regulares do app:
 *
 *   1. GraphQL (api/graphql, doc_id 10015901848480474)
 *   2. Endpoint legacy (?__a=1&__d=dis)
 *   3. oEmbed
 *   4. Parsing do HTML da página
 *   5. Página de embed
 */

import { delay, fetchWithTimeout } from '../http.js';

export const id = 'instagram';
export const label = 'Instagram';
export const filePrefix = 'insta';

export function matches(link) {
  return link.includes('instagram.com');
}

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';

const GRAPHQL_URL = 'https://www.instagram.com/api/graphql';
const GRAPHQL_DOC_ID = '10015901848480474';
const GRAPHQL_LSD = 'AVqbxe3J_YA';

function getBaseHeaders() {
  return {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.instagram.com/',
    'Origin': 'https://www.instagram.com',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Connection': 'keep-alive',
  };
}

/** Cabeçalhos usados para baixar o vídeo (os mesmos do app original). */
function getDownloadHeaders() {
  return {
    'User-Agent': USER_AGENT,
    'Accept': 'video/webm,video/mp4,video/*,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.instagram.com/',
    'Origin': 'https://www.instagram.com',
  };
}

/**
 * @param {string} link
 * @param {(status: string) => void} onStatus
 * @returns {Promise<{url: string, headers: Record<string, string>}|null>}
 */
export async function extract(link, onStatus = () => {}) {
  const videoUrl = await extractReelVideoUrl(link, onStatus);
  return videoUrl ? { url: videoUrl, headers: getDownloadHeaders() } : null;
}

async function extractReelVideoUrl(link, onStatus) {
  const shortcodeMatch = /(?:p|reel|reels)\/([A-Za-z0-9_-]+)/.exec(link);
  const shortcode = shortcodeMatch?.[1];
  if (!shortcode) throw new Error('Shortcode inválido no link');

  // --- Estratégia 1: GraphQL -------------------------------------------
  onStatus('Tentando GraphQL...');
  try {
    await delay(800);
    const videoUrl = await tryGraphqlWithShortcode(shortcode, { extraHeaders: true });
    if (videoUrl) {
      onStatus('GraphQL extraiu com sucesso!');
      return videoUrl;
    }
  } catch (e) {
    console.error('GraphQL falhou:', e.message);
  }

  // --- Estratégia 2: endpoint legacy -----------------------------------
  onStatus('Tentando endpoint legacy...');
  try {
    await delay(800);
    const legacyUrl = `https://www.instagram.com/reel/${shortcode}/?__a=1&__d=dis`;
    const legacyResponse = await fetchWithTimeout(legacyUrl, { headers: getBaseHeaders() });

    if (legacyResponse.status === 200) {
      const jsonData = await legacyResponse.json();
      let videoUrl = null;

      if (jsonData?.graphql?.shortcode_media?.video_url) {
        videoUrl = jsonData.graphql.shortcode_media.video_url;
      } else if (Array.isArray(jsonData?.items) && jsonData.items.length > 0) {
        const item = jsonData.items[0];
        if (Array.isArray(item?.video_versions) && item.video_versions.length > 0) {
          videoUrl = item.video_versions[0].url;
        }
      } else if (
        Array.isArray(jsonData?.shortcode_media?.video_versions) &&
        jsonData.shortcode_media.video_versions.length > 0
      ) {
        videoUrl = jsonData.shortcode_media.video_versions[0].url;
      }

      if (videoUrl && videoUrl.includes('.mp4')) {
        onStatus('Legacy extraiu com sucesso!');
        return videoUrl;
      }
    }
  } catch (e) {
    console.error('Legacy falhou:', e.message);
  }

  // --- Estratégia 3: oEmbed ---------------------------------------------
  onStatus('Tentando oEmbed...');
  try {
    await delay(800);
    const oembedUrl = `https://www.instagram.com/oembed/?url=${encodeURIComponent(link)}`;
    const oembedResponse = await fetchWithTimeout(oembedUrl, { headers: getBaseHeaders() });

    if (oembedResponse.status === 200) {
      const oembedData = await oembedResponse.json();
      if (oembedData?.html) {
        const embedShortcodeMatch = /instagram\.com\/reel\/([A-Za-z0-9_-]+)/.exec(oembedData.html);
        if (embedShortcodeMatch?.[1]) {
          const retried = await tryGraphqlWithShortcode(embedShortcodeMatch[1], {
            extraHeaders: false,
            delayMs: 500,
          });
          if (retried) return retried;
        }
      }
    }
  } catch (e) {
    console.error('oEmbed falhou:', e.message);
  }

  // --- Estratégia 4: HTML da página --------------------------------------
  onStatus('Analisando HTML da página...');
  try {
    await delay(800);
    const htmlResponse = await fetchWithTimeout(link, { headers: getBaseHeaders() });

    if (htmlResponse.status === 200) {
      const html = await htmlResponse.text();
      const extractedUrl = extractFromHtml(html);
      if (extractedUrl) return extractedUrl;
    }
  } catch (e) {
    console.error('HTML parsing falhou:', e.message);
  }

  // --- Estratégia 5: página de embed --------------------------------------
  onStatus('Tentando embed...');
  try {
    await delay(800);
    const embedUrl = `https://www.instagram.com/reel/${shortcode}/embed`;
    const embedResponse = await fetchWithTimeout(embedUrl, { headers: getBaseHeaders() });

    if (embedResponse.status === 200) {
      const embedHtml = await embedResponse.text();

      const embedVideoRegex = /<video[^>]*src="([^"]+\.mp4[^"]*)"/i;
      const embedSourceRegex = /<source[^>]*src="([^"]+\.mp4[^"]*)"/i;
      const embedMatch = embedVideoRegex.exec(embedHtml) ?? embedSourceRegex.exec(embedHtml);

      if (embedMatch) {
        const videoUrl = decodeURIComponent(embedMatch[1]);
        if (videoUrl.includes('.mp4')) return videoUrl;
      }

      const embedExtracted = extractFromHtml(embedHtml);
      if (embedExtracted) return embedExtracted;
    }
  } catch (e) {
    console.error('Embed falhou:', e.message);
  }

  return null;
}

async function tryGraphqlWithShortcode(shortcode, { extraHeaders = false, delayMs = 0 } = {}) {
  if (delayMs > 0) await delay(delayMs);

  const headers = extraHeaders
    ? {
        ...getBaseHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-IG-App-ID': '936619743392459',
        'X-FB-LSD': GRAPHQL_LSD,
        'X-ASBD-ID': '129477',
        'Accept': '*/*',
      }
    : {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-IG-App-ID': '936619743392459',
        'X-FB-LSD': GRAPHQL_LSD,
        'X-ASBD-ID': '129477',
      };

  const body =
    `variables=${encodeURIComponent(JSON.stringify({ shortcode }))}` +
    `&doc_id=${GRAPHQL_DOC_ID}&lsd=${GRAPHQL_LSD}`;

  const response = await fetchWithTimeout(GRAPHQL_URL, { method: 'POST', headers, body });
  if (response.status !== 200) return null;

  const jsonData = await response.json();

  let videoUrl =
    jsonData?.data?.xdt_shortcode_media?.video_url ??
    jsonData?.data?.shortcode_media?.video_url ??
    null;

  if (!videoUrl) {
    const media = jsonData?.data?.xdt_shortcode_media ?? jsonData?.data?.shortcode_media;
    if (media && Array.isArray(media.video_versions) && media.video_versions.length > 0) {
      videoUrl = media.video_versions[0].url;
    }
  }

  if (videoUrl && videoUrl.includes('.mp4')) return videoUrl;
  return null;
}

function extractFromHtml(html) {
  try {
    const videoTagRegex = /<video[^>]*src="([^"]+\.mp4[^"]*)"/i;
    const sourceTagRegex = /<source[^>]*src="([^"]+\.mp4[^"]*)"/i;
    const videoMatch = videoTagRegex.exec(html);
    if (videoMatch) return videoMatch[1];
    const sourceMatch = sourceTagRegex.exec(html);
    if (sourceMatch) return sourceMatch[1];

    const scriptRegex =
      /window\._sharedData\s*=\s*({[\s\S]*?});|<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g;

    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
      let jsonStr = match[1] ?? match[2];
      if (!jsonStr) continue;

      try {
        jsonStr = jsonStr.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const data = JSON.parse(jsonStr);
        const foundUrl = findVideoUrlRecursive(data);
        if (foundUrl && foundUrl.includes('.mp4')) return foundUrl;
      } catch {
        // Continua
      }
    }

    const genericRegex = /https?:\/\/[^"'\s<>]*\.mp4[^"'\s<>]*/g;
    let genericMatch;
    while ((genericMatch = genericRegex.exec(html)) !== null) {
      const url = genericMatch[0];
      if (
        (url.includes('cdninstagram') ||
          url.includes('fbcdn') ||
          url.includes('igcdn') ||
          url.includes('cdn.syndication')) &&
        url.length > 50
      ) {
        return url;
      }
    }

    const attrRegex = /(?:video_url|videoUrl)["']?\s*[:=]\s*["']([^"']+\.mp4[^"']*)["']/gi;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(html)) !== null) {
      const url = attrMatch[1];
      if (url && url.startsWith('http')) return url;
    }
  } catch (e) {
    console.error('Extract from HTML error:', e.message);
  }
  return null;
}

function findVideoUrlRecursive(obj) {
  if (obj === null || obj === undefined) return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = findVideoUrlRecursive(item);
      if (result) return result;
    }
    return null;
  }

  if (typeof obj === 'object') {
    if (typeof obj.video_url === 'string' && obj.video_url.includes('.mp4')) {
      return obj.video_url;
    }
    if (typeof obj.videoUrl === 'string' && obj.videoUrl.includes('.mp4')) {
      return obj.videoUrl;
    }
    if (typeof obj.url === 'string' && obj.url.includes('.mp4')) {
      return obj.url;
    }
    if (Array.isArray(obj.video_versions) && obj.video_versions.length > 0) {
      const first = obj.video_versions[0];
      if (first && typeof first === 'object' && 'url' in first) {
        return first.url != null ? String(first.url) : null;
      }
    }

    for (const value of Object.values(obj)) {
      const result = findVideoUrlRecursive(value);
      if (result) return result;
    }
  }

  return null;
}
