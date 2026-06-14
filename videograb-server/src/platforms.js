/**
 * Registro de plataformas suportadas.
 *
 * Cada extrator implementa a mesma interface:
 *   - id, label, filePrefix
 *   - matches(link): boolean
 *   - extract(link, onStatus): Promise<{url, headers}|null>
 *
 * Para adicionar uma nova plataforma, crie um módulo em src/extractors/
 * com essa interface e registre-o aqui.
 */

import * as instagram from './extractors/instagram.js';
import * as tiktok from './extractors/tiktok.js';
import * as youtube from './extractors/youtube.js';

export const PLATFORMS = [instagram, tiktok, youtube];

export function detectPlatform(link) {
  return PLATFORMS.find((platform) => platform.matches(link)) ?? null;
}

export const SUPPORTED_LABEL = PLATFORMS.map((p) => p.label).join(', ').replace(/, ([^,]*)$/, ' ou $1');
