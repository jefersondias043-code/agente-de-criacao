'use strict';
/* ============================================================
   CRIPTO COMPARTILHADA — AES-GCM + PBKDF2 (fonte única da plataforma)
   Padroniza a proteção de segredos (chaves de API) em todas as ferramentas.
   Formato do payload é IDÊNTICO ao que o Detector Flop já grava em
   'df_groq_key_enc' — JSON {s,i,c} (salt, iv, ciphertext) em base64 — para
   compatibilidade total. Sem dependências externas (WebCrypto nativo);
   funciona em file:// e em servidor.

   Verdade honesta sobre cripto client-side: num dispositivo que o atacante
   controla, nada fica 100% protegido. A senha protege DOIS vetores reais:
   (1) o BACKUP exportado vazando; (2) inspeção casual do localStorage. A chave
   derivada da senha NUNCA é persistida — só vive em memória durante a sessão.
   ============================================================ */

const CRYPTO_PBKDF2_ITERATIONS = 150000;   // mesmo custo do Detector

/** WebCrypto disponível? (ambientes muito antigos / contextos inseguros não têm). */
function cryptoAvailable() {
  return !!(typeof crypto !== 'undefined' && crypto.subtle && crypto.getRandomValues);
}

/** Deriva uma chave AES-GCM 256 a partir de senha + salt (PBKDF2 SHA-256). */
async function cryptoDeriveKey(password, salt) {
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: CRYPTO_PBKDF2_ITERATIONS, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Cifra `plaintext` com `password`. Retorna JSON string {s,i,c} (base64). */
async function cryptoEncryptString(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await cryptoDeriveKey(password, salt);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return JSON.stringify({
    s: btoa(String.fromCharCode(...salt)),
    i: btoa(String.fromCharCode(...iv)),
    c: btoa(String.fromCharCode(...new Uint8Array(ct))),
  });
}

/** Decifra um payload de cryptoEncryptString. Lança se a senha estiver errada. */
async function cryptoDecryptString(payload, password) {
  const { s, i, c } = JSON.parse(payload);
  const salt = Uint8Array.from(atob(s), (x) => x.charCodeAt(0));
  const iv = Uint8Array.from(atob(i), (x) => x.charCodeAt(0));
  const ct = Uint8Array.from(atob(c), (x) => x.charCodeAt(0));
  const key = await cryptoDeriveKey(password, salt);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}
