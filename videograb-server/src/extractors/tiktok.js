/**
 * Extrator do TikTok.
 *
 * Segue a mesma filosofia de cascata do extrator do Instagram:
 *
 *   1. API TikWM em HD  — vídeo sem marca d'água (promessa do app)
 *   2. API TikWM padrão — vídeo sem marca d'água em qualidade normal
 *   3. HTML da página   — __UNIVERSAL_DATA_FOR_REHYDRATION__ / SIGI_STATE
 *                         (playAddr nativo; usa os cookies da própria página)
 *
 * Links curtos (vm.tiktok.com, vt.tiktok.com, tiktok.com/t/) são resolvidos
 * para a URL canônica antes da extração.
 */

import { delay, fetchWithTimeout } from '../http.js';

export const id = 'tiktok';
export const label = 'TikTok';
export const filePrefix = 'tiktok';

export function matches(link) {
  return link.includes('tiktok.com');
}

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const TIKWM_API = 'https://www.tikwm.com/api/';

/**
 * @param {string} link
 * @param {(status: string) => void} onStatus
 * @returns {Promise<{url: string, headers: Record<string, string>}|null>}
 */
export async function extract(link, onStatus = () => {}) {
  const canonicalLink = await resolveCanonicalLink(link, onStatus);

  // --- Estratégia 1: TikWM HD (sem marca d'água) -------------------------
  onStatus("Tentando API sem marca d'água (HD)...");
  try {
    await delay(800);
    const videoUrl = await tryTikwm(canonicalLink, { hd: true });
    if (videoUrl) {
      onStatus('Extraído sem marca d\'água!');
      return { url: videoUrl, headers: tikwmDownloadHeaders() };
    }
  } catch (e) {
    console.error('TikWM HD falhou:', e.message);
  }

  // --- Estratégia 2: TikWM padrão (sem marca d'água) ----------------------
  onStatus("Tentando API sem marca d'água...");
  try {
    await delay(800);
    const videoUrl = await tryTikwm(canonicalLink, { hd: false });
    if (videoUrl) {
      onStatus('Extraído sem marca d\'água!');
      return { url: videoUrl, headers: tikwmDownloadHeaders() };
    }
  } catch (e) {
    console.error('TikWM falhou:', e.message);
  }

  // --- Estratégia 3: HTML da página ----------------------------------------
  onStatus('Analisando HTML da página...');
  try {
    await delay(800);
    const result = await tryPageHtml(canonicalLink);
    if (result) return result;
  } catch (e) {
    console.error('HTML do TikTok falhou:', e.message);
  }

  return null;
}

async function resolveCanonicalLink(link, onStatus) {
  const isShortLink =
    /(?:vm|vt)\.tiktok\.com\//.test(link) || /tiktok\.com\/t\//.test(link);
  if (!isShortLink) return link;

  onStatus('Resolvendo link curto...');
  try {
    const response = await fetchWithTimeout(link, {
      headers: { 'User-Agent': DESKTOP_UA, 'Accept': 'text/html' },
    });
    if (response.url && response.url.includes('tiktok.com')) {
      return response.url;
    }
  } catch (e) {
    console.error('Resolução de link curto falhou:', e.message);
  }
  return link;
}

function tikwmDownloadHeaders() {
  return {
    'User-Agent': DESKTOP_UA,
    'Accept': 'video/webm,video/mp4,video/*,*/*;q=0.8',
    'Referer': 'https://www.tikwm.com/',
  };
}

async function tryTikwm(link, { hd }) {
  const apiUrl = `${TIKWM_API}?url=${encodeURIComponent(link)}${hd ? '&hd=1' : ''}`;
  const response = await fetchWithTimeout(apiUrl, {
    headers: {
      'User-Agent': DESKTOP_UA,
      'Accept': 'application/json',
    },
  });

  if (response.status !== 200) return null;

  const json = await response.json();
  if (json?.code !== 0 || !json?.data) return null;

  const candidate = hd
    ? json.data.hdplay || json.data.play
    : json.data.play || json.data.hdplay;
  if (!candidate || typeof candidate !== 'string') return null;

  // A API às vezes retorna caminhos relativos hospedados no próprio TikWM.
  return candidate.startsWith('http') ? candidate : `https://www.tikwm.com${candidate}`;
}

async function tryPageHtml(link) {
  const response = await fetchWithTimeout(link, {
    headers: {
      'User-Agent': DESKTOP_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  if (response.status !== 200) return null;

  const html = await response.text();
  const cookies = collectCookies(response);

  const videoUrl =
    extractFromUniversalData(html) ?? extractFromSigiState(html) ?? null;
  if (!videoUrl) return null;

  return {
    url: videoUrl,
    headers: {
      'User-Agent': DESKTOP_UA,
      'Accept': 'video/webm,video/mp4,video/*,*/*;q=0.8',
      'Referer': 'https://www.tiktok.com/',
      ...(cookies ? { Cookie: cookies } : {}),
    },
  };
}

function collectCookies(response) {
  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];
  return setCookies
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function extractFromUniversalData(html) {
  const match =
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    const itemStruct =
      data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
    const video = itemStruct?.video;
    return pickPlayableUrl(video);
  } catch (e) {
    console.error('UNIVERSAL_DATA inválido:', e.message);
    return null;
  }
}

function extractFromSigiState(html) {
  const match = /<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    const itemModule = data?.ItemModule;
    if (!itemModule || typeof itemModule !== 'object') return null;
    for (const item of Object.values(itemModule)) {
      const url = pickPlayableUrl(item?.video);
      if (url) return url;
    }
    return null;
  } catch (e) {
    console.error('SIGI_STATE inválido:', e.message);
    return null;
  }
}

function pickPlayableUrl(video) {
  if (!video || typeof video !== 'object') return null;
  const candidates = [
    video.downloadAddr,
    video.playAddr,
    ...(Array.isArray(video.bitrateInfo)
      ? video.bitrateInfo.flatMap((b) => b?.PlayAddr?.UrlList ?? [])
      : []),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.startsWith('http')) {
      return candidate;
    }
  }
  return null;
}
