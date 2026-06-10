// Testes das funções puras. Como os módulos agora são scripts clássicos
// (escopo global, p/ funcionar via file://), carregamos o código por eval
// indireto e capturamos as funções num objeto, sem depender de export ESM.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (f) => fs.readFileSync(path.join(srcDir, f), 'utf8');

let A;
beforeAll(() => {
  const code = ['catalogs.js', 'core.js', 'llm.js', 'downloads.js'].map(read).join('\n;\n')
    + '\n;globalThis.__APP__ = { escapeHtml, truncate, formatBytes, uuid, buildPrompt, cleanText, MAX_CONTENT_CHARS, detectPlatform, extractYoutubeId };';
  (0, eval)(code); // eval indireto => escopo global (jsdom); localStorage via test/setup.js
  A = globalThis.__APP__;
});

describe('core utils', () => {
  it('escapeHtml escapa caracteres especiais', () => {
    expect(A.escapeHtml('<b>"a"&\'x\'</b>')).toBe('&lt;b&gt;&quot;a&quot;&amp;&#39;x&#39;&lt;/b&gt;');
    expect(A.escapeHtml(null)).toBe('');
  });
  it('truncate corta com reticências', () => {
    expect(A.truncate('hello world', 5)).toBe('hell…');
    expect(A.truncate('hi', 5)).toBe('hi');
  });
  it('formatBytes formata B/KB/MB', () => {
    expect(A.formatBytes(null)).toBe('—');
    expect(A.formatBytes(500)).toBe('500 B');
    expect(A.formatBytes(1024)).toBe('1.0 KB');
    expect(A.formatBytes(1024 * 1024)).toBe('1.0 MB');
  });
  it('uuid gera UUID v4 válido', () => {
    expect(A.uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(A.uuid()).not.toBe(A.uuid());
  });
});

describe('llm prompt', () => {
  it('cleanText remove markdown e colapsa linhas', () => {
    expect(A.cleanText('**negrito**')).toBe('negrito');
    expect(A.cleanText('# Título')).toBe('Título');
    expect(A.cleanText('a\n\n\n\nb')).toBe('a\n\nb');
  });
  it('buildPrompt injeta estilo, tom e conteúdo', () => {
    const r = A.buildPrompt('Jornalístico', 'Formal', 'Prefeitura entregou cestas.');
    expect(r.prompt).toContain('Estilo: Jornalístico');
    expect(r.prompt).toContain('TOM "Formal"');
    expect(r.prompt).toContain('Prefeitura entregou cestas.');
    expect(r.prompt).toContain('VOZ: Tom técnico');
    expect(r.wasTruncated).toBe(false);
  });
  it('buildPrompt trunca conteúdo acima do limite', () => {
    const big = 'x'.repeat(A.MAX_CONTENT_CHARS + 500);
    const r = A.buildPrompt('Jornalístico', 'Neutro', big);
    expect(r.wasTruncated).toBe(true);
    expect(r.finalCharCount).toBe(A.MAX_CONTENT_CHARS);
  });
});

describe('downloads detection', () => {
  it('detectPlatform reconhece plataformas', () => {
    expect(A.detectPlatform('https://www.tiktok.com/@x/video/123')?.id).toBe('tiktok');
    expect(A.detectPlatform('https://www.instagram.com/reel/abc/')?.id).toBe('instagram');
    expect(A.detectPlatform('https://exemplo.com/video')).toBeNull();
  });
  it('extractYoutubeId extrai o id de 11 chars', () => {
    expect(A.extractYoutubeId('https://youtu.be/abcdefghijk')).toBe('abcdefghijk');
    expect(A.extractYoutubeId('https://www.youtube.com/watch?v=ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
  });
});
