"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activities";
import { firstIssue } from "@/lib/validators/common";
import { companyCreateSchema, companyUpdateSchema } from "@/lib/validators/company";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";
import { runAutomations } from "@/lib/automations/engine";

export async function createCompany(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = companyCreateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .insert({ ...parsed.data, workspace_id: workspace.id })
    .select("id, name")
    .single();

  if (error) {
    console.error("[companies] création impossible", error.message);
    return fail(pgError(error, "Impossible de créer l'entreprise. Réessaie."));
  }

  await logActivity(supabase, {
    workspaceId: workspace.id,
    subjectType: "company",
    subjectId: data.id,
    type: "system",
    content: "Entreprise créée",
  });

  await runAutomations(
    { type: "company.created", payload: { company: data } },
    { workspaceId: workspace.id },
  );

  revalidatePath("/contacts");
  return ok(data);
}

export async function updateCompany(input: unknown): Promise<ActionResult> {
  const parsed = companyUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { id, ...fields } = parsed.data;
  if (Object.keys(fields).length === 0) return ok(undefined);

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update(fields)
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("[companies] mise à jour impossible", error.message);
    return fail(pgError(error, "Modification refusée. Recharge la page et réessaie."));
  }

  revalidatePath("/contacts");
  revalidatePath(`/companies/${id}`);
  return ok(undefined);
}

/**
 * Met l'entreprise à la corbeille. Ses contacts et opportunités suivent
 * (trigger SQL), et l'ensemble reste récupérable trente jours.
 */
export async function deleteCompany(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("[companies] suppression impossible", error.message);
    return fail(pgError(error, "Suppression refusée. Vérifie tes droits sur cet espace."));
  }

  revalidatePath("/contacts");
  return ok(undefined);
}

/** Note libre sur une fiche entreprise → entrée de timeline. */
export async function addCompanyNote(
  companyId: string,
  content: string,
): Promise<ActionResult> {
  const text = content.trim();
  if (!text) return fail("La note est vide.");
  if (text.length > 5000) return fail("La note est trop longue (5000 caractères max).");

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  await logActivity(supabase, {
    workspaceId: workspace.id,
    subjectType: "company",
    subjectId: companyId,
    type: "note",
    content: text,
  });

  revalidatePath(`/companies/${companyId}`);
  return ok(undefined);
}
