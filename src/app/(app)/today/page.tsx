import { CalendarCheck2, CalendarClock, Moon } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { TaskList, type ListTask } from "@/components/tasks/task-list";
import { StaleDeals, type StaleDeal } from "@/components/tasks/stale-deals";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Aujourd'hui" };

/** Une opportunité sans activité depuis ce délai mérite une relance. */
const STALE_DAYS = 14;

export default async function TodayPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return (
      <>
        <PageHeader title="Aujourd'hui" />
        <EmptyState
          icon={CalendarClock}
          title="Aucun espace actif."
          description="Reconnecte-toi pour retrouver ton espace de travail."
        />
      </>
    );
  }

  const supabase = await createClient();

  // Bornes calculées côté serveur, dans le fuseau de l'espace.
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const inSevenDays = new Date(endOfToday.getTime() + 7 * 86_400_000);
  const staleBefore = new Date(now.getTime() - STALE_DAYS * 86_400_000);

  const [{ data: openTasks }, { data: doneToday }, { data: staleDeals }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, kind, due_at, priority, done, external_event_id, companies(id, name), contacts(id, first_name, last_name), deals(id, title)",
        )
        .eq("workspace_id", workspace.id)
        .eq("done", false)
        .lte("due_at", inSevenDays.toISOString())
        .order("due_at"),
      supabase
        .from("tasks")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("done", true)
        .gte("done_at", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()),
      supabase
        .from("deals")
        .select("id, title, value, currency, last_activity_at, companies(id, name), stages(name, color)")
        .eq("workspace_id", workspace.id)
        .eq("status", "open")
        .is("deleted_at", null)
        .lt("last_activity_at", staleBefore.toISOString())
        .order("last_activity_at")
        .limit(10),
    ]);

  const tasks: ListTask[] = (openTasks ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    kind: task.kind,
    dueAt: task.due_at,
    priority: task.priority,
    syncedToCalendar: Boolean(task.external_event_id),
    company: task.companies ? { id: task.companies.id, name: task.companies.name } : null,
    contactId: task.contacts?.id ?? null,
    contactName: task.contacts
      ? [task.contacts.first_name, task.contacts.last_name].filter(Boolean).join(" ")
      : null,
    dealTitle: task.deals?.title ?? null,
  }));

  const endOfTodayMs = endOfToday.getTime();
  const nowMs = now.getTime();

  const overdue = tasks.filter((t) => new Date(t.dueAt).getTime() < nowMs);
  const today = tasks.filter((t) => {
    const time = new Date(t.dueAt).getTime();
    return time >= nowMs && time <= endOfTodayMs;
  });
  const upcoming = tasks.filter((t) => new Date(t.dueAt).getTime() > endOfTodayMs);

  const stale: StaleDeal[] = (staleDeals ?? []).map((deal) => ({
    id: deal.id,
    title: deal.title,
    value: Number(deal.value ?? 0),
    currency: deal.currency,
    lastActivityAt: deal.last_activity_at,
    companyId: deal.companies?.id ?? null,
    companyName: deal.companies?.name ?? null,
    stageName: deal.stages?.name ?? null,
    stageColor: deal.stages?.color ?? null,
  }));

  const completedToday = doneToday?.length ?? 0;
  const allClear = overdue.length === 0 && today.length === 0;

  return (
    <>
      <PageHeader
        title="Aujourd'hui"
        description={
          completedToday > 0
            ? `${completedToday} relance${completedToday > 1 ? "s" : ""} terminée${completedToday > 1 ? "s" : ""} aujourd'hui.`
            : "Tes relances du jour, en retard et à venir."
        }
      />

      <div className="flex flex-col gap-6">
        {allClear ? (
          <EmptyState
            icon={CalendarCheck2}
            title="Tout est à jour."
            description={
              upcoming.length > 0
                ? `Rien à faire maintenant. ${upcoming.length} relance${upcoming.length > 1 ? "s" : ""} arrive${upcoming.length > 1 ? "nt" : ""} dans les jours qui viennent.`
                : "Aucune relance en retard ni prévue aujourd'hui."
            }
          />
        ) : null}

        {overdue.length > 0 ? (
          <TaskList
            title="En retard"
            tone="danger"
            tasks={overdue}
            count={overdue.length}
          />
        ) : null}

        {today.length > 0 ? (
          <TaskList title="Aujourd'hui" tasks={today} count={today.length} />
        ) : null}

        {upcoming.length > 0 ? (
          <TaskList
            title="Les 7 prochains jours"
            tasks={upcoming}
            count={upcoming.length}
            muted
          />
        ) : null}

        {stale.length > 0 ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Moon className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
              Opportunités qui dorment
              <span className="tabular text-xs font-normal text-muted-foreground">
                {stale.length}
              </span>
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Aucune activité depuis plus de {STALE_DAYS} jours. Une relance ne coûte rien.
            </p>
            <StaleDeals deals={stale} />
          </section>
        ) : null}
      </div>
    </>
  );
}
