/**
 * cryptoUtils.js
 * Cryptographic helpers for password hashing using Web Crypto API.
 */

export async function sha256(message) {
  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('SubtleCrypto error, falling back to basic hash', e);
    }
  }
  // Simple fallback hash for environments without SubtleCrypto
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
