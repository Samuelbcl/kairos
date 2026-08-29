import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import {
  getWorkspaceIntegration,
  upsertTaskEvent,
  type SyncableTask,
} from "@/lib/integrations/calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TASK_FIELDS =
  "id, workspace_id, assignee_id, title, notes, due_at, remind_at, company_id, contact_id, deal_id, calendar_provider, external_event_id";

/**
 * Rattrape les relances jamais poussées vers un agenda.
 *
 * Une relance créée par l'API, par une automatisation ou par le cron n'a pas de
 * session : la synchronisation immédiate ne trouvait aucun jeton et abandonnait.
 * Ce passage horaire les reprend en utilisant l'agenda de l'espace.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: tasks, error } = await admin
    .from("tasks")
    .select(TASK_FIELDS)
    .eq("done", false)
    .is("external_event_id", null)
    .gte("due_at", new Date().toISOString())
    .order("due_at")
    .limit(300);

  if (error) {
    console.error("[cron/sync-calendar] lecture impossible", error.message);
    return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  }

  // Une intégration par espace, résolue une seule fois même si l'espace a
  // vingt relances en attente.
  const integrations = new Map<
    string,
    Awaited<ReturnType<typeof getWorkspaceIntegration>>
  >();
  const timezones = new Map<string, string>();

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const task of tasks ?? []) {
    const workspaceId = task.workspace_id;

    if (!integrations.has(workspaceId)) {
      integrations.set(
        workspaceId,
        await getWorkspaceIntegration(admin, workspaceId, task.assignee_id),
      );

      const { data: workspace } = await admin
        .from("workspaces")
        .select("timezone")
        .eq("id", workspaceId)
        .single();
      timezones.set(workspaceId, workspace?.timezone ?? "Europe/Brussels");
    }

    const integration = integrations.get(workspaceId);
    if (!integration) {
      // Aucun agenda connecté dans cet espace : ce n'est pas une erreur.
      skipped += 1;
      continue;
    }

    const result = await upsertTaskEvent(
      admin,
      task as SyncableTask,
      integration,
      timezones.get(workspaceId) ?? "Europe/Brussels",
    );

    if (result.synced) synced += 1;
    else failed += 1;
  }

  const report = { candidates: tasks?.length ?? 0, synced, skipped, failed };
  console.log("[cron/sync-calendar]", report);
  return NextResponse.json({ ok: true, ...report });
}
