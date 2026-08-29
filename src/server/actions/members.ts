"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { requireWorkspace } from "@/lib/workspace";
import { checkQuota } from "@/lib/plans";
import { fail, type ActionResult } from "@/server/actions/types";

const roleSchema = z.enum(["owner", "admin", "member"]);

const inviteSchema = z.object({
  email: z.email("Adresse e-mail invalide."),
  role: roleSchema.exclude(["owner"]),
});

const changeRoleSchema = z.object({
  userId: z.uuid(),
  role: roleSchema,
});

/**
 * Invite quelqu'un dans l'espace actif.
 *
 * Deux cas : soit la personne a déjà un compte Kairos et on l'ajoute directement,
 * soit on lui envoie une invitation Supabase (nécessite le service_role, d'où
 * le client admin — mais l'autorisation est vérifiée avant, via la RLS).
 */
export async function inviteMember(
  formData: FormData,
): Promise<ActionResult<{ message: string }>> {
  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    role: String(formData.get("role") ?? "member"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const workspace = await requireWorkspace();
  if (workspace.role === "member") {
    return {
      ok: false,
      error: "Seuls les propriétaires et administrateurs peuvent inviter.",
    };
  }

  const { email, role } = parsed.data;

  const supabaseForQuota = await createClient();
  const quota = await checkQuota(supabaseForQuota, workspace.id, "members");
  if (!quota.allowed) return fail(quota.reason);

  const admin = createAdminClient();

  // La personne a-t-elle déjà un compte ?
  const { data: existing, error: lookupError } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (lookupError) {
    console.error("[members] recherche du compte impossible", lookupError.message);
    return {
      ok: false,
      error: "Impossible de vérifier ce compte. Réessaie dans un instant.",
    };
  }

  const match = existing.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  let userId = match?.id;
  let invited = false;

  if (!userId) {
    // `invited_to_workspace` empêche handle_new_user de créer un espace perso :
    // la personne rejoint celui qui l'invite, elle n'en a pas besoin d'un second.
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${env.appUrl}/auth/callback`,
      data: { invited_to_workspace: true },
    });
    if (error) {
      console.error("[members] invitation impossible", error.message);
      return {
        ok: false,
        error: `Invitation impossible : ${error.message}. Vérifie que Resend/SMTP est configuré dans Supabase → Authentication → Emails.`,
      };
    }
    userId = data.user.id;
    invited = true;
  }

  // L'ajout au workspace passe par le client utilisateur : la RLS vérifie
  // que l'appelant est bien admin de cet espace.
  const supabase = await createClient();
  const { error: memberError } = await supabase
    .from("workspace_members")
    .upsert(
      { workspace_id: workspace.id, user_id: userId, role },
      { onConflict: "workspace_id,user_id" },
    );

  if (memberError) {
    console.error("[members] ajout au workspace impossible", memberError.message);
    return {
      ok: false,
      error:
        "Le compte existe mais n'a pas pu être ajouté à l'espace. Vérifie ton rôle dans Réglages → Membres.",
    };
  }

  revalidatePath("/settings/members");
  return {
    ok: true,
    data: {
      message: invited
        ? `Invitation envoyée à ${email}.`
        : `${email} a été ajouté à l'espace.`,
    },
  };
}

/** Change le rôle d'un membre. Un espace garde toujours au moins un propriétaire. */
export async function changeMemberRole(
  userId: string,
  role: string,
): Promise<ActionResult> {
  const parsed = changeRoleSchema.safeParse({ userId, role });
  if (!parsed.success) {
    return { ok: false, error: "Rôle ou membre invalide." };
  }

  const workspace = await requireWorkspace();
  if (workspace.role === "member") {
    return { ok: false, error: "Seuls les administrateurs peuvent changer un rôle." };
  }

  const supabase = await createClient();

  // Ne pas retirer le dernier propriétaire.
  if (parsed.data.role !== "owner") {
    const { count } = await supabase
      .from("workspace_members")
      .select("user_id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("role", "owner");

    const { data: target } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace.id)
      .eq("user_id", parsed.data.userId)
      .single();

    if ((target as { role?: string } | null)?.role === "owner" && (count ?? 0) <= 1) {
      return {
        ok: false,
        error:
          "Cet espace doit garder au moins un propriétaire. Nomme d'abord quelqu'un d'autre.",
      };
    }
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role: parsed.data.role })
    .eq("workspace_id", workspace.id)
    .eq("user_id", parsed.data.userId);

  if (error) {
    console.error("[members] changement de rôle impossible", error.message);
    return {
      ok: false,
      error: "Changement de rôle refusé. Vérifie que tu es administrateur de cet espace.",
    };
  }

  revalidatePath("/settings/members");
  return { ok: true, data: undefined };
}

/** Retire un membre de l'espace actif. */
export async function removeMember(userId: string): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Membre invalide." };

  const workspace = await requireWorkspace();
  if (workspace.role === "member") {
    return { ok: false, error: "Seuls les administrateurs peuvent retirer un membre." };
  }

  const me = await getUser();
  if (me?.id === userId) {
    return {
      ok: false,
      error: "Tu ne peux pas te retirer toi-même. Demande à un autre administrateur.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId);

  if (error) {
    console.error("[members] retrait impossible", error.message);
    return { ok: false, error: "Retrait refusé. Vérifie ton rôle dans cet espace." };
  }

  revalidatePath("/settings/members");
  return { ok: true, data: undefined };
}
