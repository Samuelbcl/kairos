import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Contacts" };

export default function Page() {
  return (
    <>
      <PageHeader title="Contacts" description="Tes comptes et les personnes qui vont avec." />
      <EmptyState
        icon={Building2}
        title="Aucun contact pour l'instant."
        description="L'import CSV et l'ajout rapide arrivent en Phase 2."
      />
    </>
  );
}
