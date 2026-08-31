import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { FieldLabelOverrides } from "@/lib/field-labels";

export type Branding = {
  brand_name?: string;
  logo_url?: string;
  favicon_url?: string;
  accent?: string;
  radius?: string;
  mode?: "light" | "dark";
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  branding: Branding;
  /** Renommage des champs integres, indexe par "<entite>.<champ>". */
  fieldLabels: FieldLabelOverrides;
  timezone: string;
  role: "owner" | "admin" | "member";
};

/**
 * Espaces dont l'utilisateur connecté est membre, du plus ancien au plus récent.
 * `cache` dédoublonne l'appel sur un même rendu (layout + page).
 */
export const getWorkspaces = cache(async (): Promise<Workspace[]> => {
  // Le layout redirige vers /setup, mais la page rend en parallèle : on sort proprement.
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      "role, workspaces!inner(id, name, slug, branding, field_labels, timezone, created_at)",
    )
    .order("created_at", { referencedTable: "workspaces", ascending: true });

  if (error) {
    console.error("[workspace] lecture des espaces impossible", error.message);
    return [];
  }

  return data.map((row) => ({
    id: row.workspaces.id,
    name: row.workspaces.name,
    slug: row.workspaces.slug,
    // branding est un jsonb : la forme n'est pas garantie par le type généré.
    branding: (row.workspaces.branding ?? {}) as Branding,
    fieldLabels: (row.workspaces.field_labels ?? {}) as FieldLabelOverrides,
    timezone: row.workspaces.timezone,
    role: row.role,
  }));
});

/** Nom du cookie qui mémorise l'espace choisi dans la Topbar. */
export const WORKSPACE_COOKIE = "kairos_ws";

/**
 * Espace actif : celui du cookie s'il est encore accessible, sinon le premier.
 * On revalide toujours contre la liste réelle : un cookie forgé ne donne accès à rien.
 */
export const getCurrentWorkspace = cache(
  async (): Promise<Workspace | null> => {
    const workspaces = await getWorkspaces();
    if (workspaces.length === 0) return null;

    const cookieStore = await cookies();
    const selectedId = cookieStore.get(WORKSPACE_COOKIE)?.value;

    return workspaces.find((w) => w.id === selectedId) ?? workspaces[0];
  },
);

/** Espace actif, ou erreur : à utiliser dans les Server Actions qui écrivent. */
export async function requireWorkspace(): Promise<Workspace> {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    throw new Error(
      "Aucun espace de travail accessible. Reconnecte-toi ; si le problème persiste, " +
        "vérifie que le trigger handle_new_user a bien créé ton espace.",
    );
  }
  return workspace;
}

/** Nom affiché : le branding white-label prime sur le nom de l'espace. */
export function displayName(workspace: Workspace | null): string {
  return workspace?.branding?.brand_name || workspace?.name || "Kairos";
}
