"use client";

import { useTransition } from "react";
import { Compass, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { restartTour } from "@/server/actions/tour";
import { TOUR_STEPS } from "@/lib/tour-steps";

/** Relance la visite guidée. Utile pour soi, et pour un nouveau collègue. */
export function TourPanel({ completedAt }: { completedAt: string | null }) {
  const [pending, startTransition] = useTransition();

  function replay() {
    // Ouvre immédiatement, et remet le compteur à zéro en arrière-plan pour
    // qu'un rechargement de page ne la fasse pas disparaître.
    window.dispatchEvent(new CustomEvent("kairos:tour"));
    startTransition(async () => {
      const result = await restartTour();
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Compass className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          Visite guidée
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {completedAt
            ? `Tu l'as déjà suivie. Relance-la quand tu veux — ${TOUR_STEPS.length} étapes, deux minutes.`
            : `Elle se lance toute seule à ta première visite. ${TOUR_STEPS.length} étapes, deux minutes.`}
        </p>

        <Button variant="outline" size="sm" className="w-fit" onClick={replay} disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <PlayCircle className="size-3.5" strokeWidth={1.75} aria-hidden />
          )}
          Revoir la visite
        </Button>

        <p className="text-xs text-muted-foreground">
          Elle passe en revue chaque écran et explique à quoi sert chaque bouton.
          Utile aussi pour un collègue que tu viens d&apos;inviter.
        </p>
      </CardContent>
    </Card>
  );
}
