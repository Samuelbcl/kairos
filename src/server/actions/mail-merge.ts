"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { firstIssue } from "@/lib/validators/common";
import { renderTemplate } from "@/lib/email-variables";
import { getIntegration } from "@/lib/integrations/calendar";
import { createGmailDraft } from "@/lib/integrations/google";
import { decrypt } from "@/lib/crypto";
import { fail, ok, type ActionResult } from "@/server/actions/types";

const schema = z.object({
  templateId: z.uuid("Choisis un modèle."),
  companyIds: z
    .array(z.uuid())
    .min(1, "Sélectionne au moins une entreprise.")
    .max(100, "Cent entreprises au maximum par publipostage."),
});

export type MergeReport = {
  created: number;
  skipped: { name: string; reason: string }[];
};

/**
 * Prépare un publipostage sous forme de brouillons Gmail.
 *
 * Un brouillon par entreprise, personnalisé avec le modèle choisi, déposé dans
 * la boîte de l'utilisateur. Rien n'est envoyé : il relit et expédie depuis
 * Gmail. Trois raisons à ce choix plutôt qu'un envoi direct depuis Kairos :
 *
 *  - les messages partent de sa vraie adresse, avec sa signature, et les
 *    réponses arrivent dans sa boîte, pas dans un service tiers ;
 *  - la réputation d'expéditeur reste celle de son domaine, qu'il maîtrise ;
 *  - une relecture avant départ évite d'envoyer trente fois la même faute.
 *
 * Les entreprises sans adresse sont ignorées et listées dans le rapport : un
 * publipostage silencieusement incomplet est pire qu'un publipostage refusé.
 */
export async function createMailMerge(
  input: unknown,
): Promise<ActionResult<MergeReport>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const user = await getUser();
  if (!user) return fail("Session expirée. Reconnecte-toi.");

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const integration = await getIntegration(supabase, workspace.id, user.id);
  if (!integration || integration.provider !== "google") {
    return fail(
      "Aucun compte Google connecté. Va dans Réglages → Intégrations pour en relier un.",
    );
  }

  const [{ data: template }, { data: companies }, { data: contacts }] =
    await Promise.all([
      supabase
        .from("email_templates")
        .select("id, name, subject, body")
        .eq("id", parsed.data.templateId)
        .eq("workspace_id", workspace.id)
        .single(),
      supabase
        .from("companies")
        .select("id, name, email, city, sector")
        .eq("workspace_id", workspace.id)
        .in("id", parsed.data.companyIds)
        .is("deleted_at", null),
      // Un interlocuteur nomme vaut mieux qu'un « Bonjour » anonyme : on prend
      // le premier contact connu de chaque entreprise, s'il y en a un.
      supabase
        .from("contacts")
        .select("company_id, first_name, last_name, email, role_title, created_at")
        .eq("workspace_id", workspace.id)
        .in("company_id", parsed.data.companyIds)
        .is("deleted_at", null)
        .order("created_at"),
    ]);

  if (!template) return fail("Modèle introuvable.");
  if (!companies?.length) return fail("Aucune entreprise sélectionnée.");

  const accessToken = decrypt(integration.access_token_enc);
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";
  const today = new Intl.DateTimeFormat("fr-BE", { dateStyle: "long" }).format(
    new Date(),
  );

  type Contact = NonNullable<typeof contacts>[number];
  const contactByCompany = new Map<string, Contact>();
  for (const contact of contacts ?? []) {
    if (contact.company_id && !contactByCompany.has(contact.company_id)) {
      contactByCompany.set(contact.company_id, contact);
    }
  }

  const report: MergeReport = { created: 0, skipped: [] };

  for (const company of companies) {
    if (!company.email) {
      report.skipped.push({ name: company.name, reason: "aucune adresse" });
      continue;
    }

    const contact = contactByCompany.get(company.id);
    const firstName = contact?.first_name?.trim() ?? "";

    const context = {
      company: {
        name: company.name,
        email: company.email,
        city: company.city ?? "",
        sector: company.sector ?? "",
      },
      contact: {
        first_name: firstName,
        last_name: contact?.last_name ?? "",
        email: contact?.email ?? "",
        role_title: contact?.role_title ?? "",
      },
      // Salutation prete a l'emploi : nommee quand on connait la personne,
      // neutre sinon. Evite d'avoir deux modeles selon les cas.
      salutation: firstName ? `Bonjour ${firstName}` : "Bonjour",
      user: { full_name: fullName },
      today,
    };

    try {
      await createGmailDraft(accessToken, {
        to: company.email,
        subject: renderTemplate(template.subject, context),
        body: renderTemplate(template.body, context),
      });
      report.created += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "erreur inconnue";
      console.error(`[publipostage] ${company.name}`, reason);
      report.skipped.push({ name: company.name, reason });

      // Un refus d'autorisation vaut pour tous : inutile d'essayer cent fois.
      if (reason.includes("refusé l'accès")) break;
    }
  }

  if (report.created === 0) {
    return fail(
      report.skipped[0]?.reason ?? "Aucun brouillon n'a pu être créé.",
    );
  }

  revalidatePath("/contacts");
  return ok(report);
}
