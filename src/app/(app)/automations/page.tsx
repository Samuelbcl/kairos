import { Zap } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { AutomationList } from "@/components/automations/automation-list";
import { RecipeGallery } from "@/components/automations/recipe-gallery";
import { RunLog } from "@/components/automations/run-log";
import { RuleDialog } from "@/components/automations/rule-dialog";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { Action, Condition, Trigger } from "@/lib/automations/types";

export const metadata = { title: "Automatisations" };

export default async function AutomationsPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return (
      <>
        <PageHeader title="Automatisations" />
        <EmptyState
          icon={Zap}
          title="Aucun espace actif."
          description="Reconnecte-toi pour retrouver ton espace de travail."
        />
      </>
    );
  }

  const supabase = await createClient();

  const [{ data: rows }, { data: stages }, { data: runs }] = await Promise.all([
    supabase
      .from("automations")
      .select("id, name, enabled, trigger, conditions, actions, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("stages")
      .select("id, name, color")
      .eq("workspace_id", workspace.id)
      .order("position"),
    supabase
      .from("automation_runs")
      .select("id, status, detail, created_at, automations(name)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const rules = (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    trigger: row.trigger as unknown as Trigger,
    conditions: (row.conditions ?? []) as unknown as Condition[],
    actions: (row.actions ?? []) as unknown as Action[],
  }));

  const installedTriggers = new Set(rules.map((r) => r.name));

  return (
    <>
      <PageHeader
        title="Automatisations"
        description="Quand il se passe quelque chose, Kairos agit à ta place."
        action={<RuleDialog stages={stages ?? []} />}
      />

      <div className="flex flex-col gap-6">
        {rules.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="Aucune automatisation active."
            description="Active une recette ci-dessous, ou compose ta propre règle. La plus utile : une relance créée automatiquement dès qu'un prospect passe en « Contacté »."
          />
        ) : (
          <AutomationList rules={rules} stages={stages ?? []} />
        )}

        <section>
          <h2 className="mb-1 text-sm font-medium">Recettes prêtes à l&apos;emploi</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Un clic, aucune configuration. Tu pourras les modifier ensuite.
          </p>
          <RecipeGallery installed={installedTriggers} />
        </section>

        {runs && runs.length > 0 ? (
          <section>
            <h2 className="mb-3 text-sm font-medium">Journal des exécutions</h2>
            <RunLog
              runs={runs.map((run) => ({
                id: run.id,
                status: run.status,
                detail: run.detail as Record<string, unknown> | null,
                createdAt: run.created_at,
                ruleName: run.automations?.name ?? "Règle supprimée",
              }))}
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
