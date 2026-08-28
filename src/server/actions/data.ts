"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";

/**
 * Export complet des données de l'espace (RGPD, article 20).
 * Les jetons OAuth et les secrets ne sont jamais exportés.
 */
export async function exportWorkspaceData(): Promise<
  ActionResult<{ filename: string; json: string }>
> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const [companies, contacts, deals, tasks, activities, stages, tags, customFields] =
    await Promise.all([
      supabase.from("companies").select("*").eq("workspace_id", workspace.id),
      supabase.from("contacts").select("*").eq("workspace_id", workspace.id),
      supabase.from("deals").select("*").eq("workspace_id", workspace.id),
      supabase.from("tasks").select("*").eq("workspace_id", workspace.id),
      supabase.from("activities").select("*").eq("workspace_id", workspace.id),
      supabase.from("stages").select("*").eq("workspace_id", workspace.id),
      supabase.from("tags").select("*").eq("workspace_id", workspace.id),
      supabase.from("custom_fields").select("*").eq("workspace_id", workspace.id),
    ]);

  const failed = [companies, contacts, deals, tasks, activities].find((r) => r.error);
  if (failed?.error) {
    console.error("[export] lecture impossible", failed.error.message);
    return fail("Export impossible. Réessaie dans un instant.");
  }

  const payload = {
    exported_at: new Date().toISOString(),
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      timezone: workspace.timezone,
      branding: workspace.branding,
    },
    stages: stages.data ?? [],
    tags: tags.data ?? [],
    custom_fields: customFields.data ?? [],
    companies: companies.data ?? [],
    contacts: contacts.data ?? [],
    deals: deals.data ?? [],
    tasks: tasks.data ?? [],
    activities: activities.data ?? [],
  };

  const date = new Date().toISOString().slice(0, 10);
  return ok({
    filename: `kairos-${workspace.slug}-${date}.json`,
    json: JSON.stringify(payload, null, 2),
  });
}

/**
 * Supprime définitivement l'espace et tout ce qu'il contient (RGPD, article 17).
 * Réservé au propriétaire, et protégé par la saisie du nom exact de l'espace.
 */
export async function deleteWorkspace(confirmation: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();

  if (workspace.role !== "owner") {
    return fail("Seul le propriétaire de l'espace peut le supprimer.");
  }

  const parsed = z.string().trim().safeParse(confirmation);
  if (!parsed.success || parsed.data !== workspace.name) {
    return fail(
      `Saisis exactement « ${workspace.name} » pour confirmer la suppression.`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").delete().eq("id", workspace.id);

  if (error) {
    console.error("[data] suppression de l'espace impossible", error.message);
    return fail(pgError(error, "Suppression impossible. Réessaie."));
  }

  redirect("/");
}
