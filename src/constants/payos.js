function readPayOSConfig() {
  const custom = window.DHL_CONFIG?.payos || {};
  return {
    clientId: custom.clientId || '',
    apiKey: custom.apiKey || '',
    checksumKey: custom.checksumKey || '',
    apiEndpoint: custom.apiEndpoint || 'https://api-merchant.payos.vn/v2',
  };
}

export const PAYOS_CONFIG = new Proxy({}, {
  get(target, prop) {
    const config = readPayOSConfig();
    return config[prop];
  },
});

/**
 * Calculates PayOS request signature using HMAC SHA-256.
 * PayOS signature string format: sort keys alphabetically, join with & (e.g. amount=100000&cancelUrl=...&description=...&orderCode=123&returnUrl=...)
 */
export async function calculatePayOSSignature(data, checksumKey = PAYOS_CONFIG.checksumKey) {
  const sortedKeys = Object.keys(data).sort();
  const signatureData = sortedKeys
    .map((key) => `${key}=${data[key] ?? ''}`)
    .join('&');

  return hmacSha256(signatureData, checksumKey);
}

/**
 * Internal HMAC SHA-256 implementation using Web Crypto API with standard JS fallback.
 */
async function hmacSha256(message, key) {
  if (window.crypto?.subtle && key) {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(key);
      const msgData = encoder.encode(message);
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const signatureBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, msgData);
      return Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (err) {
      console.warn('[PayOS] Subtle Crypto error, falling back to JS implementation:', err);
    }
  }

  return jsHmacSha256(message, key);
}

/**
 * Pure JS HMAC-SHA256 fallback implementation
 */
function jsHmacSha256(message, keyStr) {
  if (!keyStr) return '';
  const sha256 = (bytes) => {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef4a3f7, 0xc67178f2,
    ];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const l = bytes.length * 8;
    const padding = new Uint8Array(((bytes.length + 9 + 63) & ~63));
    padding.set(bytes);
    padding[bytes.length] = 0x80;
    const view = new DataView(padding.buffer);
    view.setUint32(padding.length - 4, l, false);

    const W = new Uint32Array(64);
    for (let i = 0; i < padding.length; i += 64) {
      for (let t = 0; t < 16; t++) W[t] = view.getUint32(i + t * 4, false);
      for (let t = 16; t < 64; t++) {
        const s0 = (W[t - 15] >>> 7 | W[t - 15] << 25) ^ (W[t - 15] >>> 18 | W[t - 15] << 14) ^ (W[t - 15] >>> 3);
        const s1 = (W[t - 2] >>> 17 | W[t - 2] << 15) ^ (W[t - 2] >>> 19 | W[t - 2] << 13) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
        const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H;
  };

  const enc = new TextEncoder();
  let key = enc.encode(keyStr);
  let msg = enc.encode(message);
  if (key.length > 64) key = new Uint8Array(sha256(key).buffer);
  const kPad = new Uint8Array(64);
  kPad.set(key);

  const oPad = new Uint8Array(64);
  const iPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oPad[i] = kPad[i] ^ 0x5c;
    iPad[i] = kPad[i] ^ 0x36;
  }

  const innerMsg = new Uint8Array(iPad.length + msg.length);
  innerMsg.set(iPad, 0);
  innerMsg.set(msg, iPad.length);
  const innerHash = sha256(innerMsg);

  const innerBytes = new Uint8Array(32);
  const view = new DataView(innerBytes.buffer);
  for (let i = 0; i < 8; i++) view.setUint32(i * 4, innerHash[i], false);

  const outerMsg = new Uint8Array(oPad.length + innerBytes.length);
  outerMsg.set(oPad, 0);
  outerMsg.set(innerBytes, oPad.length);
  const outerHash = sha256(outerMsg);

  return outerHash.map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('');
}
