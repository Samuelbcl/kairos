import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, User } from "lucide-react";
import { TagBadge } from "@/components/contacts/tag-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline, type TimelineEntry } from "@/components/contacts/timeline";
import { ContactFields } from "@/components/contacts/contact-fields";
import { ContactTitle } from "@/components/contacts/contact-title";
import { ContactNotes } from "@/components/contacts/contact-notes";
import { TaskPanel } from "@/components/tasks/task-panel";
import { DeleteCompanyButton } from "@/components/contacts/delete-company-button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { fullName } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/contacts/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("first_name, last_name")
    .eq("id", id)
    .single();
  return { title: fullName(data?.first_name, data?.last_name) || "Contact" };
}

export default async function ContactPage(props: PageProps<"/contacts/[id]">) {
  const { id } = await props.params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) notFound();

  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("*, companies(id, name)")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();

  if (error || !contact) notFound();

  const [{ data: activities }, { data: tasks }, { data: companies }] = await Promise.all([
    supabase
      .from("activities")
      .select(
        "id, type, content, created_at, profiles!activities_created_by_profiles_fkey(full_name)",
      )
      .eq("subject_type", "contact")
      .eq("subject_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("tasks")
      .select("id, title, due_at, done, priority, external_event_id")
      .eq("contact_id", id)
      .order("due_at"),
    supabase
      .from("companies")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .order("name")
      .limit(500),
  ]);

  const { data: tagRows } = await supabase
    .from("tags")
    .select("name, color")
    .eq("workspace_id", workspace.id);
  const tagColors = new Map((tagRows ?? []).map((t) => [t.name, t.color]));

  const { data: customFields } = await supabase
    .from("custom_fields")
    .select("id, entity, key, label, type, options")
    .eq("workspace_id", workspace.id)
    .eq("entity", "contact")
    .order("position");

  const entries: TimelineEntry[] = (activities ?? []).map((a) => ({
    id: a.id,
    type: a.type,
    content: a.content,
    created_at: a.created_at,
    author: a.profiles?.full_name ?? null,
  }));

  const displayName = fullName(contact.first_name, contact.last_name) || "Sans nom";

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/contacts?tab=people"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
        Contacts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft">
            <User className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <ContactTitle id={contact.id} name={displayName} />
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              {contact.role_title ? <span>{contact.role_title}</span> : null}
              {contact.companies ? (
                <>
                  {contact.role_title ? <span aria-hidden>·</span> : null}
                  <Link
                    href={`/companies/${contact.companies.id}`}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <Building2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                    {contact.companies.name}
                  </Link>
                </>
              ) : null}
              {!contact.role_title && !contact.companies ? "Aucun détail renseigné" : null}
            </p>
            {contact.tags.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {contact.tags.map((tag) => (
                  <TagBadge key={tag} name={tag} color={tagColors.get(tag)} />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DeleteCompanyButton id={contact.id} name={displayName} kind="contact" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Informations</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactFields
                contact={contact}
                companies={companies ?? []}
                customFields={(customFields ?? []).map((f) => ({
                  id: f.id,
                  entity: f.entity,
                  key: f.key,
                  label: f.label,
                  type: f.type,
                  options: Array.isArray(f.options) ? (f.options as string[]) : null,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Historique</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <ContactNotes contactId={contact.id} />
              <Timeline entries={entries} />
            </CardContent>
          </Card>
        </div>

        <TaskPanel
          tasks={tasks ?? []}
          target={{ contact_id: contact.id, company_id: contact.company_id ?? undefined }}
          defaultTitle={`Relancer ${displayName}`}
        />
      </div>
    </div>
  );
}
