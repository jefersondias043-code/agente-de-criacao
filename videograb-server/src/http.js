/** Utilitários HTTP compartilhados pelos extratores. */

export const REQUEST_TIMEOUT_MS = 20000;

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    redirect: 'follow',
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
  });
}

/* ---------------------------------------------------------------------------
 * VALIDAÇÃO DE URL — proteção contra SSRF.
 *
 * O link da PÁGINA vem do cliente e é buscado pelo servidor. Validar por
 * substring (link.includes('tiktok.com')) deixava passar coisas como
 * "http://169.254.169.254/?tiktok.com" → o servidor buscaria um host interno
 * (metadados de nuvem, serviços da rede). Aqui exigimos http(s), host público
 * (nunca loopback/privado/link-local) e host pertencente ao domínio da
 * plataforma (comparação por HOSTNAME, não substring).
 * ------------------------------------------------------------------------- */

/** O hostname pertence a um dos domínios? (host exato OU subdomínio). */
export function hostMatches(hostname, domains) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return domains.some((d) => h === d || h.endsWith('.' + d));
}

/** Host é interno/privado (loopback, RFC1918, link-local, CGNAT, IPv6 ULA…)? */
export function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;            // link-local (metadados de nuvem)
    if (a === 172 && b >= 16 && b <= 31) return true;   // RFC1918
    if (a === 192 && b === 168) return true;            // RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT
    if (a >= 224) return true;                          // multicast/reservado
    return false;
  }
  if (host === '::1' || host === '::') return true;
  if (/^(fc|fd)/i.test(host)) return true;              // IPv6 unique-local
  if (/^fe[89ab]/i.test(host)) return true;             // IPv6 link-local
  if (/^::ffff:/i.test(host)) return isPrivateHost(host.replace(/^::ffff:/i, '')); // IPv4-mapped
  return false;
}

/** Parse SEGURO do link do cliente: exige http(s), host público e pertencente
 *  aos domínios da plataforma. Devolve a URL ou null (bloqueia SSRF). */
export function parsePlatformUrl(link, domains) {
  let u;
  try { u = new URL(String(link || '').trim()); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (isPrivateHost(u.hostname)) return null;
  if (!hostMatches(u.hostname, domains)) return null;
  return u;
}
