import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Aujourd'hui" };

export default function Page() {
  return (
    <>
      <PageHeader title="Aujourd'hui" description="Tes relances du jour, en retard et à venir." />
      <EmptyState
        icon={CalendarClock}
        title="Rien à relancer pour l'instant."
        description="Les relances arrivent en Phase 3, avec la synchronisation Google Agenda."
      />
    </>
  );
}
