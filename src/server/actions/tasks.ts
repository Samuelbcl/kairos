"use server";

import { revalidatePath } from "next/cache";
import type { Database } from "@/types/db";
import { createClient, getUser } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { firstIssue } from "@/lib/validators/common";
import {
  taskCreateSchema,
  taskSnoozeSchema,
  taskUpdateSchema,
} from "@/lib/validators/task";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";
import { runAutomations } from "@/lib/automations/engine";
import { dispatchWebhooks } from "@/lib/webhooks";
import { syncTaskToCalendar, unsyncTaskFromCalendar } from "./calendar-sync";

/**
 * Crée une relance et la pousse vers l'agenda si un agenda est connecté.
 * L'absence d'agenda n'est jamais une erreur : la relance existe quand même,
 * et le retour indique si la synchronisation a eu lieu.
 */
export async function createTask(input: unknown): Promise<
  ActionResult<{ id: string; synced: boolean; syncNote?: string }>
> {
  const parsed = taskCreateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const user = await getUser();
  const supabase = await createClient();

  const { remind_before_min, ...fields } = parsed.data;
  const dueAt = new Date(fields.due_at);
  const remindAt =
    remind_before_min > 0
      ? new Date(dueAt.getTime() - remind_before_min * 60_000).toISOString()
      : null;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...fields,
      workspace_id: workspace.id,
      remind_at: remindAt,
      assignee_id: fields.assignee_id ?? user?.id ?? null,
    })
    .select("id, title, kind, due_at, priority, company_id, contact_id, deal_id")
    .single();

  if (error) {
    console.error("[tasks] création impossible", error.message);
    return fail(pgError(error, "Impossible de créer la relance. Réessaie."));
  }

  const sync = await syncTaskToCalendar(data.id);
  const synced = sync.ok && sync.data.synced;

  await Promise.all([
    runAutomations(
      { type: "task.created", payload: { task: data } },
      { workspaceId: workspace.id },
    ),
    dispatchWebhooks(supabase, workspace.id, "task.created", { task: data }),
  ]);

  revalidatePath("/today");
  revalidatePath("/pipeline");

  return ok({
    id: data.id,
    synced,
    syncNote: sync.ok ? sync.data.reason : sync.error,
  });
}

export async function updateTask(input: unknown): Promise<ActionResult> {
  const parsed = taskUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { id, remind_before_min, ...fields } = parsed.data;
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  type TaskPatch = Database["public"]["Tables"]["tasks"]["Update"];
  const patch: TaskPatch = { ...fields };

  // Le rappel est exprimé en minutes avant l'échéance : on le recalcule dès que
  // l'échéance ou le délai change.
  if (remind_before_min !== undefined || fields.due_at) {
    const { data: current } = await supabase
      .from("tasks")
      .select("due_at, remind_at")
      .eq("id", id)
      .eq("workspace_id", workspace.id)
      .single();

    const dueAt = new Date(fields.due_at ?? current?.due_at ?? Date.now());
    const minutes =
      remind_before_min ??
      (current?.remind_at
        ? Math.round(
            (new Date(current.due_at).getTime() - new Date(current.remind_at).getTime()) /
              60_000,
          )
        : 30);

    patch.remind_at =
      minutes > 0 ? new Date(dueAt.getTime() - minutes * 60_000).toISOString() : null;
  }

  const { error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("[tasks] mise à jour impossible", error.message);
    return fail(pgError(error, "Modification refusée. Recharge la page et réessaie."));
  }

  // Idempotent : met à jour l'événement existant plutôt que d'en créer un autre.
  await syncTaskToCalendar(id);

  revalidatePath("/today");
  return ok(undefined);
}

/** Termine une relance : le trigger SQL écrit la timeline, on nettoie l'agenda. */
export async function completeTask(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({ done: true })
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("id, title, kind, due_at, company_id, contact_id, deal_id")
    .single();

  if (error) {
    console.error("[tasks] clôture impossible", error.message);
    return fail(pgError(error, "Impossible de terminer la relance. Réessaie."));
  }

  await unsyncTaskFromCalendar(id);

  await Promise.all([
    runAutomations(
      { type: "task.completed", payload: { task: data } },
      { workspaceId: workspace.id },
    ),
    dispatchWebhooks(supabase, workspace.id, "task.completed", { task: data }),
  ]);

  revalidatePath("/today");
  return ok(undefined);
}

export async function reopenTask(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ done: false, done_at: null })
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return fail(pgError(error, "Impossible de rouvrir la relance."));

  await syncTaskToCalendar(id);
  revalidatePath("/today");
  return ok(undefined);
}

/** Reporte une relance de N jours, en conservant l'heure. */
export async function snoozeTask(input: unknown): Promise<ActionResult> {
  const parsed = taskSnoozeSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("tasks")
    .select("due_at, remind_at")
    .eq("id", parsed.data.id)
    .eq("workspace_id", workspace.id)
    .single();

  if (!current) return fail("Relance introuvable. Recharge la page.");

  const shift = parsed.data.days * 86_400_000;
  const { error } = await supabase
    .from("tasks")
    .update({
      due_at: new Date(new Date(current.due_at).getTime() + shift).toISOString(),
      remind_at: current.remind_at
        ? new Date(new Date(current.remind_at).getTime() + shift).toISOString()
        : null,
    })
    .eq("id", parsed.data.id)
    .eq("workspace_id", workspace.id);

  if (error) return fail(pgError(error, "Report impossible. Réessaie."));

  await syncTaskToCalendar(parsed.data.id);
  revalidatePath("/today");
  return ok(undefined);
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  await unsyncTaskFromCalendar(id);

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return fail(pgError(error, "Suppression refusée."));

  revalidatePath("/today");
  return ok(undefined);
}
