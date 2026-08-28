import Link from "next/link";
import {
  CalendarClock,
  CircleCheck,
  Flame,
  LayoutDashboard,
  TrendingUp,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineBars } from "@/components/dashboard/pipeline-bars";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { formatMoney, formatRelative } from "@/lib/format";

export const metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return (
      <>
        <PageHeader title="Tableau de bord" />
        <EmptyState
          icon={LayoutDashboard}
          title="Aucun espace actif."
          description="Reconnecte-toi pour retrouver ton espace de travail."
        />
      </>
    );
  }

  const supabase = await createClient();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // lundi
  weekStart.setHours(0, 0, 0, 0);

  const [
    { count: companiesCount },
    { data: openDeals },
    { data: allDeals },
    { data: openTasks },
    { count: doneThisWeek },
    { data: stages },
    { data: recentActivity },
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id),
    supabase
      .from("deals")
      .select("id, value, stage_id")
      .eq("workspace_id", workspace.id)
      .eq("status", "open"),
    supabase
      .from("deals")
      .select("id, status")
      .eq("workspace_id", workspace.id),
    supabase
      .from("tasks")
      .select("id, due_at")
      .eq("workspace_id", workspace.id)
      .eq("done", false),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("done", true)
      .gte("done_at", weekStart.toISOString()),
    supabase
      .from("stages")
      .select("id, name, color, position")
      .eq("workspace_id", workspace.id)
      .order("position"),
    supabase
      .from("activities")
      .select("id, type, content, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const nowMs = now.getTime();
  const overdueCount = (openTasks ?? []).filter(
    (task) => new Date(task.due_at).getTime() < nowMs,
  ).length;

  const pipelineValue = (openDeals ?? []).reduce(
    (sum, deal) => sum + Number(deal.value ?? 0),
    0,
  );

  const total = allDeals?.length ?? 0;
  const won = (allDeals ?? []).filter((d) => d.status === "won").length;
  const lost = (allDeals ?? []).filter((d) => d.status === "lost").length;
  const closed = won + lost;
  const winRate = closed > 0 ? Math.round((won / closed) * 100) : null;

  const byStage = (stages ?? []).map((stage) => {
    const deals = (openDeals ?? []).filter((d) => d.stage_id === stage.id);
    return {
      id: stage.id,
      name: stage.name,
      color: stage.color,
      count: deals.length,
      value: deals.reduce((sum, d) => sum + Number(d.value ?? 0), 0),
    };
  });

  const isEmpty = (companiesCount ?? 0) === 0 && total === 0;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={`${workspace.name} · fuseau ${workspace.timezone}`}
      />

      {isEmpty ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Ton espace est encore vide."
          description="Importe ton tableur pour démarrer, ou ajoute ta première entreprise avec ⌘K."
          action={
            <Button
              nativeButton={false}
              render={<Link href="/contacts/import" />}
            >
              Importer un CSV
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Relances à faire"
              value={String(openTasks?.length ?? 0)}
              hint={
                overdueCount > 0
                  ? `dont ${overdueCount} en retard`
                  : "aucune en retard"
              }
              tone={overdueCount > 0 ? "danger" : undefined}
              icon={CalendarClock}
              href="/today"
            />
            <StatCard
              label="Faites cette semaine"
              value={String(doneThisWeek ?? 0)}
              hint="depuis lundi"
              icon={Flame}
            />
            <StatCard
              label="Valeur du pipeline"
              value={formatMoney(pipelineValue)}
              hint={`${openDeals?.length ?? 0} opportunité${(openDeals?.length ?? 0) > 1 ? "s" : ""} ouverte${(openDeals?.length ?? 0) > 1 ? "s" : ""}`}
              icon={Target}
              href="/pipeline"
            />
            <StatCard
              label="Taux de réussite"
              value={winRate === null ? "—" : `${winRate} %`}
              hint={
                winRate === null
                  ? "aucune affaire encore close"
                  : `${won} gagnée${won > 1 ? "s" : ""} · ${lost} perdue${lost > 1 ? "s" : ""}`
              }
              icon={TrendingUp}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pipeline par étape</CardTitle>
              </CardHeader>
              <CardContent>
                <PipelineBars stages={byStage} total={pipelineValue} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Activité récente</CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivity?.length ? (
                  <ul className="flex flex-col gap-2.5">
                    {recentActivity.map((activity) => (
                      <li key={activity.id} className="flex items-start gap-2">
                        <CircleCheck
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {activity.content ?? "Événement"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelative(activity.created_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Rien encore. L&apos;activité apparaîtra ici au fil de tes
                    échanges.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof CalendarClock;
  href?: string;
  tone?: "danger";
}) {
  const content = (
    <Card
      className={
        href ? "transition-colors duration-150 hover:border-primary" : undefined
      }
    >
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon
          className="size-4 text-muted-foreground"
          strokeWidth={1.75}
          aria-hidden
        />
      </CardHeader>
      <CardContent>
        <p className="tabular text-3xl font-semibold">{value}</p>
        <p
          className={
            tone === "danger"
              ? "mt-1 text-xs text-danger"
              : "mt-1 text-xs text-muted-foreground"
          }
        >
          {hint}
        </p>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
