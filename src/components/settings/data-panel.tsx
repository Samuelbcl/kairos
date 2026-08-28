"use client";

import { useState, useTransition } from "react";
import { Database, Download, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteWorkspace, exportWorkspaceData } from "@/server/actions/data";

export function DataPanel({
  workspaceName,
  isOwner,
}: {
  workspaceName: string;
  isOwner: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function exportData() {
    startTransition(async () => {
      const result = await exportWorkspaceData();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      // Téléchargement côté navigateur : le fichier ne transite par aucun serveur tiers.
      const blob = new Blob([result.data.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.data.filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Export téléchargé");
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteWorkspace(confirmation);
      // En cas de succès, l'action redirige : on n'arrive ici que sur échec.
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          Tes données
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            Export complet au format JSON : entreprises, contacts, opportunités,
            relances, historique, étapes et champs personnalisés. Les jetons
            d&apos;agenda et les secrets ne sont jamais exportés.
          </p>
          <Button variant="outline" size="sm" onClick={exportData} disabled={pending}>
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3.5" strokeWidth={1.75} aria-hidden />
            )}
            Exporter mes données
          </Button>
        </div>

        {isOwner ? (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-danger">
              <TriangleAlert className="size-4" strokeWidth={1.75} aria-hidden />
              Supprimer cet espace
            </p>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">
              Efface définitivement l&apos;espace et tout son contenu. Aucune
              récupération n&apos;est possible — exporte tes données d&apos;abord.
            </p>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button variant="destructive" size="sm">
                    Supprimer l&apos;espace
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Supprimer « {workspaceName} » ?</DialogTitle>
                  <DialogDescription>
                    Toutes les entreprises, contacts, opportunités, relances et
                    l&apos;historique seront effacés définitivement.
                  </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="delete-confirm">
                    Saisis « {workspaceName} » pour confirmer
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmDelete}
                    disabled={pending || confirmation !== workspaceName}
                  >
                    {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Supprimer définitivement
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Hébergement dans l&apos;Union européenne (Supabase, région eu-central-1).
          Chaque espace est cloisonné au niveau de la base par des règles de sécurité
          ligne à ligne, pas seulement dans l&apos;interface.
        </p>
      </CardContent>
    </Card>
  );
}
