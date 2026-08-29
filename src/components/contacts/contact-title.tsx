"use client";

import { EditableTitle } from "./editable-title";
import { updateContact } from "@/server/actions/contacts";

/**
 * Le titre d'un contact affiche « Prénom Nom » mais deux champs le composent.
 * On écrit le premier mot dans le prénom et le reste dans le nom : c'est ce
 * qu'attend quelqu'un qui tape « Marc Dupont » d'un trait.
 */
export function ContactTitle({ id, name }: { id: string; name: string }) {
  return (
    <EditableTitle
      value={name}
      onSave={(next) => {
        const parts = next.trim().split(/\s+/);
        const first = parts.shift() ?? "";
        return updateContact({
          id,
          first_name: first,
          last_name: parts.join(" "),
        });
      }}
    />
  );
}
