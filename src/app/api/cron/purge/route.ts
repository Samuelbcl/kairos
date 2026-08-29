import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";

export const dynamic = "force-dynamic";

/** Efface définitivement ce qui traîne à la corbeille depuis plus de 30 jours. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("purge_deleted", { older_than_days: 30 });

  if (error) {
    console.error("[cron/purge] purge impossible", error.message);
    return NextResponse.json({ error: "Purge impossible" }, { status: 500 });
  }

  console.log("[cron/purge]", { removed: data });
  return NextResponse.json({ ok: true, removed: data ?? 0 });
}
