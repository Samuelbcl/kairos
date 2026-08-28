"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Send, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createWebhook,
  deleteWebhook,
  testWebhook,
  toggleWebhook,
} from "@/server/actions/api-keys";
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  type WebhookEvent,
} from "@/lib/webhook-events";

type Hook = {
  id: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  created_at: string;
};

export function WebhooksPanel({
  hooks,
  canManage,
}: {
  hooks: Hook[];
  canManage: boolean;
}) {
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<Set<WebhookEvent>>(
    new Set(["deal.stage_changed", "task.created"]),
  );
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function create() {
    startTransition(async () => {
      const result = await createWebhook({ url, events: [...selected] });
      if (result.ok) {
        setSecret(result.data.secret);
        setUrl("");
        toast.success("Webhook créé");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggle(hook: Hook, enabled: boolean) {
    startTransition(async () => {
      const result = await toggleWebhook(hook.id, enabled);
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  function remove(hook: Hook) {
    startTransition(async () => {
      const result = await deleteWebhook(hook.id);
      if (result.ok) {
        toast.success("Webhook supprimé");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function test(hook: Hook) {
    startTransition(async () => {
      const result = await testWebhook(hook.id);
      if (result.ok) toast.success(`L'URL a répondu ${result.data.status}`);
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Webhook className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          Webhooks sortants
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {secret ? (
          <Alert>
            <AlertTitle>Secret de signature</AlertTitle>
            <AlertDescription className="flex flex-col gap-1.5">
              <span>
                Chaque appel porte l&apos;en-tête <code>X-Kairos-Signature</code> :
                <code> sha256=HMAC(secret, corps)</code>. Vérifie-la côté récepteur
                pour t&apos;assurer que l&apos;appel vient bien de Kairos.
              </span>
              <code className="truncate rounded-md border bg-surface px-2.5 py-1.5 font-mono text-xs">
                {secret}
              </code>
            </AlertDescription>
          </Alert>
        ) : null}

        {canManage ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-surface p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hook-url">URL de destination</Label>
              <Input
                id="hook-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hook.eu2.make.com/…"
                disabled={pending}
              />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm">Événements à envoyer</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <div key={event} className="flex items-center gap-2">
                    <Checkbox
                      id={`event-${event}`}
                      checked={selected.has(event)}
                      onCheckedChange={(checked) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (checked === true) next.add(event);
                          else next.delete(event);
                          return next;
                        })
                      }
                    />
                    <Label htmlFor={`event-${event}`} className="font-normal">
                      {WEBHOOK_EVENT_LABELS[event]}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>

            <Button
              className="w-fit"
              onClick={create}
              disabled={pending || !url.trim() || selected.size === 0}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" strokeWidth={2} aria-hidden />
              )}
              Ajouter le webhook
            </Button>
          </div>
        ) : null}

        {hooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun webhook. Ajoutes-en un pour prévenir une autre app dès qu&apos;il se
            passe quelque chose dans Kairos.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {hooks.map((hook) => (
              <li key={hook.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{hook.url}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {hook.events.map((event) => (
                      <Badge key={event} variant="secondary" className="text-[10px]">
                        {WEBHOOK_EVENT_LABELS[event] ?? event}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => test(hook)}
                    disabled={pending}
                  >
                    <Send className="size-3" strokeWidth={1.75} aria-hidden />
                    Tester
                  </Button>

                  {canManage ? (
                    <>
                      <Switch
                        checked={hook.enabled}
                        onCheckedChange={(v) => toggle(hook, v === true)}
                        disabled={pending}
                        aria-label={`${hook.enabled ? "Désactiver" : "Activer"} ce webhook`}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(hook)}
                        disabled={pending}
                        aria-label="Supprimer ce webhook"
                      >
                        <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
