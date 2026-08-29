"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/actions/types";

/**
 * Titre de fiche modifiable sur place.
 *
 * Le champ « Nom » existait dans le bloc Informations, mais c'est le grand
 * titre qu'on a spontanément envie de cliquer pour renommer. Ce qu'on ne
 * trouve pas n'existe pas : autant rendre les deux modifiables.
 */
export function EditableTitle({
  value,
  onSave,
  label = "Nom",
}: {
  value: string;
  onSave: (next: string) => Promise<ActionResult<unknown>>;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // La valeur serveur change après revalidation : on s'y raccroche pendant le
  // rendu plutôt que dans un effet, qui provoquerait un rendu de plus.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setCurrent(value);
    setDraft(value);
  }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const next = draft.trim();
    setEditing(false);

    if (!next) {
      setDraft(current);
      toast.error(`${label} ne peut pas être vide.`);
      return;
    }
    if (next === current) return;

    const previous = current;
    setCurrent(next);

    startTransition(async () => {
      const result = await onSave(next);
      if (result.ok) {
        toast.success("Nom mis à jour");
      } else {
        setCurrent(previous);
        setDraft(previous);
        toast.error(result.error);
      }
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(current);
              setEditing(false);
            }
          }}
          aria-label={label}
          className="w-full max-w-md rounded-md border bg-background px-2 py-0.5 text-xl font-semibold tracking-tight outline-none focus-visible:border-primary"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
          aria-label="Enregistrer"
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Check className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Cliquer pour renommer"
      className={cn(
        "group -mx-1.5 flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left transition-colors duration-150 hover:bg-accent",
      )}
    >
      <span className="truncate text-xl font-semibold tracking-tight">{current}</span>
      {pending ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <Pencil
          className="size-3.5 shrink-0 text-muted-foreground opacity-40 transition-opacity duration-150 group-hover:opacity-100"
          strokeWidth={1.75}
          aria-hidden
        />
      )}
    </button>
  );
}
