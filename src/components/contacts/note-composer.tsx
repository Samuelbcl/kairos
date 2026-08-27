"use client";

import { useRef, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/server/actions/types";

/** Ajout d'une note libre à une fiche. ⌘/Ctrl + Entrée pour envoyer. */
export function NoteComposer({
  onSubmit,
}: {
  onSubmit: (content: string) => Promise<ActionResult<unknown>>;
}) {
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  function send() {
    const content = ref.current?.value.trim();
    if (!content) return;

    startTransition(async () => {
      const result = await onSubmit(content);
      if (result.ok) {
        if (ref.current) ref.current.value = "";
        toast.success("Note ajoutée");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        ref={ref}
        rows={3}
        placeholder="Note, compte rendu d'appel, prochaine étape…"
        aria-label="Nouvelle note"
        disabled={pending}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">⌘ + Entrée pour ajouter</span>
        <Button size="sm" onClick={send} disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Send className="size-3.5" strokeWidth={1.75} aria-hidden />
          )}
          Ajouter
        </Button>
      </div>
    </div>
  );
}
