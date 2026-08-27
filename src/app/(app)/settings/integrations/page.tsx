import { Plug } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Intégrations" };

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Intégrations"
        description="Connecte ton agenda pour que chaque relance devienne un vrai rappel."
      />
      <EmptyState
        icon={Plug}
        title="Aucune intégration connectée."
        description="Google Agenda arrive en Phase 3, Microsoft Outlook en Phase 4."
      />
    </>
  );
}
