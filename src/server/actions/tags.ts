"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { firstIssue } from "@/lib/validators/common";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";

const nameSchema = z.string().trim().min(1, "Donne un nom au tag.").max(40);
const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide : utilise un code hexadécimal.");

function revalidateAll() {
  revalidatePath("/contacts");
  revalidatePath("/settings/workspace");
}

export async function createTag(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ name: nameSchema, color: colorSchema.optional() })
    .safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase.from("tags").insert({
    workspace_id: workspace.id,
    name: parsed.data.name,
    ...(parsed.data.color ? { color: parsed.data.color } : {}),
  });

  if (error) {
    if (error.code === "23505") return fail("Ce tag existe déjà.");
    console.error("[tags] création impossible", error.message);
    return fail(pgError(error, "Création du tag impossible. Réessaie."));
  }

  revalidateAll();
  return ok(undefined);
}

/**
 * Renomme un tag partout : catalogue, entreprises et contacts.
 * Si le nouveau nom existe déjà, les deux tags fusionnent — c'est le
 * comportement attendu quand on nettoie « a rappeler » et « À rappeler ».
 */
export async function renameTag(
  oldName: string,
  newName: string,
): Promise<ActionResult> {
  const parsed = z
    .object({ oldName: nameSchema, newName: nameSchema })
    .safeParse({ oldName, newName });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  if (parsed.data.oldName === parsed.data.newName) return ok(undefined);

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase.rpc("rename_workspace_tag", {
    ws: workspace.id,
    old_name: parsed.data.oldName,
    new_name: parsed.data.newName,
  });

  if (error) {
    console.error("[tags] renommage impossible", error.message);
    return fail(pgError(error, "Renommage impossible. Réessaie."));
  }

  revalidateAll();
  return ok(undefined);
}

export async function recolorTag(
  name: string,
  color: string,
): Promise<ActionResult> {
  const parsed = z
    .object({ name: nameSchema, color: colorSchema })
    .safeParse({ name, color });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tags")
    .update({ color: parsed.data.color })
    .eq("workspace_id", workspace.id)
    .eq("name", parsed.data.name);

  if (error) return fail(pgError(error, "Changement de couleur impossible."));

  revalidateAll();
  return ok(undefined);
}

/** Retire le tag du catalogue et de toutes les fiches qui le portent. */
export async function deleteTag(name: string): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_workspace_tag", {
    ws: workspace.id,
    tag_name: parsed.data,
  });

  if (error) {
    console.error("[tags] suppression impossible", error.message);
    return fail(pgError(error, "Suppression impossible. Réessaie."));
  }

  revalidateAll();
  return ok(undefined);
}

/**
 * Enregistre au catalogue les tags déjà présents sur les fiches.
 * À lancer après un import : les tags y arrivent dans les colonnes text[]
 * sans passer par le catalogue, et restent donc invisibles aux filtres.
 */
export async function syncTags(): Promise<ActionResult<{ added: number }>> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("sync_workspace_tags", {
    ws: workspace.id,
  });

  if (error) {
    console.error("[tags] synchronisation impossible", error.message);
    return fail(pgError(error, "Synchronisation impossible. Réessaie."));
  }

  revalidateAll();
  return ok({ added: typeof data === "number" ? data : 0 });
}

/** Nombre de fiches portant chaque tag — pour savoir ce qu'on casse en supprimant. */
export async function countTagUsage(): Promise<
  ActionResult<Record<string, number>>
> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const [companies, contacts] = await Promise.all([
    supabase.from("companies").select("tags").eq("workspace_id", workspace.id),
    supabase.from("contacts").select("tags").eq("workspace_id", workspace.id),
  ]);

  const counts: Record<string, number> = {};
  for (const row of [...(companies.data ?? []), ...(contacts.data ?? [])]) {
    for (const tag of row.tags ?? []) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }

  return ok(counts);
}
