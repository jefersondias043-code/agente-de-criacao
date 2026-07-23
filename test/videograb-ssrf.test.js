// Regressão de SEGURANÇA (SSRF) do VideoGrab.
// O link da página vem do cliente e é buscado pelo servidor. Antes a validação
// era por substring (link.includes('tiktok.com')) — deixava passar URLs para
// hosts internos (ex.: metadados de nuvem 169.254.169.254). Agora validamos por
// hostname + bloqueio de IPs privados. Estas funções são puras e testáveis.
import { describe, it, expect } from 'vitest';
import { parsePlatformUrl, isPrivateHost, hostMatches } from '../videograb-server/src/http.js';

const IG = ['instagram.com', 'instagr.am'];
const TT = ['tiktok.com'];
const YT = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'];

describe('parsePlatformUrl — URLs legítimas passam', () => {
  it.each([
    ['https://www.instagram.com/reel/abc/', IG],
    ['https://instagram.com/p/xyz', IG],
    ['https://vm.tiktok.com/ZM123/', TT],
    ['https://www.tiktok.com/@u/video/123', TT],
    ['https://youtu.be/abc123', YT],
    ['https://m.youtube.com/watch?v=abc', YT],
  ])('aceita %s', (link, doms) => {
    expect(parsePlatformUrl(link, doms)).not.toBeNull();
  });
});

describe('parsePlatformUrl — ataques SSRF são bloqueados', () => {
  it.each([
    ['http://169.254.169.254/latest/meta-data/?instagram.com', IG], // metadados de nuvem
    ['http://169.254.169.254/#tiktok.com', TT],
    ['http://localhost:3000/?youtube.com', YT],
    ['http://127.0.0.1/tiktok.com', TT],
    ['http://10.0.0.5/?instagram.com', IG],
    ['http://172.16.5.5/?tiktok.com', TT],
    ['http://192.168.1.1/?tiktok.com', TT],
    ['http://100.64.1.1/?tiktok.com', TT],           // CGNAT
    ['http://[::1]/?youtube.com', YT],
    ['http://instagram.com.attacker.com/x', IG],     // sufixo enganoso
    ['https://evil.com/instagram.com', IG],          // domínio no path
    ['file:///etc/passwd?tiktok.com', TT],           // protocolo não-http
    ['javascript:alert(1)//tiktok.com', TT],
    ['', TT],
    ['não é url', TT],
  ])('bloqueia %s', (link, doms) => {
    expect(parsePlatformUrl(link, doms)).toBeNull();
  });
});

describe('isPrivateHost', () => {
  it('identifica hosts internos/privados', () => {
    for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1',
                     '169.254.169.254', '100.64.0.1', '::1', '0.0.0.0']) {
      expect(isPrivateHost(h)).toBe(true);
    }
  });
  it('não marca hosts públicos', () => {
    for (const h of ['8.8.8.8', '1.1.1.1', 'instagram.com', 'youtu.be', '172.15.0.1', '172.32.0.1']) {
      expect(isPrivateHost(h)).toBe(false);
    }
  });
});

describe('hostMatches', () => {
  it('exige host exato ou subdomínio (não substring)', () => {
    expect(hostMatches('www.tiktok.com', TT)).toBe(true);
    expect(hostMatches('tiktok.com', TT)).toBe(true);
    expect(hostMatches('tiktok.com.evil.com', TT)).toBe(false);
    expect(hostMatches('eviltiktok.com', TT)).toBe(false);
  });
});
