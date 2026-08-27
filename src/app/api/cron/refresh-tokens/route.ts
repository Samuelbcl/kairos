import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { ensureFreshToken } from "@/lib/integrations/calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rafraîchit les jetons OAuth qui expirent bientôt (toutes les 6 h).
 *
 * Sans ça, un utilisateur qui ne se connecte pas pendant quelques heures verrait
 * ses relances cesser d'atterrir dans son agenda, sans message d'erreur.
 * Aucun jeton n'est jamais écrit dans les logs.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();
  const horizon = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

  const { data: integrations, error } = await admin
    .from("integrations")
    .select("*")
    .lte("expires_at", horizon)
    .not("refresh_token_enc", "is", null)
    .limit(500);

  if (error) {
    console.error("[cron/refresh-tokens] lecture impossible", error.message);
    return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  }

  let refreshed = 0;
  let failed = 0;

  for (const integration of integrations ?? []) {
    const result = await ensureFreshToken(admin, integration);
    // ensureFreshToken renvoie l'intégration inchangée quand le refresh échoue.
    if (result.expires_at !== integration.expires_at) refreshed += 1;
    else failed += 1;
  }

  const report = { checked: integrations?.length ?? 0, refreshed, failed };
  console.log("[cron/refresh-tokens]", report);
  return NextResponse.json({ ok: true, ...report });
}
