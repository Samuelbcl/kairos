import Link from "next/link";
import { Building2, Upload, User } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { ContactsToolbar } from "@/components/contacts/contacts-toolbar";
import { NewCompanyButton } from "@/components/contacts/new-company-button";
import {
  ContactsTable,
  type CompanyRow,
  type PersonRow,
} from "@/components/contacts/contacts-table";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Contacts" };

/** Au-delà, on pagine plutôt que de tronquer en silence. */
const PAGE_SIZE = 100;

export default async function ContactsPage(props: PageProps<"/contacts">) {
  const params = await props.searchParams;
  const tab: "companies" | "people" = params.tab === "people" ? "people" : "companies";
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const tag = typeof params.tag === "string" ? params.tag : "";
  const page = Math.max(Number(params.page ?? 1) || 1, 1);
  const from = (page - 1) * PAGE_SIZE;

  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return (
      <>
        <PageHeader title="Contacts" />
        <EmptyState
          icon={Building2}
          title="Aucun espace actif."
          description="Reconnecte-toi pour retrouver ton espace de travail."
        />
      </>
    );
  }

  const supabase = await createClient();
  const pattern = `%${query}%`;

  const [{ data: tagRows }, { data: stages }, { data: templates }] =
    await Promise.all([
      supabase
        .from("tags")
        .select("name, color")
        .eq("workspace_id", workspace.id)
        .order("name"),
      supabase
        .from("stages")
        .select("id, name")
        .eq("workspace_id", workspace.id)
        .order("position"),
      // Modèles d'e-mail : ils alimentent le publipostage depuis la sélection.
      supabase
        .from("email_templates")
        .select("id, name, subject")
        .eq("workspace_id", workspace.id)
        .order("name"),
    ]);

  const tagColors = Object.fromEntries(
    (tagRows ?? []).map((row) => [row.name, row.color]),
  );

  let companies: CompanyRow[] = [];
  let people: PersonRow[] = [];
  let total = 0;

  if (tab === "companies") {
    let request = supabase
      .from("companies")
      .select("id, name, email, sector, city, tags, updated_at, contacts(count)", {
        count: "exact",
      })
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (query) {
      request = request.or(
        `name.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern},sector.ilike.${pattern}`,
      );
    }
    if (tag) request = request.contains("tags", [tag]);

    const { data, error, count } = await request;
    if (error) console.error("[contacts] lecture des entreprises", error.message);

    total = count ?? 0;
    companies = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      sector: row.sector,
      city: row.city,
      tags: row.tags,
      updated_at: row.updated_at,
      contactCount: row.contacts?.[0]?.count ?? 0,
    }));
  } else {
    let request = supabase
      .from("contacts")
      .select("id, first_name, last_name, email, role_title, tags, companies(id, name)", {
        count: "exact",
      })
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (query) {
      request = request.or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
      );
    }
    if (tag) request = request.contains("tags", [tag]);

    const { data, error, count } = await request;
    if (error) console.error("[contacts] lecture des contacts", error.message);

    total = count ?? 0;
    people = (data ?? []).map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      roleTitle: row.role_title,
      tags: row.tags,
      company: row.companies ?? null,
    }));
  }

  const isFiltered = Boolean(query || tag);
  const rowCount = tab === "companies" ? companies.length : people.length;
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (tab === "people") next.set("tab", "people");
    if (query) next.set("q", query);
    if (tag) next.set("tag", tag);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return qs ? `/contacts?${qs}` : "/contacts";
  }

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Tes comptes et les personnes qui vont avec."
        action={
          <div className="flex gap-2" data-tour="action-import">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/contacts/import" />}
            >
              <Upload className="size-4" strokeWidth={1.75} aria-hidden />
              Importer
            </Button>
            <NewCompanyButton />
          </div>
        }
      />

      <ContactsToolbar
        tab={tab}
        query={query}
        tag={tag}
        tags={tagRows ?? []}
        total={total}
      />

      {rowCount === 0 ? (
        <EmptyState
          icon={tab === "companies" ? Building2 : User}
          title={
            isFiltered
              ? "Aucun résultat."
              : tab === "companies"
                ? "Aucune entreprise pour l'instant."
                : "Aucun contact pour l'instant."
          }
          description={
            isFiltered
              ? "Essaie un autre terme, ou retire le filtre de tag."
              : "Importe ton tableur, ou ajoute ta première fiche avec ⌘K."
          }
        />
      ) : (
        <ContactsTable
          entity={tab === "companies" ? "company" : "contact"}
          companies={companies}
          people={people}
          tagColors={tagColors}
          tags={tagRows ?? []}
          stages={stages ?? []}
          templates={templates ?? []}
        />
      )}

      {lastPage > 1 ? (
        <nav
          className="mt-4 flex items-center justify-between gap-3"
          aria-label="Pagination"
        >
          <span className="tabular text-sm text-muted-foreground">
            Page {page} sur {lastPage}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              nativeButton={false}
              render={<Link href={pageHref(page - 1)} />}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              nativeButton={false}
              render={<Link href={pageHref(page + 1)} />}
            >
              Suivant
            </Button>
          </div>
        </nav>
      ) : null}
    </>
  );
}
