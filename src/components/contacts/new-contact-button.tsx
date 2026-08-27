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
import { createContact } from "@/server/actions/contacts";

export function NewContactButton({ companyId }: { companyId?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const payload = Object.fromEntries(formData);
      if (companyId) payload.company_id = companyId;

      const result = await createContact(payload);
      if (result.ok) {
        toast.success("Contact ajouté");
        setOpen(false);
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
          <Button variant="ghost" size="icon-sm" aria-label="Ajouter une personne">
            <Plus className="size-4" strokeWidth={2} aria-hidden />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle personne</DialogTitle>
          <DialogDescription>
            Un nom ou une adresse e-mail suffit pour démarrer.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-first">Prénom</Label>
              <Input id="contact-first" name="first_name" autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-last">Nom</Label>
              <Input id="contact-last" name="last_name" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-email">E-mail</Label>
            <Input id="contact-email" name="email" type="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-role">Fonction</Label>
            <Input id="contact-role" name="role_title" placeholder="Gérant, acheteur…" />
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
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
