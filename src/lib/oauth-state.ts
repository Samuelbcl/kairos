import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * `state` OAuth signé : protège le flux contre le CSRF.
 * Format : base64url(payload).signature — la signature couvre le payload.
 *
 * La clé de signature réutilise TOKEN_ENCRYPTION_KEY : c'est déjà un secret
 * serveur de 32 octets, inutile d'en gérer un de plus.
 */

type StatePayload = {
  workspaceId: string;
  userId: string;
  /** Millisecondes epoch — un state périmé est refusé. */
  issuedAt: number;
  redirectTo?: string;
};

const MAX_AGE_MS = 10 * 60 * 1000;

function signingKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY manquante : impossible de signer le state OAuth.",
    );
  }
  return Buffer.from(raw, "base64");
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function encodeState(payload: Omit<StatePayload, "issuedAt">): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, issuedAt: Date.now() } satisfies StatePayload),
    "utf8",
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeState(state: string | null): StatePayload | null {
  if (!state) return null;

  const [body, signature] = state.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as StatePayload;

    if (Date.now() - payload.issuedAt > MAX_AGE_MS) return null;
    if (!payload.workspaceId || !payload.userId) return null;

    return payload;
  } catch {
    return null;
  }
}
