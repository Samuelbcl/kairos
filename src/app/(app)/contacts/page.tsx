import Link from "next/link";
import { Building2, Upload, User } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { TagBadge } from "@/components/contacts/tag-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContactsToolbar } from "@/components/contacts/contacts-toolbar";
import { NewCompanyButton } from "@/components/contacts/new-company-button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { formatRelative, fullName } from "@/lib/format";

export const metadata = { title: "Contacts" };

type Tab = "companies" | "people";

export default async function ContactsPage(props: PageProps<"/contacts">) {
  const params = await props.searchParams;
  const tab: Tab = params.tab === "people" ? "people" : "companies";
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const tag = typeof params.tag === "string" ? params.tag : "";

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

  // Catalogue de tags pour le filtre.
  const { data: tagRows } = await supabase
    .from("tags")
    .select("name, color")
    .eq("workspace_id", workspace.id)
    .order("name");

  let companies: {
    id: string;
    name: string;
    email: string | null;
    sector: string | null;
    city: string | null;
    tags: string[];
    updated_at: string;
    contacts: { count: number }[];
  }[] = [];

  let people: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    role_title: string | null;
    tags: string[];
    companies: { id: string; name: string } | null;
  }[] = [];

  if (tab === "companies") {
    let request = supabase
      .from("companies")
      .select(
        "id, name, email, sector, city, tags, updated_at, contacts(count)",
      )
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (query) {
      request = request.or(
        `name.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern},sector.ilike.${pattern}`,
      );
    }
    if (tag) request = request.contains("tags", [tag]);

    const { data, error } = await request;
    if (error)
      console.error("[contacts] lecture des entreprises", error.message);
    companies = data ?? [];
  } else {
    let request = supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, email, role_title, tags, companies(id, name)",
      )
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (query) {
      request = request.or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
      );
    }
    if (tag) request = request.contains("tags", [tag]);

    const { data, error } = await request;
    if (error) console.error("[contacts] lecture des contacts", error.message);
    people = data ?? [];
  }

  const tagColors = new Map((tagRows ?? []).map((t) => [t.name, t.color]));
  const isFiltered = Boolean(query || tag);

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Tes comptes et les personnes qui vont avec."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/contacts/import" />}
            >
              <Upload className="size-4" strokeWidth={1.75} aria-hidden />
              Importer un CSV
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
        companiesCount={tab === "companies" ? companies.length : undefined}
        peopleCount={tab === "people" ? people.length : undefined}
      />

      {tab === "companies" ? (
        companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={
              isFiltered
                ? "Aucune entreprise ne correspond."
                : "Aucune entreprise pour l'instant."
            }
            description={
              isFiltered
                ? "Essaie un autre terme, ou retire le filtre de tag."
                : "Importe ton tableur, ou ajoute ta première entreprise avec ⌘K."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entreprise</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Secteur
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Ville</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Contacts
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Modifié
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <Link
                        href={`/companies/${company.id}`}
                        className="font-medium hover:underline"
                      >
                        {company.name}
                      </Link>
                      {company.email ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {company.email}
                        </span>
                      ) : null}
                      {company.tags.length ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {company.tags.map((t) => (
                            <TagBadge
                              key={t}
                              name={t}
                              color={tagColors.get(t)}
                              className="text-[10px]"
                            />
                          ))}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {company.sector ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {company.city ?? "—"}
                    </TableCell>
                    <TableCell className="tabular hidden text-muted-foreground sm:table-cell">
                      {company.contacts?.[0]?.count ?? 0}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                      {formatRelative(company.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : people.length === 0 ? (
        <EmptyState
          icon={User}
          title={
            isFiltered
              ? "Aucun contact ne correspond."
              : "Aucun contact pour l'instant."
          }
          description={
            isFiltered
              ? "Essaie un autre terme, ou retire le filtre de tag."
              : "Ajoute une personne depuis la fiche d'une entreprise, ou avec ⌘K."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personne</TableHead>
                <TableHead className="hidden md:table-cell">Fonction</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Entreprise
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <Link
                      href={`/contacts/${person.id}`}
                      className="font-medium hover:underline"
                    >
                      {fullName(person.first_name, person.last_name) ||
                        "Sans nom"}
                    </Link>
                    {person.email ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {person.email}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {person.role_title ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {person.companies ? (
                      <Link
                        href={`/companies/${person.companies.id}`}
                        className="text-muted-foreground hover:underline"
                      >
                        {person.companies.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
