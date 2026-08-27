import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activities";
import { renderTemplate, sendEmail } from "@/lib/email";
import { dispatchWebhooks, type WebhookEvent } from "@/lib/webhooks";
import type { Action, Condition, Rule, Trigger, TriggerEvent } from "./types";

type Client = SupabaseClient<Database>;

export type DomainEvent = {
  type: TriggerEvent;
  payload: Record<string, unknown>;
};

export type AutomationContext = {
  workspaceId: string;
  /** Client explicite pour les appels sans session (cron). */
  supabase?: Client;
  /** Anti-boucle : une action d'automatisation ne relance pas le moteur. */
  depth?: number;
};

const MAX_DEPTH = 1;

/**
 * Point d'entrée : appelé après chaque mutation métier, et par le cron pour les
 * déclencheurs temporels (deal.stale, task.overdue).
 *
 * Ne jette jamais. Une règle cassée ne doit pas faire échouer l'action de
 * l'utilisateur ; chaque exécution est tracée dans automation_runs.
 */
export async function runAutomations(
  event: DomainEvent,
  context: AutomationContext,
): Promise<void> {
  if ((context.depth ?? 0) > MAX_DEPTH) return;

  try {
    const supabase = context.supabase ?? (await createClient());

    const { data, error } = await supabase
      .from("automations")
      .select("id, name, enabled, trigger, conditions, actions")
      .eq("workspace_id", context.workspaceId)
      .eq("enabled", true);

    if (error) {
      console.error("[automations] lecture des règles impossible", error.message);
      return;
    }
    if (!data?.length) return;

    const rules = data.map(
      (row): Rule => ({
        id: row.id,
        name: row.name,
        enabled: row.enabled,
        trigger: row.trigger as unknown as Trigger,
        conditions: (row.conditions ?? []) as unknown as Condition[],
        actions: (row.actions ?? []) as unknown as Action[],
      }),
    );

    for (const rule of rules) {
      if (!matchTrigger(rule.trigger, event)) continue;
      if (!evalConditions(rule.conditions, event.payload)) continue;

      for (const action of rule.actions) {
        try {
          await runAction(supabase, action, event, {
            ...context,
            depth: (context.depth ?? 0) + 1,
          });
          await logRun(supabase, context.workspaceId, rule.id, "success", {
            action: action.type,
            event: event.type,
          });
        } catch (actionError) {
          const message =
            actionError instanceof Error ? actionError.message : "erreur inconnue";
          console.error(
            `[automations] "${rule.name}" · action ${action.type} en échec`,
            message,
          );
          await logRun(supabase, context.workspaceId, rule.id, "error", {
            action: action.type,
            event: event.type,
            error: message,
          });
        }
      }
    }
  } catch (error) {
    console.error(
      "[automations] moteur interrompu",
      error instanceof Error ? error.message : "erreur inconnue",
    );
  }
}

export function matchTrigger(trigger: Trigger, event: DomainEvent): boolean {
  if (trigger.event !== event.type) return false;

  if (trigger.event === "deal.stage_changed" && trigger.to_stage) {
    const stageId = readPath(event.payload, "deal.stage_id");
    const stageName = readPath(event.payload, "stage.name");
    return trigger.to_stage === stageId || trigger.to_stage === stageName;
  }

  return true;
}

export function evalConditions(
  conditions: Condition[],
  payload: Record<string, unknown>,
): boolean {
  // Toutes les conditions doivent être vraies.
  return conditions.every((condition) => {
    const actual = readPath(payload, condition.field);
    const expected = condition.value;

    switch (condition.op) {
      case "eq":
        return String(actual ?? "") === String(expected ?? "");
      case "neq":
        return String(actual ?? "") !== String(expected ?? "");
      case "in": {
        const list = Array.isArray(expected)
          ? expected.map(String)
          : String(expected ?? "")
              .split(",")
              .map((v) => v.trim());
        return list.includes(String(actual ?? ""));
      }
      case "gt":
        return Number(actual) > Number(expected);
      case "lt":
        return Number(actual) < Number(expected);
      case "contains": {
        if (Array.isArray(actual)) return actual.map(String).includes(String(expected));
        return String(actual ?? "")
          .toLowerCase()
          .includes(String(expected ?? "").toLowerCase());
      }
      case "is_empty":
        return actual == null || actual === "" || (Array.isArray(actual) && !actual.length);
      case "is_set":
        return actual != null && actual !== "" && (!Array.isArray(actual) || actual.length > 0);
      default:
        return false;
    }
  });
}

/** Lit `deal.value` dans un payload imbriqué. */
function readPath(source: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      source,
    );
}

function interpolate(value: unknown, payload: Record<string, unknown>): string {
  return renderTemplate(String(value ?? ""), payload);
}

async function runAction(
  supabase: Client,
  action: Action,
  event: DomainEvent,
  context: AutomationContext,
): Promise<void> {
  const { workspaceId } = context;
  const payload = event.payload;
  const params = action.params ?? {};

  switch (action.type) {
    case "task.create": {
      const dueInDays = Number(params.due_in_days ?? 5);
      const remindMin = Number(params.remind_min ?? 30);
      const dueAt = new Date(Date.now() + dueInDays * 86_400_000);
      const remindAt = new Date(dueAt.getTime() - remindMin * 60_000);

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id: workspaceId,
          title: interpolate(params.title ?? "Relance {{company.name}}", payload),
          kind: "follow_up",
          due_at: dueAt.toISOString(),
          remind_at: remindAt.toISOString(),
          priority: "normal",
          company_id: (readPath(payload, "company.id") as string) ?? null,
          contact_id: (readPath(payload, "contact.id") as string) ?? null,
          deal_id: (readPath(payload, "deal.id") as string) ?? null,
        })
        .select("id, title, due_at")
        .single();

      if (error) throw new Error(error.message);

      // Mémorise la tâche pour qu'une action calendar.create_event suivante la retrouve.
      payload.task = task;
      return;
    }

    case "calendar.create_event": {
      const taskId = (readPath(payload, "task.id") as string) ?? null;
      if (!taskId) throw new Error("Aucune relance à pousser vers l'agenda.");
      // La synchronisation réelle passe par le module agenda, qui a besoin du
      // propriétaire de l'intégration : on délègue à l'action serveur dédiée.
      const { syncTaskToCalendar } = await import("@/server/actions/calendar-sync");
      const result = await syncTaskToCalendar(taskId);
      if (!result.ok) throw new Error(result.error);
      return;
    }

    case "email.send": {
      const to = interpolate(params.to ?? "{{company.email}}", payload);
      if (!to || !to.includes("@")) {
        throw new Error("Aucune adresse e-mail valide sur la fiche.");
      }
      const result = await sendEmail({
        to,
        subject: interpolate(params.subject ?? "Suite à notre échange", payload),
        text: interpolate(params.body ?? "", payload),
      });
      if (!result.sent) throw new Error(result.error ?? "envoi refusé");

      const subjectId = readPath(payload, "company.id") as string | undefined;
      if (subjectId) {
        await logActivity(supabase, {
          workspaceId,
          subjectType: "company",
          subjectId,
          type: "email",
          content: `E-mail envoyé à ${to} (automatisation)`,
        });
      }
      return;
    }

    case "deal.move": {
      const dealId = readPath(payload, "deal.id") as string | undefined;
      const stageId = params.stage_id as string | undefined;
      if (!dealId || !stageId) throw new Error("Opportunité ou étape manquante.");

      const { error } = await supabase
        .from("deals")
        .update({ stage_id: stageId })
        .eq("id", dealId)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
      return;
    }

    case "deal.set":
    case "company.set":
    case "contact.set": {
      const entity = action.type.split(".")[0] as "deal" | "company" | "contact";
      const table = `${entity}s` as "deals" | "companies" | "contacts";
      const id = readPath(payload, `${entity}.id`) as string | undefined;
      const field = params.field as string | undefined;
      if (!id || !field) throw new Error("Cible ou champ manquant.");

      const { error } = await supabase
        .from(table)
        .update({ [field]: interpolate(params.value, payload) } as never)
        .eq("id", id)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
      return;
    }

    case "activity.log": {
      const entity = (params.subject_type as "company" | "contact" | "deal") ?? "company";
      const subjectId = readPath(payload, `${entity}.id`) as string | undefined;
      if (!subjectId) throw new Error("Aucune fiche à annoter.");

      await logActivity(supabase, {
        workspaceId,
        subjectType: entity,
        subjectId,
        type: "note",
        content: interpolate(params.content ?? "", payload),
        meta: { source: "automation" },
      });
      return;
    }

    case "webhook.post": {
      await dispatchWebhooks(
        supabase,
        workspaceId,
        (params.event as WebhookEvent) ?? (event.type as WebhookEvent),
        payload,
      );
      return;
    }

    default:
      throw new Error(`Action inconnue : ${action.type}`);
  }
}

async function logRun(
  supabase: Client,
  workspaceId: string,
  automationId: string,
  status: "success" | "error",
  detail: Record<string, unknown>,
) {
  const { error } = await supabase.from("automation_runs").insert({
    workspace_id: workspaceId,
    automation_id: automationId,
    status,
    detail: detail as never,
  });
  if (error) console.error("[automations] journalisation impossible", error.message);
}
