"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activities";
import { firstIssue } from "@/lib/validators/common";
import { contactCreateSchema, contactUpdateSchema } from "@/lib/validators/contact";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";
import { runAutomations } from "@/lib/automations/engine";
import { dispatchWebhooks } from "@/lib/webhooks";
import { fullName } from "@/lib/format";

export async function createContact(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = contactCreateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...parsed.data, workspace_id: workspace.id })
    .select("id, first_name, last_name, email, company_id")
    .single();

  if (error) {
    console.error("[contacts] création impossible", error.message);
    return fail(pgError(error, "Impossible de créer le contact. Réessaie."));
  }

  await logActivity(supabase, {
    workspaceId: workspace.id,
    subjectType: "contact",
    subjectId: data.id,
    type: "system",
    content: "Contact créé",
  });

  await Promise.all([
    runAutomations(
      { type: "contact.created", payload: { contact: data } },
      { workspaceId: workspace.id },
    ),
    dispatchWebhooks(supabase, workspace.id, "contact.created", { contact: data }),
  ]);

  revalidatePath("/contacts");
  if (data.company_id) revalidatePath(`/companies/${data.company_id}`);
  return ok({ id: data.id });
}

export async function updateContact(input: unknown): Promise<ActionResult> {
  const parsed = contactUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { id, ...fields } = parsed.data;
  if (Object.keys(fields).length === 0) return ok(undefined);

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts")
    .update(fields)
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("[contacts] mise à jour impossible", error.message);
    return fail(pgError(error, "Modification refusée. Recharge la page et réessaie."));
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  return ok(undefined);
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("[contacts] suppression impossible", error.message);
    return fail(pgError(error, "Suppression refusée. Vérifie tes droits sur cet espace."));
  }

  revalidatePath("/contacts");
  return ok(undefined);
}

export async function addContactNote(
  contactId: string,
  content: string,
): Promise<ActionResult> {
  const text = content.trim();
  if (!text) return fail("La note est vide.");
  if (text.length > 5000) return fail("La note est trop longue (5000 caractères max).");

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  await logActivity(supabase, {
    workspaceId: workspace.id,
    subjectType: "contact",
    subjectId: contactId,
    type: "note",
    content: text,
  });

  revalidatePath(`/contacts/${contactId}`);
  return ok(undefined);
}

/** Recherche globale pour la barre ⌘K. Limitée, ordonnée par pertinence simple. */
export async function searchEverything(query: string): Promise<
  ActionResult<{
    companies: { id: string; name: string; city: string | null }[];
    contacts: {
      id: string;
      name: string;
      email: string | null;
      companyName: string | null;
    }[];
    deals: { id: string; title: string; stage: string | null }[];
  }>
> {
  const term = query.trim();
  if (term.length < 2) {
    return ok({ companies: [], contacts: [], deals: [] });
  }

  const workspace = await requireWorkspace();
  const supabase = await createClient();
  const pattern = `%${term}%`;

  const [companiesResult, contactsResult, dealsResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, city")
      .eq("workspace_id", workspace.id)
      .or(`name.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern}`)
      .order("name")
      .limit(6),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, email, companies(name)")
      .eq("workspace_id", workspace.id)
      .or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
      )
      .limit(6),
    supabase
      .from("deals")
      .select("id, title, stages(name)")
      .eq("workspace_id", workspace.id)
      .ilike("title", pattern)
      .limit(6),
  ]);

  return ok({
    companies: companiesResult.data ?? [],
    contacts: (contactsResult.data ?? []).map((c) => ({
      id: c.id,
      name: fullName(c.first_name, c.last_name) || (c.email ?? "Sans nom"),
      email: c.email,
      companyName: c.companies?.name ?? null,
    })),
    deals: (dealsResult.data ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      stage: d.stages?.name ?? null,
    })),
  });
}
