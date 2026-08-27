import { Target } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Pipeline" };

export default function Page() {
  return (
    <>
      <PageHeader title="Pipeline" description="Tes opportunités, étape par étape." />
      <EmptyState
        icon={Target}
        title="Le kanban arrive en Phase 2."
        description="Les étapes viendront de la table stages, personnalisables par espace."
      />
    </>
  );
}
