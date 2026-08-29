"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/actions/types";

type InlineEditProps = {
  label: string;
  value: string | null;
  /** Nom du champ envoyé à l'action. */
  field: string;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url";
  onSave: (field: string, value: string) => Promise<ActionResult<unknown>>;
  /** Rendu personnalisé en lecture (lien mailto, tel…). */
  render?: (value: string) => React.ReactNode;
};

/**
 * Champ éditable au clic : Entrée enregistre, Échap annule.
 * On affiche la valeur optimiste tout de suite et on la revalide au retour.
 */
export function InlineEdit({
  label,
  value,
  field,
  placeholder = "Non renseigné",
  type = "text",
  onSave,
  render,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value ?? "");
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Resynchronisation quand la valeur serveur change (revalidation après save).
  // Ajuster l'état pendant le rendu est le motif recommandé par React ; le faire
  // dans un effet déclencherait un rendu supplémentaire à chaque revalidation.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setCurrent(value ?? "");
    setDraft(value ?? "");
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const next = draft.trim();
    if (next === current) {
      setEditing(false);
      return;
    }

    const previous = current;
    setCurrent(next);
    setEditing(false);

    startTransition(async () => {
      const result = await onSave(field, next);
      if (!result.ok) {
        setCurrent(previous);
        setDraft(previous);
        toast.error(result.error);
      }
    });
  }

  function cancel() {
    setDraft(current);
    setEditing(false);
  }

  return (
    <div className="grid grid-cols-[8rem_1fr] items-start gap-3 py-1.5">
      <span className="pt-1 text-sm text-muted-foreground">{label}</span>

      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") cancel();
            }}
            onBlur={commit}
            className="h-8"
            aria-label={label}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
            aria-label="Enregistrer"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Check className="size-3.5" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancel}
            aria-label="Annuler"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={`Cliquer pour modifier : ${label}`}
          className={cn(
            "group flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors duration-150 hover:bg-accent",
            !current && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {current ? (render ? render(current) : current) : placeholder}
          </span>
          {pending ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Pencil
              className="size-3.5 shrink-0 text-muted-foreground opacity-30 transition-opacity duration-150 group-hover:opacity-100"
              strokeWidth={1.75}
              aria-hidden
            />
          )}
        </button>
      )}
    </div>
  );
}
