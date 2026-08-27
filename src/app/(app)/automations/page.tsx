import { Zap } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Automatisations" };

export default function Page() {
  return (
    <>
      <PageHeader title="Automatisations" description="Quand il se passe X, Kairos fait Y." />
      <EmptyState
        icon={Zap}
        title="Aucune automatisation."
        description="Le moteur de règles arrive en Phase 4."
      />
    </>
  );
}
