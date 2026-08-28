"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApiKey, revokeApiKey } from "@/server/actions/api-keys";
import { formatDate, formatRelative } from "@/lib/format";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
};

export function ApiKeysPanel({
  keys,
  canManage,
}: {
  keys: ApiKey[];
  canManage: boolean;
}) {
  const [name, setName] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function create() {
    startTransition(async () => {
      const result = await createApiKey(name);
      if (result.ok) {
        setFreshKey(result.data.key);
        setName("");
        toast.success("Clé créée");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function copy() {
    if (!freshKey) return;
    try {
      await navigator.clipboard.writeText(freshKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible. Sélectionne la clé et copie-la à la main.");
    }
  }

  function revoke(key: ApiKey) {
    startTransition(async () => {
      const result = await revokeApiKey(key.id);
      if (result.ok) {
        toast.success(`Clé « ${key.name} » révoquée`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <KeyRound className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          Clés API
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {freshKey ? (
          <Alert>
            <AlertTitle>Copie cette clé maintenant</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>
                Elle ne sera plus jamais affichée : seul son empreinte est conservée.
              </span>
              <span className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border bg-surface px-2.5 py-1.5 font-mono text-xs">
                  {freshKey}
                </code>
                <Button variant="outline" size="sm" onClick={copy}>
                  {copied ? (
                    <Check className="size-3.5 text-success" strokeWidth={2} aria-hidden />
                  ) : (
                    <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
                  )}
                  {copied ? "Copiée" : "Copier"}
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        ) : null}

        {canManage ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor="key-name">Nouvelle clé</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Make — synchro devis"
                disabled={pending}
              />
            </div>
            <Button onClick={create} disabled={pending || !name.trim()}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" strokeWidth={2} aria-hidden />
              )}
              Créer
            </Button>
          </div>
        ) : null}

        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune clé. Crées-en une pour brancher Make, Zapier, n8n ou ton propre code.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {keys.map((key) => (
              <li key={key.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <code className="font-mono">{key.prefix}…</code> · créée le{" "}
                    {formatDate(key.created_at)}
                    {key.last_used_at
                      ? ` · dernière utilisation ${formatRelative(key.last_used_at)}`
                      : " · jamais utilisée"}
                  </p>
                </div>

                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => revoke(key)}
                    disabled={pending}
                    aria-label={`Révoquer la clé ${key.name}`}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
