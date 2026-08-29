"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { checkQuota } from "@/lib/plans";
import { firstIssue } from "@/lib/validators/common";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";
import {
  ACTION_TYPES,
  OPERATORS,
  TRIGGER_EVENTS,
  type Rule,
} from "@/lib/automations/types";

const triggerSchema = z.object({
  event: z.enum(TRIGGER_EVENTS),
  to_stage: z.string().optional(),
  days: z.number().int().min(1).max(365).optional(),
});

const conditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(OPERATORS),
  value: z.unknown().optional(),
});

const actionSchema = z.object({
  type: z.enum(ACTION_TYPES),
  params: z.record(z.string(), z.unknown()).default({}),
});

const ruleSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Donne un nom à la règle.").max(120),
  enabled: z.boolean().default(true),
  trigger: triggerSchema,
  conditions: z.array(conditionSchema).max(10).default([]),
  actions: z.array(actionSchema).min(1, "Ajoute au moins une action.").max(10),
});

export async function saveAutomation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();
  const { id, ...rule } = parsed.data;

  // Seule une règle nouvelle et active consomme du quota.
  if (!id && rule.enabled) {
    const quota = await checkQuota(supabase, workspace.id, "automations");
    if (!quota.allowed) return fail(quota.reason);
  }

  const row = {
    workspace_id: workspace.id,
    name: rule.name,
    enabled: rule.enabled,
    trigger: rule.trigger as never,
    conditions: rule.conditions as never,
    actions: rule.actions as never,
  };

  const query = id
    ? supabase.from("automations").update(row).eq("id", id).eq("workspace_id", workspace.id)
    : supabase.from("automations").insert(row);

  const { data, error } = await query.select("id").single();

  if (error) {
    console.error("[automations] enregistrement impossible", error.message);
    return fail(pgError(error, "Impossible d'enregistrer la règle. Réessaie."));
  }

  revalidatePath("/automations");
  return ok({ id: data.id });
}

export async function toggleAutomation(
  id: string,
  enabled: boolean,
): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("automations")
    .update({ enabled })
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return fail(pgError(error, "Changement d'état refusé."));

  revalidatePath("/automations");
  return ok(undefined);
}

export async function deleteAutomation(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("automations")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return fail(pgError(error, "Suppression refusée."));

  revalidatePath("/automations");
  return ok(undefined);
}

/**
 * Recettes activables en un clic — l'équivalent moderne du bouton Excel.
 * Les identifiants d'étape sont résolus au moment de l'activation.
 */
export async function installRecipe(
  recipe: "follow_up" | "second_chance" | "stale_deal" | "won_thanks",
): Promise<ActionResult<{ id: string }>> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { data: stages } = await supabase
    .from("stages")
    .select("id, name, is_won")
    .eq("workspace_id", workspace.id)
    .order("position");

  const contacted = stages?.find((s) => /contact/i.test(s.name));
  const won = stages?.find((s) => s.is_won);

  const recipes: Record<string, Omit<Rule, "id">> = {
    follow_up: {
      name: "Relance systématique après contact",
      enabled: true,
      trigger: { event: "deal.stage_changed", to_stage: contacted?.id },
      conditions: [],
      actions: [
        {
          type: "task.create",
          params: {
            title: "Relancer {{company.name}}",
            due_in_days: 5,
            remind_min: 60,
          },
        },
        { type: "calendar.create_event", params: { from_task: true } },
      ],
    },
    second_chance: {
      name: "Deuxième relance sans réponse",
      enabled: true,
      trigger: { event: "task.completed" },
      conditions: [{ field: "task.kind", op: "eq", value: "follow_up" }],
      actions: [
        {
          type: "task.create",
          params: {
            title: "Deuxième relance {{company.name}}",
            due_in_days: 7,
            remind_min: 60,
          },
        },
        { type: "calendar.create_event", params: { from_task: true } },
      ],
    },
    stale_deal: {
      name: "Opportunité qui dort",
      enabled: true,
      trigger: { event: "deal.stale", days: 14 },
      conditions: [],
      actions: [
        {
          type: "activity.log",
          params: {
            subject_type: "deal",
            content: "Sans activité depuis 14 jours — relance suggérée.",
          },
        },
        {
          type: "task.create",
          params: { title: "Reprendre contact {{company.name}}", due_in_days: 1 },
        },
      ],
    },
    won_thanks: {
      name: "Nouveau client : remerciement",
      enabled: true,
      trigger: { event: "deal.stage_changed", to_stage: won?.id },
      conditions: [{ field: "company.email", op: "is_set" }],
      actions: [
        {
          type: "email.send",
          params: {
            to: "{{company.email}}",
            subject: "Merci pour votre confiance",
            body:
              "Bonjour,\n\nMerci d'avoir choisi de travailler avec nous. Je reviens vers vous très vite avec les prochaines étapes.\n\nBien à vous",
          },
        },
        { type: "webhook.post", params: { event: "deal.won" } },
      ],
    },
  };

  const rule = recipes[recipe];
  if (!rule) return fail("Recette inconnue.");

  if (rule.trigger.event === "deal.stage_changed" && !rule.trigger.to_stage) {
    return fail(
      "Aucune étape correspondante dans ton pipeline. Crée la règle à la main depuis « Nouvelle règle ».",
    );
  }

  return saveAutomation(rule);
}
