import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { TrashList, type TrashedRow } from "@/components/settings/trash-list";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { fullName } from "@/lib/format";

export const metadata = { title: "Corbeille" };

export default async function TrashPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return (
      <>
        <PageHeader title="Corbeille" />
        <EmptyState
          icon={Trash2}
          title="Aucun espace actif."
          description="Reconnecte-toi pour retrouver ton espace de travail."
        />
      </>
    );
  }

  const supabase = await createClient();

  const [{ data: companies }, { data: contacts }, { data: deals }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, deleted_at")
      .eq("workspace_id", workspace.id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, deleted_at")
      .eq("workspace_id", workspace.id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200),
    supabase
      .from("deals")
      .select("id, title, deleted_at")
      .eq("workspace_id", workspace.id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200),
  ]);

  const rows: TrashedRow[] = [
    ...(companies ?? []).map((row) => ({
      id: row.id,
      entity: "company" as const,
      label: row.name,
      deletedAt: row.deleted_at!,
    })),
    ...(contacts ?? []).map((row) => ({
      id: row.id,
      entity: "contact" as const,
      label: fullName(row.first_name, row.last_name) || "Sans nom",
      deletedAt: row.deleted_at!,
    })),
    ...(deals ?? []).map((row) => ({
      id: row.id,
      entity: "deal" as const,
      label: row.title,
      deletedAt: row.deleted_at!,
    })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  return (
    <>
      <PageHeader
        title="Corbeille"
        description="Ce qui a été supprimé ces trente derniers jours. Au-delà, c'est effacé définitivement."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="La corbeille est vide."
          description="Tout ce que tu supprimes atterrit ici et reste récupérable un mois."
        />
      ) : (
        <TrashList rows={rows} />
      )}
    </>
  );
}
