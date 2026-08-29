"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { firstIssue } from "@/lib/validators/common";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";

/**
 * Actions groupées sur une sélection de fiches.
 *
 * Sans elles, reprendre deux cents lignes importées se fait une par une —
 * c'est le premier geste que réclame quiconque vient d'un tableur.
 */

const MAX_SELECTION = 500;

const selectionSchema = z.object({
  entity: z.enum(["company", "contact"]),
  ids: z.array(z.uuid()).min(1, "Sélectionne au moins une fiche.").max(MAX_SELECTION),
});

const tagsSchema = selectionSchema.extend({
  add: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  remove: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

function table(entity: "company" | "contact") {
  return entity === "company" ? ("companies" as const) : ("contacts" as const);
}

/** Ajoute et retire des tags sur toute la sélection, en une passe. */
export async function bulkUpdateTags(
  input: unknown,
): Promise<ActionResult<{ updated: number }>> {
  const parsed = tagsSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { entity, ids, add, remove } = parsed.data;
  if (add.length === 0 && remove.length === 0) {
    return fail("Choisis au moins un tag à ajouter ou à retirer.");
  }

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { data: rows, error: readError } = await supabase
    .from(table(entity))
    .select("id, tags")
    .eq("workspace_id", workspace.id)
    .in("id", ids);

  if (readError) {
    console.error("[bulk] lecture impossible", readError.message);
    return fail(pgError(readError, "Lecture de la sélection impossible."));
  }

  let updated = 0;

  for (const row of rows ?? []) {
    const next = new Set(row.tags ?? []);
    for (const tag of add) next.add(tag);
    for (const tag of remove) next.delete(tag);

    const sorted = [...next];
    // Rien n'a changé sur cette fiche : on évite l'écriture.
    if (sorted.length === (row.tags ?? []).length && add.every((t) => (row.tags ?? []).includes(t))) {
      if (remove.every((t) => !(row.tags ?? []).includes(t))) continue;
    }

    const { error } = await supabase
      .from(table(entity))
      .update({ tags: sorted })
      .eq("id", row.id)
      .eq("workspace_id", workspace.id);

    if (error) {
      console.error("[bulk] mise à jour impossible", error.message);
      return fail(
        pgError(error, `Interrompu après ${updated} fiche(s). Les autres n'ont pas changé.`),
      );
    }
    updated += 1;
  }

  // Les nouveaux tags rejoignent le catalogue, sinon ils restent invisibles
  // aux filtres — le défaut qu'on vient justement de corriger.
  if (add.length > 0) {
    await supabase
      .from("tags")
      .upsert(
        add.map((name) => ({ workspace_id: workspace.id, name })),
        { onConflict: "workspace_id,name", ignoreDuplicates: true },
      );
  }

  revalidatePath("/contacts");
  return ok({ updated });
}

/** Change le propriétaire de toute la sélection. */
export async function bulkAssignOwner(
  input: unknown,
): Promise<ActionResult<{ updated: number }>> {
  const parsed = selectionSchema
    .extend({ ownerId: z.union([z.uuid(), z.literal("")]) })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error, count } = await supabase
    .from(table(parsed.data.entity))
    .update({ owner_id: parsed.data.ownerId || null }, { count: "exact" })
    .eq("workspace_id", workspace.id)
    .in("id", parsed.data.ids);

  if (error) {
    console.error("[bulk] attribution impossible", error.message);
    return fail(pgError(error, "Attribution refusée. Vérifie tes droits."));
  }

  revalidatePath("/contacts");
  return ok({ updated: count ?? parsed.data.ids.length });
}

/**
 * Supprime la sélection. Passe par la suppression réversible : les fiches
 * partent à la corbeille et restent récupérables trente jours.
 */
export async function bulkDelete(
  input: unknown,
): Promise<ActionResult<{ deleted: number }>> {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error, count } = await supabase
    .from(table(parsed.data.entity))
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("workspace_id", workspace.id)
    .in("id", parsed.data.ids);

  if (error) {
    console.error("[bulk] suppression impossible", error.message);
    return fail(pgError(error, "Suppression refusée. Vérifie tes droits."));
  }

  revalidatePath("/contacts");
  return ok({ deleted: count ?? parsed.data.ids.length });
}

/** Annule la dernière suppression groupée. */
export async function bulkRestore(input: unknown): Promise<ActionResult> {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from(table(parsed.data.entity))
    .update({ deleted_at: null })
    .eq("workspace_id", workspace.id)
    .in("id", parsed.data.ids);

  if (error) return fail(pgError(error, "Restauration impossible."));

  revalidatePath("/contacts");
  return ok(undefined);
}

/** Crée une opportunité pour chaque entreprise sélectionnée. */
export async function bulkCreateDeals(
  input: unknown,
): Promise<ActionResult<{ created: number }>> {
  const parsed = selectionSchema
    .extend({ entity: z.literal("company"), stageId: z.uuid() })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { data: stage } = await supabase
    .from("stages")
    .select("id, pipeline_id")
    .eq("id", parsed.data.stageId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!stage) return fail("Cette étape n'existe plus. Recharge la page.");

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .in("id", parsed.data.ids);

  if (!companies?.length) return fail("Aucune entreprise dans la sélection.");

  // On ne crée pas de doublon pour une entreprise qui a déjà une opportunité ouverte.
  const { data: existing } = await supabase
    .from("deals")
    .select("company_id")
    .eq("workspace_id", workspace.id)
    .eq("status", "open")
    .in("company_id", parsed.data.ids);

  const alreadyHas = new Set((existing ?? []).map((deal) => deal.company_id));
  const toCreate = companies.filter((company) => !alreadyHas.has(company.id));

  if (toCreate.length === 0) {
    return fail("Ces entreprises ont déjà une opportunité ouverte.");
  }

  const { error } = await supabase.from("deals").insert(
    toCreate.map((company) => ({
      workspace_id: workspace.id,
      pipeline_id: stage.pipeline_id,
      stage_id: stage.id,
      company_id: company.id,
      title: company.name,
      last_activity_at: new Date().toISOString(),
    })),
  );

  if (error) {
    console.error("[bulk] création d'opportunités impossible", error.message);
    return fail(pgError(error, "Création impossible. Réessaie."));
  }

  revalidatePath("/contacts");
  revalidatePath("/pipeline");
  return ok({ created: toCreate.length });
}
