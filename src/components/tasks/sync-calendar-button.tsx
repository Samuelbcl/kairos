"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshCalendar } from "@/server/actions/integrations";

/**
 * Synchronisation immédiate avec l'agenda connecté.
 *
 * La synchronisation automatique tourne une fois par jour. Ce bouton évite
 * d'attendre le lendemain pour voir un rendez-vous déplacé ce matin.
 */
export function SyncCalendarButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    startTransition(async () => {
      const result = await refreshCalendar();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const { pushed, updated } = result.data;
      const parts = [
        pushed ? `${pushed} relance${pushed > 1 ? "s" : ""} envoyée${pushed > 1 ? "s" : ""}` : null,
        updated ? `${updated} mise${updated > 1 ? "s" : ""} à jour depuis l'agenda` : null,
      ].filter(Boolean);

      toast.success(parts.length ? parts.join(", ") : "Tout est déjà à jour.");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={pending}>
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} aria-hidden />
      ) : (
        <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
      )}
      Synchroniser
    </Button>
  );
}
