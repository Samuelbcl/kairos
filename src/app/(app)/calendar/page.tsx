import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import {
  CalendarView,
  type CalendarEvent,
  type CalendarTask,
} from "@/components/tasks/calendar-view";
import { SyncCalendarButton } from "@/components/tasks/sync-calendar-button";
import {
  getWorkspaceIntegration,
  listExternalEvents,
} from "@/lib/integrations/calendar";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Calendrier" };

export default async function CalendarPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return (
      <>
        <PageHeader title="Calendrier" />
        <EmptyState
          icon={CalendarDays}
          title="Aucun espace actif."
          description="Reconnecte-toi pour retrouver ton espace de travail."
        />
      </>
    );
  }

  const supabase = await createClient();

  // Trois mois autour d'aujourd'hui : de quoi naviguer sans recharger, sans
  // tirer l'historique complet.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);

  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_at, done, priority, external_event_id, companies(id, name)")
    .eq("workspace_id", workspace.id)
    .gte("due_at", from.toISOString())
    .lte("due_at", to.toISOString())
    .order("due_at");

  const tasks: CalendarTask[] = (data ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    dueAt: task.due_at,
    done: task.done,
    priority: task.priority,
    syncedToCalendar: Boolean(task.external_event_id),
    companyId: task.companies?.id ?? null,
    companyName: task.companies?.name ?? null,
  }));

  // Les vrais rendez-vous de l'agenda connecte, en lecture seule. Sans eux, on
  // programme des relances sur des creneaux deja pris.
  const integration = await getWorkspaceIntegration(supabase, workspace.id);
  const syncedEventIds = new Set(
    (data ?? []).map((task) => task.external_event_id).filter(Boolean),
  );

  const events: CalendarEvent[] = integration
    ? (await listExternalEvents(integration, from, to))
        // Une relance deja affichee comme telle ne doit pas revenir en double.
        .filter((event) => !syncedEventIds.has(event.id))
        .map((event) => ({
          id: event.id,
          title: event.title,
          start: event.start,
          allDay: event.allDay,
          link: event.link,
        }))
    : [];

  return (
    <>
      <PageHeader
        title="Calendrier"
        description={
          integration
            ? "Tes relances et tes rendez-vous, mois par mois. Glisse une relance pour la reporter."
            : "Tes relances mois par mois. Connecte un agenda pour y voir aussi tes rendez-vous."
        }
        action={integration ? <SyncCalendarButton /> : null}
      />

      {tasks.length === 0 && events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Aucune relance sur cette période."
          description="Programme-en une depuis une fiche, ou depuis la vue Aujourd'hui."
        />
      ) : (
        <CalendarView tasks={tasks} events={events} />
      )}
    </>
  );
}
