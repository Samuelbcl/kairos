import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/crypto";

export type ApiContext = {
  workspaceId: string;
  keyId: string;
};

/**
 * Authentifie un appel à /api/v1/* par clé API.
 *
 * La clé n'est jamais stockée en clair : on hache celle reçue et on cherche
 * le hash. Comme les routes API n'ont pas de session utilisateur, elles passent
 * par le client service_role — d'où le filtrage explicite sur workspace_id
 * dans chaque requête, qui remplace la RLS.
 */
export async function authenticateApiKey(
  request: NextRequest,
): Promise<ApiContext | NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const rawKey = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!rawKey) {
    return NextResponse.json(
      {
        error: "Clé API manquante.",
        hint: "Envoie l'en-tête Authorization: Bearer <clé>. Crée une clé dans Réglages → API & webhooks.",
      },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const keyHash = await hashApiKey(rawKey);

  const { data, error } = await admin
    .from("api_keys")
    .select("id, workspace_id")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error: "Clé API invalide ou révoquée.",
        hint: "Vérifie la clé, ou crée-en une nouvelle dans Réglages → API & webhooks.",
      },
      { status: 401 },
    );
  }

  // Trace de dernière utilisation, sans bloquer la réponse.
  void admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { workspaceId: data.workspace_id, keyId: data.id };
}

export function isErrorResponse(
  value: ApiContext | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}

/** Pagination commune : ?limit=50&offset=0, bornée pour éviter les dumps. */
export function readPagination(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
  return { limit, offset };
}
