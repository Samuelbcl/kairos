import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type { Branding } from "@/lib/workspace";

/**
 * Branding déduit du nom d'hôte, avant toute session.
 *
 * La page de connexion et les e-mails portaient « Kairos » quel que soit le
 * client — ce qui vide le white-label de son sens dès le premier message.
 * Un client sur `client.ton-crm.be` voit sa marque avant même de se connecter.
 *
 * Lecture par service_role : personne n'est encore authentifié à ce stade.
 * Aucune donnée métier n'est exposée, seulement nom, logo et couleurs.
 */
export type HostBrand = {
  workspaceId: string | null;
  brandName: string;
  logoUrl: string | null;
  accent: string | null;
  radius: string | null;
};

const DEFAULT_BRAND: HostBrand = {
  workspaceId: null,
  brandName: "Kairos",
  logoUrl: null,
  accent: null,
  radius: null,
};

export const getHostBranding = cache(async (): Promise<HostBrand> => {
  if (!isSupabaseConfigured) return DEFAULT_BRAND;

  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "")
    .split(":")[0]
    .toLowerCase();

  if (!host) return DEFAULT_BRAND;

  try {
    const admin = createAdminClient();

    const { data: workspaceId } = await admin.rpc("workspace_for_host", {
      candidate: host,
    });
    if (!workspaceId) return DEFAULT_BRAND;

    const { data: workspace } = await admin
      .from("workspaces")
      .select("id, name, branding")
      .eq("id", workspaceId)
      .single();

    if (!workspace) return DEFAULT_BRAND;

    const branding = (workspace.branding ?? {}) as Branding;
    return {
      workspaceId: workspace.id,
      brandName: branding.brand_name || workspace.name,
      logoUrl: branding.logo_url ?? null,
      accent: branding.accent ?? null,
      radius: branding.radius ?? null,
    };
  } catch (error) {
    // Un domaine mal configuré ne doit pas empêcher de se connecter.
    console.error(
      "[branding] résolution par hôte impossible",
      error instanceof Error ? error.message : "erreur inconnue",
    );
    return DEFAULT_BRAND;
  }
});

/** Variables CSS à poser sur le conteneur, pour teinter avant connexion. */
export function brandStyle(brand: HostBrand): React.CSSProperties {
  const style: Record<string, string> = {};
  if (brand.accent) {
    style["--primary"] = brand.accent;
    style["--ring"] = brand.accent;
    style["--brand-soft"] =
      `color-mix(in oklch, ${brand.accent} 12%, var(--background))`;
  }
  if (brand.radius) style["--radius"] = brand.radius;
  return style as React.CSSProperties;
}
