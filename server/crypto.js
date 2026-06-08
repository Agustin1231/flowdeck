import crypto from 'node:crypto';

// ── Password hashing (scrypt, no external deps) ───────────────────────────────
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// ── Symmetric encryption for stored n8n API keys (AES-256-GCM) ────────────────
// The key is derived from an app secret. This prevents plaintext keys sitting in
// db.json; it is obfuscation-at-rest, not protection against someone who already
// holds both the data file and the secret.
function deriveKey(secret) {
  return crypto.scryptSync(String(secret), 'flowdeck-enc-v1', 32);
}

export function encryptSecret(plaintext, secret) {
  if (plaintext == null) return null;
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptSecret(payload, secret) {
  if (!payload) return null;
  try {
    const [version, ivB64, tagB64, dataB64] = String(payload).split('.');
    if (version !== 'v1') return null;
    const key = deriveKey(secret);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}

export function randomId() {
  return crypto.randomBytes(12).toString('hex');
}

export function randomSecret() {
  return crypto.randomBytes(32).toString('hex');
}
