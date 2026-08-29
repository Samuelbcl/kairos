"use client";

import { EditableTitle } from "./editable-title";
import { updateCompany } from "@/server/actions/companies";

export function CompanyTitle({ id, name }: { id: string; name: string }) {
  return (
    <EditableTitle
      value={name}
      onSave={(next) => updateCompany({ id, name: next })}
    />
  );
}
