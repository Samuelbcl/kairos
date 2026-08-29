"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Frontière d'erreur commune. Un message qui dit quoi faire, pas une trace de
 * pile : la personne en face n'est pas développeuse.
 */
export function ErrorState({
  error,
  reset,
  what,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Ce que la page essayait d'afficher, pour situer le problème. */
  what: string;
}) {
  useEffect(() => {
    console.error(`[${what}] rendu impossible`, error.message, error.digest);
  }, [error, what]);

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-14 text-center">
      <TriangleAlert className="size-6 text-warning" strokeWidth={1.5} aria-hidden />
      <p className="mt-3 text-sm font-medium">
        Impossible d&apos;afficher {what}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        La donnée n&apos;a pas pu être chargée. Réessaie&nbsp;; si ça persiste,
        vérifie ta connexion, puis recharge la page.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
        <RotateCw className="size-3.5" strokeWidth={1.75} aria-hidden />
        Réessayer
      </Button>
      {error.digest ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          Référence : {error.digest}
        </p>
      ) : null}
    </div>
  );
}
