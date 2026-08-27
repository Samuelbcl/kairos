import { Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { MembersTable } from "@/components/settings/members-table";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import { createClient, getUser } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Membres" };

export type Member = {
  userId: string;
  role: "owner" | "admin" | "member";
  fullName: string | null;
};

export default async function MembersPage() {
  const workspace = await getCurrentWorkspace();
  const me = await getUser();

  if (!workspace) {
    return (
      <>
        <PageHeader title="Membres" />
        <EmptyState
          icon={Users}
          title="Aucun espace actif."
          description="Reconnecte-toi pour retrouver ton espace de travail."
        />
      </>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, profiles!inner(full_name)")
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("[members] lecture impossible", error.message);
  }

  type Row = {
    user_id: string;
    role: Member["role"];
    profiles: { full_name: string | null };
  };

  const members: Member[] = ((data ?? []) as unknown as Row[]).map((row) => ({
    userId: row.user_id,
    role: row.role,
    fullName: row.profiles?.full_name ?? null,
  }));

  const canManage = workspace.role !== "member";

  return (
    <>
      <PageHeader
        title="Membres"
        description={`Qui a accès à l'espace ${workspace.name}.`}
      />

      <div className="flex flex-col gap-5">
        {canManage ? <InviteMemberForm /> : null}

        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun membre listé."
            description="Si tu vois ce message alors que tu es connecté, vérifie que la migration 0001_init.sql a bien été exécutée."
          />
        ) : (
          <MembersTable
            members={members}
            currentUserId={me?.id ?? ""}
            canManage={canManage}
          />
        )}
      </div>
    </>
  );
}
