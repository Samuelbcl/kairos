"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { logActivity, touchDeal } from "@/lib/activities";
import { firstIssue } from "@/lib/validators/common";
import {
  dealCreateSchema,
  dealMoveSchema,
  dealUpdateSchema,
} from "@/lib/validators/deal";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";
import { runAutomations } from "@/lib/automations/engine";
import { dispatchWebhooks } from "@/lib/webhooks";

export async function createDeal(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = dealCreateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  // Le pipeline est déduit de l'étape : on ne le demande jamais à l'utilisateur.
  const { data: stage, error: stageError } = await supabase
    .from("stages")
    .select("id, name, pipeline_id")
    .eq("id", parsed.data.stage_id)
    .eq("workspace_id", workspace.id)
    .single();

  if (stageError || !stage) {
    return fail("Cette étape n'existe plus. Recharge la page.");
  }

  const { data, error } = await supabase
    .from("deals")
    .insert({
      ...parsed.data,
      workspace_id: workspace.id,
      pipeline_id: stage.pipeline_id,
      last_activity_at: new Date().toISOString(),
    })
    .select("id, title, value, priority, status, stage_id, company_id, contact_id")
    .single();

  if (error) {
    console.error("[deals] création impossible", error.message);
    return fail(pgError(error, "Impossible de créer l'opportunité. Réessaie."));
  }

  await logActivity(supabase, {
    workspaceId: workspace.id,
    subjectType: "deal",
    subjectId: data.id,
    type: "system",
    content: `Opportunité créée dans « ${stage.name} »`,
  });

  const payload = { deal: data, stage };
  await Promise.all([
    runAutomations({ type: "deal.created", payload }, { workspaceId: workspace.id }),
    dispatchWebhooks(supabase, workspace.id, "deal.created", payload),
  ]);

  revalidatePath("/pipeline");
  return ok({ id: data.id });
}

export async function updateDeal(input: unknown): Promise<ActionResult> {
  const parsed = dealUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { id, notes, ...fields } = parsed.data;
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  if (Object.keys(fields).length > 0) {
    const { error } = await supabase
      .from("deals")
      .update(fields)
      .eq("id", id)
      .eq("workspace_id", workspace.id);

    if (error) {
      console.error("[deals] mise à jour impossible", error.message);
      return fail(pgError(error, "Modification refusée. Recharge la page et réessaie."));
    }
  }

  if (notes) {
    await logActivity(supabase, {
      workspaceId: workspace.id,
      subjectType: "deal",
      subjectId: id,
      type: "note",
      content: notes,
    });
  }

  await touchDeal(supabase, id);
  revalidatePath("/pipeline");
  return ok(undefined);
}

/**
 * Déplace une opportunité d'étape (drag & drop du kanban).
 * Le trigger SQL écrit l'entrée de timeline et recalcule le statut ;
 * ici on ne s'occupe que des automatisations et des webhooks.
 */
export async function moveDeal(input: unknown): Promise<ActionResult> {
  const parsed = dealMoveSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { data: stage } = await supabase
    .from("stages")
    .select("id, name, is_won, is_lost")
    .eq("id", parsed.data.stage_id)
    .eq("workspace_id", workspace.id)
    .single();

  if (!stage) return fail("Cette étape n'existe plus. Recharge la page.");

  const { data, error } = await supabase
    .from("deals")
    .update({ stage_id: parsed.data.stage_id })
    .eq("id", parsed.data.id)
    .eq("workspace_id", workspace.id)
    .select(
      "id, title, value, priority, status, stage_id, company_id, contact_id, companies(id, name, email)",
    )
    .single();

  if (error) {
    console.error("[deals] déplacement impossible", error.message);
    return fail(pgError(error, "Déplacement refusé. Recharge la page et réessaie."));
  }

  const payload = {
    deal: data,
    stage,
    company: data.companies ?? undefined,
  };

  await runAutomations(
    { type: "deal.stage_changed", payload },
    { workspaceId: workspace.id },
  );
  await dispatchWebhooks(supabase, workspace.id, "deal.stage_changed", payload);
  if (stage.is_won) {
    await dispatchWebhooks(supabase, workspace.id, "deal.won", payload);
  }
  if (stage.is_lost) {
    await dispatchWebhooks(supabase, workspace.id, "deal.lost", payload);
  }

  revalidatePath("/pipeline");
  return ok(undefined);
}

export async function deleteDeal(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("deals")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("[deals] suppression impossible", error.message);
    return fail(pgError(error, "Suppression refusée. Vérifie tes droits sur cet espace."));
  }

  revalidatePath("/pipeline");
  return ok(undefined);
}
