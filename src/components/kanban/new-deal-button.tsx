"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDeal } from "@/server/actions/deals";
import { createClient } from "@/lib/supabase/client";
import type { BoardStage } from "./board";

const NO_COMPANY = "__none__";

export function NewDealButton({ stages }: { stages: BoardStage[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [companyId, setCompanyId] = useState(NO_COMPANY);
  const router = useRouter();

  // Chargé à l'ouverture seulement : inutile de payer la requête sinon.
  useEffect(() => {
    if (!open || companies.length) return;
    const supabase = createClient();
    supabase
      .from("companies")
      .select("id, name")
      .order("name")
      .limit(500)
      .then(({ data }) => setCompanies(data ?? []));
  }, [open, companies.length]);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createDeal({
        title: formData.get("title"),
        value: formData.get("value"),
        stage_id: stageId,
        company_id: companyId === NO_COMPANY ? "" : companyId,
        priority: formData.get("priority") ?? "normal",
      });

      if (result.ok) {
        toast.success("Opportunité créée");
        setOpen(false);
        setCompanyId(NO_COMPANY);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            Nouvelle opportunité
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle opportunité</DialogTitle>
          <DialogDescription>
            Elle apparaîtra dans la colonne choisie, prête à être déplacée.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deal-title">Titre</Label>
            <Input
              id="deal-title"
              name="title"
              required
              autoFocus
              placeholder="Site vitrine Menuiserie Dupont"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deal-company">Entreprise</Label>
            <Select value={companyId} onValueChange={(v) => setCompanyId(String(v))}>
              <SelectTrigger id="deal-company">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COMPANY}>Aucune</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deal-stage">Étape</Label>
              <Select value={stageId} onValueChange={(v) => setStageId(String(v))}>
                <SelectTrigger id="deal-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deal-value">Montant (€)</Label>
              <Input id="deal-value" name="value" type="number" min="0" step="100" placeholder="0" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deal-priority">Priorité</Label>
            <Select name="priority" defaultValue="normal">
              <SelectTrigger id="deal-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Basse</SelectItem>
                <SelectItem value="normal">Normale</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !stageId}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
