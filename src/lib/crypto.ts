import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Chiffrement AES-256-GCM des jetons OAuth stockés en base.
 * Format : base64( iv[12] || tag[16] || ciphertext ).
 *
 * La clé vient de TOKEN_ENCRYPTION_KEY (32 octets en base64) :
 *   openssl rand -base64 32
 */
function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY manquante. Génère-la avec `openssl rand -base64 32` " +
        "et ajoute-la dans .env.local puis dans les variables Vercel.",
    );
  }
  const buffer = Buffer.from(raw, "base64");
  if (buffer.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY doit faire 32 octets une fois décodée (actuellement ${buffer.length}).`,
    );
  }
  return buffer;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decrypt(payload: string): string {
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Signature HMAC des webhooks sortants. */
export async function hmacSignature(secret: string, body: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/** Hachage d'une clé API. On ne stocke jamais la clé en clair. */
export async function hashApiKey(rawKey: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(rawKey).digest("hex");
}

/** Génère une clé API : préfixe lisible + secret. */
export function generateApiKey(): { key: string; prefix: string } {
  const secret = randomBytes(24).toString("base64url");
  const key = `kai_${secret}`;
  return { key, prefix: key.slice(0, 8) };
}
