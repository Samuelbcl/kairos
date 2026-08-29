import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

type Client = SupabaseClient<Database>;

export type PlanLimits = {
  id: string;
  name: string;
  maxMembers: number | null;
  maxCompanies: number | null;
  maxAutomations: number | null;
  priceEur: number;
};

export type Usage = {
  members: number;
  companies: number;
  automations: number;
  tasksOpen: number;
};

export type Quota = {
  plan: PlanLimits;
  usage: Usage;
  /** Ce qui est déjà au plafond, à afficher avant que ça bloque. */
  atLimit: ("members" | "companies" | "automations")[];
};

const FALLBACK: PlanLimits = {
  id: "free",
  name: "Découverte",
  maxMembers: 1,
  maxCompanies: 200,
  maxAutomations: 2,
  priceEur: 0,
};

export async function getQuota(
  supabase: Client,
  workspaceId: string,
): Promise<Quota> {
  const [{ data: workspace }, { data: usageRows }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("plan_id, plans(id, name, max_members, max_companies, max_automations, price_eur)")
      .eq("id", workspaceId)
      .single(),
    supabase.rpc("workspace_usage", { ws: workspaceId }),
  ]);

  const row = workspace?.plans;
  const plan: PlanLimits = row
    ? {
        id: row.id,
        name: row.name,
        maxMembers: row.max_members,
        maxCompanies: row.max_companies,
        maxAutomations: row.max_automations,
        priceEur: row.price_eur,
      }
    : FALLBACK;

  const first = Array.isArray(usageRows) ? usageRows[0] : usageRows;
  const usage: Usage = {
    members: first?.members ?? 0,
    companies: first?.companies ?? 0,
    automations: first?.automations ?? 0,
    tasksOpen: first?.tasks_open ?? 0,
  };

  const atLimit: Quota["atLimit"] = [];
  if (plan.maxMembers !== null && usage.members >= plan.maxMembers) atLimit.push("members");
  if (plan.maxCompanies !== null && usage.companies >= plan.maxCompanies) {
    atLimit.push("companies");
  }
  if (plan.maxAutomations !== null && usage.automations >= plan.maxAutomations) {
    atLimit.push("automations");
  }

  return { plan, usage, atLimit };
}

/**
 * Vérifie qu'une création reste dans le plan.
 *
 * Renvoie un message prêt à afficher plutôt qu'un booléen : « limite atteinte »
 * sans dire laquelle ni comment la lever n'aide personne.
 */
export async function checkQuota(
  supabase: Client,
  workspaceId: string,
  resource: "members" | "companies" | "automations",
  /** Combien on s'apprête à créer. */
  incoming = 1,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const { plan, usage } = await getQuota(supabase, workspaceId);

  const limits = {
    members: plan.maxMembers,
    companies: plan.maxCompanies,
    automations: plan.maxAutomations,
  };
  const labels = {
    members: "membres",
    companies: "entreprises",
    automations: "automatisations actives",
  };

  const max = limits[resource];
  if (max === null) return { allowed: true };
  if (usage[resource] + incoming <= max) return { allowed: true };

  return {
    allowed: false,
    reason:
      `Le plan ${plan.name} est limité à ${max} ${labels[resource]} ` +
      `(${usage[resource]} utilisée${usage[resource] > 1 ? "s" : ""}). ` +
      `Passe à un plan supérieur dans Réglages → Espace pour continuer.`,
  };
}
