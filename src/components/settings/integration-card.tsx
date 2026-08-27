"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { disconnectIntegration, resyncCalendar } from "@/server/actions/integrations";
import { formatDate } from "@/lib/format";

type Props = {
  provider: "google" | "microsoft";
  name: string;
  description: string;
  configured: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
  missingEnvHint: string;
};

export function IntegrationCard({
  provider,
  name,
  description,
  configured,
  accountEmail,
  connectedAt,
  missingEnvHint,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const connected = Boolean(connectedAt);

  function disconnect() {
    startTransition(async () => {
      const result = await disconnectIntegration(provider);
      if (result.ok) {
        toast.success(`${name} déconnecté`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function resync() {
    startTransition(async () => {
      const result = await resyncCalendar();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.synced > 0
          ? `${result.data.synced} relance${result.data.synced > 1 ? "s" : ""} envoyée${result.data.synced > 1 ? "s" : ""} vers ton agenda`
          : "Tout est déjà synchronisé.",
      );
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft">
            {connected ? (
              <CalendarCheck2 className="size-4 text-primary" strokeWidth={1.75} aria-hidden />
            ) : (
              <Plug className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            )}
          </span>
          <div>
            <CardTitle className="text-sm">{name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {connected ? (
          <Badge variant="secondary" className="shrink-0">
            Connecté
          </Badge>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {connected ? (
          <>
            <p className="text-sm text-muted-foreground">
              {accountEmail ? (
                <span className="text-foreground">{accountEmail}</span>
              ) : (
                "Compte connecté"
              )}
              {connectedAt ? ` · depuis le ${formatDate(connectedAt)}` : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={resync} disabled={pending}>
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
                )}
                Envoyer les relances en attente
              </Button>
              <Button variant="ghost" size="sm" onClick={disconnect} disabled={pending}>
                <Unplug className="size-3.5" strokeWidth={1.75} aria-hidden />
                Déconnecter
              </Button>
            </div>
          </>
        ) : configured ? (
          <Button size="sm" className="w-fit" render={<a href={`/api/integrations/${provider}`} />}>
            <Plug className="size-3.5" strokeWidth={1.75} aria-hidden />
            Connecter {name}
          </Button>
        ) : (
          <p className="rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
            {missingEnvHint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
