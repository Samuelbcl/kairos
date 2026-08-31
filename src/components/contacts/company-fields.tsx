"use client";

import { InlineEdit } from "./inline-edit";
import { CustomFields } from "./custom-fields";
import { updateCompany } from "@/server/actions/companies";
import type { Database } from "@/types/db";
import type { CustomField } from "@/components/settings/custom-fields-panel";
import type { ResolvedLabels } from "@/lib/field-labels";

type Company = Database["public"]["Tables"]["companies"]["Row"];

/** Bloc d'informations d'une entreprise, chaque ligne éditable au clic. */
export function CompanyFields({
  company,
  customFields = [],
  labels,
}: {
  company: Company;
  customFields?: CustomField[];
  /** Noms des champs resolus pour cet espace : voir lib/field-labels. */
  labels: ResolvedLabels;
}) {
  async function save(field: string, value: string) {
    return updateCompany({ id: company.id, [field]: value });
  }

  async function saveCustom(custom: Record<string, string | number | boolean | null>) {
    return updateCompany({ id: company.id, custom });
  }

  return (
    <div className="flex flex-col divide-y">
      <InlineEdit label={labels.name} field="name" value={company.name} onSave={save} />
      <InlineEdit
        label={labels.email}
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
        label={labels.phone}
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
        label={labels.website}
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
      <InlineEdit label={labels.sector} field="sector" value={company.sector} onSave={save} />
      <InlineEdit label={labels.address} field="address" value={company.address} onSave={save} />
      <InlineEdit label={labels.city} field="city" value={company.city} onSave={save} />
      <InlineEdit label={labels.size} field="size" value={company.size} onSave={save} />
      <InlineEdit
        label={labels.tags}
        field="tags"
        value={company.tags.join(", ")}
        onSave={save}
        placeholder="Séparés par une virgule"
      />
      <InlineEdit label={labels.source} field="source" value={company.source} onSave={save} />

      <CustomFields
        fields={customFields}
        values={(company.custom ?? {}) as Record<string, string | number | boolean | null>}
        onSave={saveCustom}
      />
    </div>
  );
}
