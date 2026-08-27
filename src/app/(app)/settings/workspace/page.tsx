import { Settings } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Réglages de l'espace" };

export default function Page() {
  return (
    <>
      <PageHeader title="Réglages de l'espace" description="Branding, étapes de pipeline et champs personnalisés." />
      <EmptyState
        icon={Settings}
        title="Réglages à venir."
        description="Le thème par espace et les champs personnalisés arrivent en Phase 5."
      />
    </>
  );
}
