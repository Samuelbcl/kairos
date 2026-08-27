import { CalendarClock, Target, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Tableau de bord" };

const tiles = [
  {
    label: "Relances cette semaine",
    icon: CalendarClock,
    hint: "Disponible en Phase 3",
  },
  { label: "Valeur du pipeline", icon: Target, hint: "Disponible en Phase 2" },
  { label: "Taux de réponse", icon: TrendingUp, hint: "Disponible en Phase 5" },
];

export default async function DashboardPage() {
  const workspace = await getCurrentWorkspace();

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={
          workspace
            ? `Espace ${workspace.name} · fuseau ${workspace.timezone}`
            : "Aucun espace trouvé pour ce compte."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ label, icon: Icon, hint }) => (
          <Card key={label}>
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
              <p className="tabular text-3xl font-semibold">—</p>
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
