"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { InlineEdit } from "./inline-edit";
import { CustomFields } from "./custom-fields";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateContact } from "@/server/actions/contacts";
import type { Database } from "@/types/db";
import type { CustomField } from "@/components/settings/custom-fields-panel";
import type { ResolvedLabels } from "@/lib/field-labels";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

const NO_COMPANY = "__none__";

export function ContactFields({
  contact,
  companies,
  customFields = [],
  labels,
}: {
  contact: Contact;
  companies: { id: string; name: string }[];
  customFields?: CustomField[];
  /** Noms des champs resolus pour cet espace : voir lib/field-labels. */
  labels: ResolvedLabels;
}) {
  const [pending, startTransition] = useTransition();

  async function save(field: string, value: string) {
    return updateContact({ id: contact.id, [field]: value });
  }

  async function saveCustom(custom: Record<string, string | number | boolean | null>) {
    return updateContact({ id: contact.id, custom });
  }

  function changeCompany(value: string) {
    startTransition(async () => {
      const result = await updateContact({
        id: contact.id,
        company_id: value === NO_COMPANY ? "" : value,
      });
      if (result.ok) toast.success("Entreprise mise à jour");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col divide-y">
      <InlineEdit label={labels.first_name} field="first_name" value={contact.first_name} onSave={save} />
      <InlineEdit label={labels.last_name} field="last_name" value={contact.last_name} onSave={save} />
      <InlineEdit
        label={labels.email}
        field="email"
        type="email"
        value={contact.email}
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
        value={contact.phone}
        onSave={save}
        render={(v) => (
          <a href={`tel:${v}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
            {v}
          </a>
        )}
      />
      <InlineEdit label={labels.role_title} field="role_title" value={contact.role_title} onSave={save} />

      <div className="grid grid-cols-[8rem_1fr] items-center gap-3 py-1.5">
        <Label htmlFor="contact-company" className="text-sm font-normal text-muted-foreground">
          Entreprise
        </Label>
        <Select
          value={contact.company_id ?? NO_COMPANY}
          onValueChange={(v) => changeCompany(String(v))}
          disabled={pending}
        >
          <SelectTrigger id="contact-company" className="h-8">
            <SelectValue placeholder="Aucune" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_COMPANY}>Aucune</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <InlineEdit
        label={labels.tags}
        field="tags"
        value={contact.tags.join(", ")}
        onSave={save}
        placeholder="Séparés par une virgule"
      />

      <CustomFields
        fields={customFields}
        values={(contact.custom ?? {}) as Record<string, string | number | boolean | null>}
        onSave={saveCustom}
      />
    </div>
  );
}
