import { Target } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { KanbanBoard, type BoardDeal, type BoardStage } from "@/components/kanban/board";
import { NewDealButton } from "@/components/kanban/new-deal-button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { groupOverdueBy } from "@/lib/format";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return (
      <>
        <PageHeader title="Pipeline" />
        <EmptyState
          icon={Target}
          title="Aucun espace actif."
          description="Reconnecte-toi pour retrouver ton espace de travail."
        />
      </>
    );
  }

  const supabase = await createClient();

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .eq("is_default", true)
    .limit(1)
    .single();

  if (!pipeline) {
    return (
      <>
        <PageHeader title="Pipeline" />
        <EmptyState
          icon={Target}
          title="Aucun pipeline configuré."
          description="Vérifie que la migration 0001_init.sql a bien été exécutée sur ta base."
        />
      </>
    );
  }

  const [{ data: stages }, { data: deals }] = await Promise.all([
    supabase
      .from("stages")
      .select("id, name, color, position, probability, is_won, is_lost")
      .eq("pipeline_id", pipeline.id)
      .order("position"),
    supabase
      .from("deals")
      .select(
        "id, title, value, currency, priority, status, stage_id, expected_close, last_activity_at, companies(id, name)",
      )
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  // Relances en cours, pour signaler les cartes en retard.
  const { data: openTasks } = await supabase
    .from("tasks")
    .select("deal_id, due_at")
    .eq("workspace_id", workspace.id)
    .eq("done", false)
    .not("deal_id", "is", null);

  const overdueByDeal = groupOverdueBy(openTasks ?? [], (task) => task.deal_id);

  const boardStages: BoardStage[] = (stages ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    probability: s.probability,
    isWon: s.is_won,
    isLost: s.is_lost,
  }));

  const boardDeals: BoardDeal[] = (deals ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    value: Number(d.value ?? 0),
    currency: d.currency,
    priority: d.priority,
    stageId: d.stage_id,
    companyId: d.companies?.id ?? null,
    companyName: d.companies?.name ?? null,
    lastActivityAt: d.last_activity_at,
    overdueTasks: overdueByDeal.get(d.id) ?? 0,
  }));

  return (
    // Hauteur d'ecran pour cette page seulement : c'est ce qui garde la barre
    // de defilement horizontale du tableau visible au lieu de la repousser
    // sous le pli des que les colonnes s'allongent.
    <div className="flex h-full flex-col">
      <PageHeader
        title="Pipeline"
        description={`${pipeline.name} · ${boardDeals.length} opportunité${boardDeals.length > 1 ? "s" : ""}`}
        action={<NewDealButton stages={boardStages} />}
      />

      {boardStages.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Ce pipeline n'a aucune étape."
          description="Ajoute des étapes dans Réglages → Espace pour commencer à suivre tes opportunités."
        />
      ) : (
        <KanbanBoard
          stages={boardStages}
          deals={boardDeals}
          canManage={workspace.role !== "member"}
        />
      )}
    </div>
  );
}
