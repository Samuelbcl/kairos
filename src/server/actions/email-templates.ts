"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { firstIssue } from "@/lib/validators/common";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";
import { renderTemplate } from "@/lib/email-variables";
import { sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/activities";

const templateSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Donne un nom au modèle.").max(80),
  subject: z.string().trim().max(200).default(""),
  body: z.string().max(20000).default(""),
});

export async function saveEmailTemplate(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const user = await getUser();
  const supabase = await createClient();
  const { id, ...fields } = parsed.data;

  const query = id
    ? supabase
        .from("email_templates")
        .update(fields)
        .eq("id", id)
        .eq("workspace_id", workspace.id)
    : supabase
        .from("email_templates")
        .insert({ ...fields, workspace_id: workspace.id, created_by: user?.id ?? null });

  const { data, error } = await query.select("id").single();

  if (error) {
    if (error.code === "23505") return fail("Un modèle porte déjà ce nom.");
    console.error("[modèles] enregistrement impossible", error.message);
    return fail(pgError(error, "Enregistrement impossible. Réessaie."));
  }

  revalidatePath("/settings/emails");
  revalidatePath("/automations");
  return ok({ id: data.id });
}

export async function deleteEmailTemplate(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return fail(pgError(error, "Suppression refusée."));

  revalidatePath("/settings/emails");
  return ok(undefined);
}

/**
 * Envoie un modèle à une entreprise depuis sa fiche.
 *
 * L'envoi manuel manquait complètement : jusqu'ici un e-mail ne partait que
 * par une automatisation, donc jamais quand on en avait besoin sur le moment.
 */
export async function sendTemplateToCompany(
  templateId: string,
  companyId: string,
): Promise<ActionResult<{ to: string }>> {
  const workspace = await requireWorkspace();
  const user = await getUser();
  const supabase = await createClient();

  const [{ data: template }, { data: company }, { data: profile }] = await Promise.all([
    supabase
      .from("email_templates")
      .select("name, subject, body")
      .eq("id", templateId)
      .eq("workspace_id", workspace.id)
      .single(),
    supabase
      .from("companies")
      .select("id, name, email, city, sector")
      .eq("id", companyId)
      .eq("workspace_id", workspace.id)
      .single(),
    user
      ? supabase.from("profiles").select("full_name").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!template) return fail("Ce modèle n'existe plus. Recharge la page.");
  if (!company) return fail("Cette entreprise n'existe plus. Recharge la page.");
  if (!company.email) {
    return fail(
      `${company.name} n'a pas d'adresse e-mail. Ajoute-la sur la fiche, puis réessaie.`,
    );
  }

  const context = {
    company,
    user: { full_name: profile?.full_name ?? "" },
    today: new Intl.DateTimeFormat("fr-BE", { dateStyle: "long" }).format(new Date()),
  };

  const result = await sendEmail({
    to: company.email,
    subject: renderTemplate(template.subject, context),
    text: renderTemplate(template.body, context),
    replyTo: user?.email,
  });

  if (!result.sent) return fail(result.error ?? "Envoi refusé.");

  await logActivity(supabase, {
    workspaceId: workspace.id,
    subjectType: "company",
    subjectId: companyId,
    type: "email",
    content: `E-mail envoyé à ${company.email} — ${template.name}`,
  });

  revalidatePath(`/companies/${companyId}`);
  return ok({ to: company.email });
}
