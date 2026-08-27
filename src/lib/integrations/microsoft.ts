import "server-only";

import { env } from "@/lib/env";

const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";

export const MICROSOFT_SCOPES = [
  "https://graph.microsoft.com/Calendars.ReadWrite",
  "offline_access",
  "openid",
  "email",
];

export function microsoftRedirectUri() {
  return `${env.appUrl}/api/integrations/microsoft/callback`;
}

export function microsoftConfigured() {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

function credentials() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET manquants. Enregistre une " +
        "application dans Entra ID, puis ajoute-les dans .env.local.",
    );
  }
  return { clientId, clientSecret };
}

export function microsoftAuthUrl(state: string) {
  const { clientId } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: microsoftRedirectUri(),
    response_mode: "query",
    scope: MICROSOFT_SCOPES.join(" "),
    state,
  });
  return `${AUTHORITY}/authorize?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...body,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: microsoftRedirectUri(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Microsoft a refusé la requête de jeton (HTTP ${response.status}).`);
  }
  return response.json();
}

export function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code" });
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.email ?? decoded.preferred_username ?? null;
  } catch {
    return null;
  }
}
