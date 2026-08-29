import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { ensureFreshToken, pullCalendarChanges } from "@/lib/integrations/calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sens retour de la synchronisation agenda : reporte dans Kairos les
 * déplacements faits directement dans l'agenda.
 *
 * Ne crée ni ne supprime rien — uniquement l'heure des événements que Kairos
 * a lui-même posés. C'est ce qui évite les doublons et les boucles.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: integrations, error } = await admin
    .from("integrations")
    .select("*")
    .limit(200);

  if (error) {
    console.error("[cron/pull-calendar] lecture impossible", error.message);
    return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  }

  let updated = 0;
  let checked = 0;

  for (const integration of integrations ?? []) {
    const fresh = await ensureFreshToken(admin, integration);
    const result = await pullCalendarChanges(admin, fresh.workspace_id, fresh);
    updated += result.updated;
    checked += result.checked;
  }

  const report = { integrations: integrations?.length ?? 0, checked, updated };
  console.log("[cron/pull-calendar]", report);
  return NextResponse.json({ ok: true, ...report });
}
