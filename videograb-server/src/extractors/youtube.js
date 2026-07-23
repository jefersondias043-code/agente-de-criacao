/**
 * Extrator do YouTube.
 *
 * Usa a biblioteca youtubei.js (API InnerTube mantida ativamente — o YouTube
 * exige tokens de atestação que invalidam chamadas manuais simples) com uma
 * cascata de clientes, na mesma filosofia de múltiplas estratégias do app
 * original:
 *
 *   1. Android   — formatos progressivos com URL direta (mais confiável)
 *   2. iOS       — cobre vídeos que bloqueiam o cliente Android
 *   3. Web embed — cobre vídeos restritos a player embarcado
 *   4. TV        — último recurso
 *
 * Apenas formatos progressivos (áudio+vídeo no mesmo .mp4) são usados, para
 * que o arquivo baixado seja reproduzível diretamente, como nas demais
 * plataformas. Suporta youtube.com/watch, youtu.be, Shorts, embed e live.
 */

import { Innertube, Log } from 'youtubei.js';
import { delay, parsePlatformUrl } from '../http.js';

export const id = 'youtube';
export const label = 'YouTube';
export const filePrefix = 'youtube';

export const YOUTUBE_DOMAINS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'];

export function matches(link) {
  return !!parsePlatformUrl(link, YOUTUBE_DOMAINS);
}

// Silencia avisos do parser interno (mudanças cosméticas da API do YouTube).
Log.setLevel(Log.Level.ERROR);

const CLIENT_CASCADE = [
  {
    name: 'Android',
    client: 'ANDROID',
    userAgent: 'com.google.android.youtube/19.44.38 (Linux; U; Android 14; pt_BR) gzip',
  },
  {
    name: 'iOS',
    client: 'IOS',
    userAgent: 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)',
  },
  {
    name: 'Web embed',
    client: 'WEB_EMBEDDED',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  },
  {
    name: 'TV',
    client: 'TV',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  },
];

// A sessão InnerTube é cara de criar (baixa o player JS); cria uma vez e
// reaproveita. Em caso de falha, a próxima extração tenta recriar.
let innertubePromise = null;

function getInnertube() {
  innertubePromise ??= Innertube.create({ retrieve_player: true }).catch((e) => {
    innertubePromise = null;
    throw e;
  });
  return innertubePromise;
}

/**
 * @param {string} link
 * @param {(status: string) => void} onStatus
 * @returns {Promise<{url: string, headers: Record<string, string>}|null>}
 */
export async function extract(link, onStatus = () => {}) {
  const videoId = extractVideoId(link);
  if (!videoId) throw new Error('ID de vídeo inválido no link');

  const yt = await getInnertube();

  for (const { name, client, userAgent } of CLIENT_CASCADE) {
    onStatus(`Consultando API do YouTube (${name})...`);
    try {
      await delay(800);

      const info = await yt.getBasicInfo(videoId, { client });

      const playability = info.playability_status?.status;
      if (playability !== 'OK') {
        console.error(`YouTube ${name}: playability=${playability}`, info.playability_status?.reason ?? '');
        continue;
      }

      const muxed = (info.streaming_data?.formats ?? [])
        .filter((f) => f.has_video && f.has_audio)
        .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

      for (const format of muxed) {
        const url = resolveFormatUrl(format, yt);
        if (url) {
          onStatus(`Extraído via cliente ${name}!`);
          return {
            url,
            headers: {
              'User-Agent': userAgent,
              'Accept': 'video/webm,video/mp4,video/*,*/*;q=0.8',
            },
          };
        }
      }
    } catch (e) {
      console.error(`Cliente ${name} falhou:`, e.message);
    }
  }

  return null;
}

function resolveFormatUrl(format, yt) {
  if (typeof format.url === 'string' && format.url.startsWith('http')) {
    return format.url;
  }
  try {
    const deciphered = format.decipher(yt.session.player);
    if (typeof deciphered === 'string' && deciphered.startsWith('http')) {
      return deciphered;
    }
  } catch (e) {
    console.error('Decipher falhou:', e.message);
  }
  return null;
}

function extractVideoId(link) {
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(link);
    if (match) return match[1];
  }
  return null;
}
