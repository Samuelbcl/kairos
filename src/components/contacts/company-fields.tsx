"use client";

import { InlineEdit } from "./inline-edit";
import { updateCompany } from "@/server/actions/companies";
import type { Database } from "@/types/db";

type Company = Database["public"]["Tables"]["companies"]["Row"];

/** Bloc d'informations d'une entreprise, chaque ligne éditable au clic. */
export function CompanyFields({ company }: { company: Company }) {
  async function save(field: string, value: string) {
    return updateCompany({ id: company.id, [field]: value });
  }

  return (
    <div className="flex flex-col divide-y">
      <InlineEdit label="Nom" field="name" value={company.name} onSave={save} />
      <InlineEdit
        label="E-mail"
        field="email"
        type="email"
        value={company.email}
        onSave={save}
        render={(v) => (
          <a href={`mailto:${v}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
            {v}
          </a>
        )}
      />
      <InlineEdit
        label="Téléphone"
        field="phone"
        type="tel"
        value={company.phone}
        onSave={save}
        render={(v) => (
          <a href={`tel:${v}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
            {v}
          </a>
        )}
      />
      <InlineEdit
        label="Site web"
        field="website"
        value={company.website}
        onSave={save}
        render={(v) => (
          <a
            href={v}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {v.replace(/^https?:\/\//, "")}
          </a>
        )}
      />
      <InlineEdit label="Secteur" field="sector" value={company.sector} onSave={save} />
      <InlineEdit label="Adresse" field="address" value={company.address} onSave={save} />
      <InlineEdit label="Ville" field="city" value={company.city} onSave={save} />
      <InlineEdit label="Taille" field="size" value={company.size} onSave={save} placeholder="1-10, 11-50…" />
      <InlineEdit
        label="Tags"
        field="tags"
        value={company.tags.join(", ")}
        onSave={save}
        placeholder="Séparés par une virgule"
      />
      <InlineEdit label="Source" field="source" value={company.source} onSave={save} />
    </div>
  );
}
