import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Settings } from "lucide-react";
import { BrandingPanel } from "@/components/settings/branding-panel";
import { StagesPanel } from "@/components/settings/stages-panel";
import { TagsPanel, type WorkspaceTag } from "@/components/settings/tags-panel";
import { CustomFieldsPanel } from "@/components/settings/custom-fields-panel";
import { FieldLabelsPanel } from "@/components/settings/field-labels-panel";
import { DataPanel } from "@/components/settings/data-panel";
import { TourPanel } from "@/components/settings/tour-panel";
import { createClient, getUser } from "@/lib/supabase/server";
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
  const user = await getUser();

  const [{ data: stages }, { data: fields }, { data: tagRows }, { data: taggedCompanies }, { data: taggedContacts }] =
    await Promise.all([
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
    supabase
      .from("tags")
      .select("name, color")
      .eq("workspace_id", workspace.id)
      .order("name"),
    supabase.from("companies").select("tags").eq("workspace_id", workspace.id),
    supabase.from("contacts").select("tags").eq("workspace_id", workspace.id),
  ]);

  // Combien de fiches portent chaque tag : indispensable avant d'en supprimer un.
  const usage: Record<string, number> = {};
  for (const row of [...(taggedCompanies ?? []), ...(taggedContacts ?? [])]) {
    for (const tag of row.tags ?? []) usage[tag] = (usage[tag] ?? 0) + 1;
  }

  const tags: WorkspaceTag[] = (tagRows ?? []).map((tag) => ({
    name: tag.name,
    color: tag.color,
    usage: usage[tag.name] ?? 0,
  }));

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("tour_completed_at")
        .eq("id", user.id)
        .single()
    : { data: null };

  const canManage = workspace.role !== "member";

  return (
    <>
      <PageHeader
        title="Réglages de l'espace"
        description="Apparence, étapes du pipeline, champs personnalisés et données."
      />

      <div className="flex flex-col gap-6">
        <BrandingPanel
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          timezone={workspace.timezone}
          branding={workspace.branding}
          canManage={canManage}
        />

        <StagesPanel stages={stages ?? []} canManage={canManage} />

        <TagsPanel tags={tags} canManage={canManage} />

        {canManage ? <FieldLabelsPanel labels={workspace.fieldLabels} /> : null}

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

        <TourPanel completedAt={profile?.tour_completed_at ?? null} />

        <DataPanel workspaceName={workspace.name} isOwner={workspace.role === "owner"} />
      </div>
    </>
  );
}
