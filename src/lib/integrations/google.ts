import "server-only";

import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Principe du moindre privilège : uniquement les événements d'agenda. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  // `gmail.compose` cree et modifie des brouillons, rien d'autre : il ne permet
  // ni de lire la boite de reception, ni d'envoyer. Le publipostage depose donc
  // des brouillons que l'utilisateur relit et envoie lui-meme depuis Gmail.
  "https://www.googleapis.com/auth/gmail.compose",
  "openid",
  "email",
];

export function googleRedirectUri() {
  return `${env.appUrl}/api/integrations/google/callback`;
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants. Crée un ID client OAuth " +
        "dans Google Cloud Console, puis ajoute-les dans .env.local.",
    );
  }
  return { clientId, clientSecret };
}

export function googleAuthUrl(state: string) {
  const { clientId } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
};

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    // On ne logge jamais le corps : il contient les jetons.
    throw new Error(`Échange du code Google refusé (HTTP ${response.status}).`);
  }
  return response.json();
}

export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Rafraîchissement du jeton Google refusé (HTTP ${response.status}).`);
  }
  return response.json() as Promise<Omit<TokenResponse, "refresh_token">>;
}

/** Adresse du compte connecté, extraite de l'id_token (pas d'appel réseau). */
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof decoded.email === "string" ? decoded.email : null;
  } catch {
    return null;
  }
}

export { encrypt, decrypt };

/**
 * Crée un brouillon dans Gmail. Ne l'envoie pas.
 *
 * C'est délibéré : un publipostage relu avant départ vaut mieux qu'un envoi
 * automatique. L'utilisateur garde la main, et les messages partent de sa
 * propre adresse, avec sa signature Gmail.
 */
export async function createGmailDraft(
  accessToken: string,
  { to, subject, body }: { to: string; subject: string; body: string },
): Promise<string> {
  // Un objet non-ASCII doit être encodé, sinon Gmail affiche des caractères
  // cassés : c'est ce que prévoit la RFC 2047.
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;

  const mime = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body, "utf8").toString("base64"),
  ].join("\r\n");

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: { raw: Buffer.from(mime, "utf8").toString("base64url") },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    // Le message de Google est explicite sur la cause : on le remonte tel quel
    // plutôt que de le remplacer par « une erreur est survenue ».
    throw new Error(
      response.status === 403
        ? "Gmail a refusé l'accès. Reconnecte ton compte Google : l'autorisation d'écrire des brouillons est récente."
        : `Gmail a répondu ${response.status}. ${detail.slice(0, 200)}`,
    );
  }

  const created = (await response.json()) as { id: string };
  return created.id;
}
