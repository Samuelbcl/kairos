"use client";

import { useState, useTransition } from "react";
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
import { createCompany } from "@/server/actions/companies";

export function NewCompanyButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createCompany(Object.fromEntries(formData));
      if (result.ok) {
        toast.success(`${result.data.name} ajoutée`);
        setOpen(false);
        router.push(`/companies/${result.data.id}`);
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
            Ajouter une entreprise
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle entreprise</DialogTitle>
          <DialogDescription>
            Seul le nom est obligatoire. Le reste se complète depuis la fiche.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="flex flex-col gap-3">
          <Field name="name" label="Nom" required autoFocus placeholder="Menuiserie Dupont" />
          <Field name="email" label="E-mail" type="email" placeholder="info@exemple.be" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="sector" label="Secteur" placeholder="Menuiserie" />
            <Field name="city" label="Ville" placeholder="Liège" />
          </div>
          <Field name="tags" label="Tags" placeholder="prospect, liège (séparés par une virgule)" />

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  name,
  label,
  ...props
}: React.ComponentProps<typeof Input> & { name: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`company-${name}`}>{label}</Label>
      <Input id={`company-${name}`} name={name} {...props} />
    </div>
  );
}
