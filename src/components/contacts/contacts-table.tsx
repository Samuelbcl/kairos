"use client";

import { useState } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TagBadge } from "./tag-badge";
import { BulkBar } from "./bulk-bar";
import { formatRelative, fullName } from "@/lib/format";

export type CompanyRow = {
  id: string;
  name: string;
  email: string | null;
  sector: string | null;
  city: string | null;
  tags: string[];
  updated_at: string;
  contactCount: number;
};

export type PersonRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  roleTitle: string | null;
  tags: string[];
  company: { id: string; name: string } | null;
};

type Shared = {
  tagColors: Record<string, string>;
  tags: { name: string; color: string }[];
  stages: { id: string; name: string }[];
};

/**
 * Liste avec sélection multiple. La sélection vit ici plutôt que dans l'URL :
 * elle est éphémère, et la garder en état évite de recharger la page à chaque
 * case cochée.
 */
export function ContactsTable({
  entity,
  companies,
  people,
  tagColors,
  tags,
  stages,
}: Shared & {
  entity: "company" | "contact";
  companies?: CompanyRow[];
  people?: PersonRow[];
}) {
  const rows: { id: string }[] = entity === "company" ? (companies ?? []) : (people ?? []);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((row) => row.id)) : new Set());
  }

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(value) => toggleAll(value === true)}
                  data-tour="select-all"
                  aria-label="Tout sélectionner"
                />
              </TableHead>

              {entity === "company" ? (
                <>
                  <TableHead>Entreprise</TableHead>
                  <TableHead className="hidden md:table-cell">Secteur</TableHead>
                  <TableHead className="hidden lg:table-cell">Ville</TableHead>
                  <TableHead className="hidden sm:table-cell">Contacts</TableHead>
                  <TableHead className="hidden xl:table-cell">Modifié</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Personne</TableHead>
                  <TableHead className="hidden md:table-cell">Fonction</TableHead>
                  <TableHead className="hidden sm:table-cell">Entreprise</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {entity === "company"
              ? (companies ?? []).map((company) => (
                  <TableRow key={company.id} data-state={selected.has(company.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(company.id)}
                        onCheckedChange={(value) => toggle(company.id, value === true)}
                        aria-label={`Sélectionner ${company.name}`}
                      />
                    </TableCell>
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
                          {company.tags.map((tag) => (
                            <TagBadge
                              key={tag}
                              name={tag}
                              color={tagColors[tag]}
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
                      {company.contactCount}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                      {formatRelative(company.updated_at)}
                    </TableCell>
                  </TableRow>
                ))
              : (people ?? []).map((person) => (
                  <TableRow key={person.id} data-state={selected.has(person.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(person.id)}
                        onCheckedChange={(value) => toggle(person.id, value === true)}
                        aria-label={`Sélectionner ${fullName(person.firstName, person.lastName) || "ce contact"}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/contacts/${person.id}`}
                        className="font-medium hover:underline"
                      >
                        {fullName(person.firstName, person.lastName) || "Sans nom"}
                      </Link>
                      {person.email ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {person.email}
                        </span>
                      ) : null}
                      {person.tags.length ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {person.tags.map((tag) => (
                            <TagBadge
                              key={tag}
                              name={tag}
                              color={tagColors[tag]}
                              className="text-[10px]"
                            />
                          ))}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {person.roleTitle ?? "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {person.company ? (
                        <Link
                          href={`/companies/${person.company.id}`}
                          className="text-muted-foreground hover:underline"
                        >
                          {person.company.name}
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

      {selected.size > 0 ? (
        <BulkBar
          entity={entity}
          ids={[...selected]}
          onClear={() => setSelected(new Set())}
          tags={tags}
          stages={stages}
        />
      ) : null}
    </>
  );
}
