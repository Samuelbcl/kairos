import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { retryDelivery, MAX_ATTEMPTS } from "@/lib/webhooks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Retente les livraisons de webhook en échec dont l'heure est venue.
 *
 * Le délai grandit à chaque essai (1 min, 5, 30, 2 h, 12 h) : une URL
 * momentanément indisponible se rattrape, une URL définitivement morte ne
 * consomme pas indéfiniment des appels.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: due, error } = await admin
    .from("webhook_deliveries")
    .select("id")
    .eq("status", "failed")
    .lt("attempts", MAX_ATTEMPTS)
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at")
    .limit(100);

  if (error) {
    console.error("[cron/retry-webhooks] lecture impossible", error.message);
    return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  }

  let recovered = 0;
  let stillFailing = 0;

  for (const delivery of due ?? []) {
    const ok = await retryDelivery(admin, delivery.id);
    if (ok) recovered += 1;
    else stillFailing += 1;
  }

  const report = { attempted: due?.length ?? 0, recovered, stillFailing };
  console.log("[cron/retry-webhooks]", report);
  return NextResponse.json({ ok: true, ...report });
}
