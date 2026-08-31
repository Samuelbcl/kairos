"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, Mails } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { createMailMerge, type MergeReport } from "@/server/actions/mail-merge";

export type MergeTemplate = {
  id: string;
  name: string;
  subject: string;
};

/**
 * Publipostage : un brouillon Gmail par entreprise sélectionnée.
 *
 * Volontairement des brouillons, pas un envoi. L'utilisateur relit et expédie
 * depuis Gmail : les messages partent de sa vraie adresse, avec sa signature,
 * et les réponses reviennent dans sa boîte.
 */
export function MailMergeDialog({
  companyIds,
  templates,
  onDone,
}: {
  companyIds: string[];
  templates: MergeTemplate[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [report, setReport] = useState<MergeReport | null>(null);
  const [pending, startTransition] = useTransition();

  const count = companyIds.length;
  const template = templates.find((t) => t.id === templateId);

  function run() {
    startTransition(async () => {
      const result = await createMailMerge({ templateId, companyIds });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setReport(result.data);
      toast.success(
        `${result.data.created} brouillon${result.data.created > 1 ? "s" : ""} créé${result.data.created > 1 ? "s" : ""} dans Gmail.`,
      );
    });
  }

  function close() {
    setOpen(false);
    if (report) {
      setReport(null);
      onDone();
    }
  }

  if (!templates.length) {
    return (
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<a href="/settings/emails" />}
      >
        <Mails className="size-3.5" strokeWidth={1.75} aria-hidden />
        Créer un modèle d&apos;abord
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Mails className="size-3.5" strokeWidth={1.75} aria-hidden />
            Publipostage
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        {report ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {report.created} brouillon{report.created > 1 ? "s" : ""} dans ta
                boîte
              </DialogTitle>
              <DialogDescription>
                Rien n&apos;est parti. Relis-les dans Gmail, puis envoie —
                depuis ton adresse, avec ta signature.
              </DialogDescription>
            </DialogHeader>

            {report.skipped.length ? (
              <div className="flex flex-col gap-1.5 rounded-md border bg-surface p-3">
                <p className="text-sm font-medium">
                  {report.skipped.length} entreprise
                  {report.skipped.length > 1 ? "s" : ""} ignorée
                  {report.skipped.length > 1 ? "s" : ""}
                </p>
                <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {report.skipped.slice(0, 8).map((s) => (
                    <li key={s.name}>
                      {s.name} — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                Fermer
              </Button>
              <Button
                nativeButton={false}
                render={
                  <a
                    href="https://mail.google.com/mail/u/0/#drafts"
                    target="_blank"
                    rel="noreferrer noopener"
                  />
                }
              >
                Ouvrir mes brouillons
                <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                Publipostage — {count} entreprise{count > 1 ? "s" : ""}
              </DialogTitle>
              <DialogDescription>
                Un brouillon par entreprise, personnalisé, déposé dans ton
                Gmail. Aucun message n&apos;est envoyé.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="merge-template">Modèle</Label>
              <Select value={templateId} onValueChange={(v) => setTemplateId(v ?? "")}>
                <SelectTrigger id="merge-template">
                  {template?.name ?? "Choisir"}
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {template?.subject ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Objet : {template.subject}
                </p>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              Les entreprises sans adresse seront ignorées et listées à la fin.
            </p>

            <DialogFooter>
              <Button variant="ghost" onClick={close} disabled={pending}>
                Annuler
              </Button>
              <Button onClick={run} disabled={pending || !templateId}>
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} aria-hidden />
                ) : null}
                Créer {count} brouillon{count > 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
