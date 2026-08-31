"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { firstIssue } from "@/lib/validators/common";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide : utilise un code hexadécimal (#4F46E5).");

const brandingSchema = z.object({
  brand_name: z.string().trim().max(60).optional(),
  accent: hexColor.optional(),
  radius: z.enum(["0.25rem", "0.5rem", "0.75rem", "1rem"]).optional(),
  mode: z.enum(["light", "dark"]).optional(),
  logo_url: z.string().trim().max(500).optional(),
  favicon_url: z.string().trim().max(500).optional(),
});

const fieldLabelsSchema = z.record(
  z.string().regex(/^(company|contact)\.[a-z_]+$/, "Champ inconnu."),
  z.string().trim().max(40, "40 caractères au maximum."),
);

/**
 * Renommage des champs intégrés.
 *
 * Remplace la table entière plutôt que de fusionner : c'est ce qui permet
 * d'effacer un renommage en vidant simplement la case. Les valeurs vides sont
 * retirées, pour qu'un champ efface revienne à son nom d'origine au lieu de
 * s'afficher sans intitulé.
 */
export async function saveFieldLabels(input: unknown): Promise<ActionResult> {
  const parsed = fieldLabelsSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  if (workspace.role === "member") {
    return fail("Seuls les propriétaires et administrateurs peuvent renommer les champs.");
  }

  const labels = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value.length > 0),
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ field_labels: labels as never })
    .eq("id", workspace.id);

  if (error) {
    console.error("[workspace] field_labels", error.message);
    return fail(pgError(error, "Enregistrement impossible. Réessaie."));
  }

  revalidatePath("/", "layout");
  return ok(undefined);
}

/** Branding de l'espace : c'est ce qui rend Kairos revendable en marque blanche. */
export async function updateBranding(input: unknown): Promise<ActionResult> {
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  if (workspace.role === "member") {
    return fail("Seuls les propriétaires et administrateurs peuvent changer l'apparence.");
  }

  const supabase = await createClient();
  const branding = { ...workspace.branding, ...parsed.data };

  const { error } = await supabase
    .from("workspaces")
    .update({ branding: branding as never })
    .eq("id", workspace.id);

  if (error) {
    console.error("[workspace] branding", error.message);
    return fail(pgError(error, "Enregistrement impossible. Réessaie."));
  }

  revalidatePath("/", "layout");
  return ok(undefined);
}

const workspaceSchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'espace est obligatoire.").max(80),
  timezone: z.string().trim().min(1).max(60),
});

export async function updateWorkspace(input: unknown): Promise<ActionResult> {
  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  if (workspace.role === "member") {
    return fail("Seuls les propriétaires et administrateurs peuvent modifier l'espace.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update(parsed.data)
    .eq("id", workspace.id);

  if (error) return fail(pgError(error, "Enregistrement impossible. Réessaie."));

  revalidatePath("/", "layout");
  return ok(undefined);
}

// --- Étapes du pipeline -----------------------------------------------------

const stageSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Donne un nom à l'étape.").max(40),
  color: hexColor,
  probability: z.coerce.number().int().min(0).max(100),
  is_won: z.boolean().default(false),
  is_lost: z.boolean().default(false),
});

export async function saveStage(input: unknown): Promise<ActionResult> {
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();
  const { id, ...fields } = parsed.data;

  if (id) {
    const { error } = await supabase
      .from("stages")
      .update(fields)
      .eq("id", id)
      .eq("workspace_id", workspace.id);

    if (error) return fail(pgError(error, "Modification de l'étape refusée."));
  } else {
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("is_default", true)
      .single();

    if (!pipeline) return fail("Aucun pipeline par défaut dans cet espace.");

    const { count } = await supabase
      .from("stages")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", pipeline.id);

    const { error } = await supabase.from("stages").insert({
      ...fields,
      workspace_id: workspace.id,
      pipeline_id: pipeline.id,
      position: count ?? 0,
    });

    if (error) return fail(pgError(error, "Création de l'étape impossible."));
  }

  revalidatePath("/settings/workspace");
  revalidatePath("/pipeline");
  return ok(undefined);
}

/**
 * Supprime une étape. Refusé si des opportunités s'y trouvent encore :
 * la clé étrangère est en `on delete restrict`, et perdre des deals en silence
 * serait pire qu'un message d'erreur.
 */
export async function deleteStage(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { count } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", id);

  if ((count ?? 0) > 0) {
    return fail(
      `Cette étape contient ${count} opportunité${count! > 1 ? "s" : ""}. Déplace-les d'abord dans une autre colonne.`,
    );
  }

  const { error } = await supabase
    .from("stages")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return fail(pgError(error, "Suppression de l'étape refusée."));

  revalidatePath("/settings/workspace");
  revalidatePath("/pipeline");
  return ok(undefined);
}

export async function reorderStages(ids: string[]): Promise<ActionResult> {
  const parsed = z.array(z.uuid()).min(1).safeParse(ids);
  if (!parsed.success) return fail("Ordre invalide.");

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  for (const [position, id] of parsed.data.entries()) {
    const { error } = await supabase
      .from("stages")
      .update({ position })
      .eq("id", id)
      .eq("workspace_id", workspace.id);

    if (error) return fail(pgError(error, "Réordonnancement impossible."));
  }

  revalidatePath("/settings/workspace");
  revalidatePath("/pipeline");
  return ok(undefined);
}

// --- Champs personnalisés ---------------------------------------------------

const customFieldSchema = z.object({
  id: z.uuid().optional(),
  entity: z.enum(["company", "contact", "deal"]),
  key: z
    .string()
    .trim()
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Identifiant technique : minuscules, chiffres et tirets bas, commençant par une lettre.",
    )
    .max(40),
  label: z.string().trim().min(1, "Donne un libellé au champ.").max(60),
  type: z.enum(["text", "number", "date", "select", "checkbox", "url", "email", "phone"]),
  options: z.array(z.string().trim().min(1)).optional(),
});

export async function saveCustomField(input: unknown): Promise<ActionResult> {
  const parsed = customFieldSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();
  const { id, options, ...fields } = parsed.data;

  const row = {
    ...fields,
    workspace_id: workspace.id,
    options: (options ?? null) as never,
  };

  const { error } = id
    ? await supabase.from("custom_fields").update(row).eq("id", id).eq("workspace_id", workspace.id)
    : await supabase.from("custom_fields").insert(row);

  if (error) {
    if (error.code === "23505") {
      return fail("Un champ avec cet identifiant existe déjà pour cette entité.");
    }
    return fail(pgError(error, "Enregistrement du champ impossible."));
  }

  revalidatePath("/settings/workspace");
  return ok(undefined);
}

export async function deleteCustomField(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("custom_fields")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return fail(pgError(error, "Suppression refusée."));

  revalidatePath("/settings/workspace");
  return ok(undefined);
}
