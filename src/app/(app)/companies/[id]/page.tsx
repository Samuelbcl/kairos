import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Plus, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline, type TimelineEntry } from "@/components/contacts/timeline";
import { CompanyFields } from "@/components/contacts/company-fields";
import { CompanyNotes } from "@/components/contacts/company-notes";
import { TaskPanel } from "@/components/tasks/task-panel";
import { NewContactButton } from "@/components/contacts/new-contact-button";
import { DeleteCompanyButton } from "@/components/contacts/delete-company-button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { fullName } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/companies/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("name")
    .eq("id", id)
    .single();
  return { title: data?.name ?? "Entreprise" };
}

export default async function CompanyPage(props: PageProps<"/companies/[id]">) {
  const { id } = await props.params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) notFound();

  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();

  if (error || !company) notFound();

  const [{ data: contacts }, { data: deals }, { data: activities }, { data: tasks }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id, first_name, last_name, email, role_title")
        .eq("company_id", id)
        .order("last_name"),
      supabase
        .from("deals")
        .select("id, title, value, currency, status, stages(name, color)")
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("activities")
        .select(
          "id, type, content, created_at, profiles!activities_created_by_profiles_fkey(full_name)",
        )
        .eq("subject_type", "company")
        .eq("subject_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("tasks")
        .select("id, title, kind, due_at, done, priority, external_event_id")
        .eq("company_id", id)
        .order("due_at"),
    ]);

  const entries: TimelineEntry[] = (activities ?? []).map((a) => ({
    id: a.id,
    type: a.type,
    content: a.content,
    created_at: a.created_at,
    author: a.profiles?.full_name ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
          Contacts
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft">
            <Building2 className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {company.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[company.sector, company.city].filter(Boolean).join(" · ") ||
                "Aucun secteur renseigné"}
            </p>
            {company.tags.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {company.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DeleteCompanyButton id={company.id} name={company.name} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Informations</CardTitle>
            </CardHeader>
            <CardContent>
              <CompanyFields company={company} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-sm">Personnes</CardTitle>
              <NewContactButton companyId={company.id} />
            </CardHeader>
            <CardContent>
              {contacts?.length ? (
                <ul className="flex flex-col divide-y">
                  {contacts.map((contact) => (
                    <li key={contact.id} className="flex items-center gap-3 py-2 first:pt-0">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                        <User
                          className="size-4 text-muted-foreground"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {fullName(contact.first_name, contact.last_name) || "Sans nom"}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {[contact.role_title, contact.email].filter(Boolean).join(" · ") ||
                            "Aucun détail"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">
                  Aucune personne rattachée. Ajoute ton interlocuteur quand tu l&apos;as.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Historique</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <CompanyNotes companyId={company.id} />
              <Timeline entries={entries} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <TaskPanel
            tasks={tasks ?? []}
            target={{ company_id: company.id }}
            defaultTitle={`Relancer ${company.name}`}
          />

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-sm">Opportunités</CardTitle>
              <Button variant="ghost" size="icon-sm" render={<Link href="/pipeline" />} aria-label="Voir le pipeline">
                <Plus className="size-4" strokeWidth={2} aria-hidden />
              </Button>
            </CardHeader>
            <CardContent>
              {deals?.length ? (
                <ul className="flex flex-col gap-2">
                  {deals.map((deal) => (
                    <li key={deal.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm">{deal.title}</span>
                      <Badge
                        variant="secondary"
                        style={
                          deal.stages?.color
                            ? {
                                backgroundColor: `color-mix(in oklch, ${deal.stages.color} 15%, transparent)`,
                                color: deal.stages.color,
                              }
                            : undefined
                        }
                      >
                        {deal.stages?.name ?? "—"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune opportunité. Crée-en une depuis le pipeline.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
