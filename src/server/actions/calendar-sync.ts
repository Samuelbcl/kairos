"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import {
  deleteTaskEvent,
  getIntegration,
  upsertTaskEvent,
  type SyncableTask,
} from "@/lib/integrations/calendar";
import { fail, ok, type ActionResult } from "@/server/actions/types";

const TASK_FIELDS =
  "id, title, notes, due_at, remind_at, company_id, contact_id, deal_id, calendar_provider, external_event_id";

/**
 * Pousse une relance vers l'agenda connecté. Idempotent : appelable à chaque
 * modification de la tâche, jamais de doublon (voir external_event_id).
 *
 * Sans agenda connecté, ce n'est pas une erreur : la relance vit dans Kairos,
 * simplement pas dans l'agenda. On le dit clairement à l'appelant.
 */
export async function syncTaskToCalendar(taskId: string): Promise<ActionResult<{
  synced: boolean;
  reason?: string;
}>> {
  const workspace = await requireWorkspace();
  const user = await getUser();
  if (!user) return fail("Session expirée. Reconnecte-toi.");

  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select(TASK_FIELDS)
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .single();

  if (error || !task) {
    return fail("Relance introuvable. Recharge la page.");
  }

  const integration = await getIntegration(supabase, workspace.id, user.id);
  if (!integration) {
    return ok({
      synced: false,
      reason:
        "Aucun agenda connecté. Va dans Réglages → Intégrations pour connecter Google Agenda.",
    });
  }

  const result = await upsertTaskEvent(
    supabase,
    task as SyncableTask,
    integration,
    workspace.timezone,
  );

  if (!result.synced) {
    return fail(
      "L'événement n'a pas pu être créé dans ton agenda. Reconnecte-le dans Réglages → Intégrations.",
    );
  }

  return ok({ synced: true });
}

/** Retire l'événement d'agenda lié à une relance (tâche terminée ou supprimée). */
export async function unsyncTaskFromCalendar(
  taskId: string,
): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const user = await getUser();
  if (!user) return fail("Session expirée. Reconnecte-toi.");

  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select(TASK_FIELDS)
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!task?.external_event_id) return ok(undefined);

  const integration = await getIntegration(supabase, workspace.id, user.id);
  if (!integration) return ok(undefined);

  await deleteTaskEvent(supabase, task as SyncableTask, integration);
  return ok(undefined);
}
