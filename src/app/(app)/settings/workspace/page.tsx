import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Settings } from "lucide-react";
import { BrandingPanel } from "@/components/settings/branding-panel";
import { StagesPanel } from "@/components/settings/stages-panel";
import { CustomFieldsPanel } from "@/components/settings/custom-fields-panel";
import { DataPanel } from "@/components/settings/data-panel";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Réglages de l'espace" };

export default async function WorkspaceSettingsPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return (
      <>
        <PageHeader title="Réglages de l'espace" />
        <EmptyState
          icon={Settings}
          title="Aucun espace actif."
          description="Reconnecte-toi pour retrouver ton espace de travail."
        />
      </>
    );
  }

  const supabase = await createClient();

  const [{ data: stages }, { data: fields }] = await Promise.all([
    supabase
      .from("stages")
      .select("id, name, color, position, probability, is_won, is_lost")
      .eq("workspace_id", workspace.id)
      .order("position"),
    supabase
      .from("custom_fields")
      .select("id, entity, key, label, type, options, position")
      .eq("workspace_id", workspace.id)
      .order("entity")
      .order("position"),
  ]);

  const canManage = workspace.role !== "member";

  return (
    <>
      <PageHeader
        title="Réglages de l'espace"
        description="Apparence, étapes du pipeline, champs personnalisés et données."
      />

      <div className="flex flex-col gap-6">
        <BrandingPanel
          workspaceName={workspace.name}
          timezone={workspace.timezone}
          branding={workspace.branding}
          canManage={canManage}
        />

        <StagesPanel stages={stages ?? []} canManage={canManage} />

        <CustomFieldsPanel
          fields={(fields ?? []).map((f) => ({
            id: f.id,
            entity: f.entity,
            key: f.key,
            label: f.label,
            type: f.type,
            options: Array.isArray(f.options) ? (f.options as string[]) : null,
          }))}
          canManage={canManage}
        />

        <DataPanel workspaceName={workspace.name} isOwner={workspace.role === "owner"} />
      </div>
    </>
  );
}
