"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
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
import { deleteCompany } from "@/server/actions/companies";
import { deleteContact } from "@/server/actions/contacts";

type Props = {
  id: string;
  name: string;
  /** Une entreprise emporte ses contacts, deals et relances. */
  kind?: "company" | "contact";
};

export function DeleteCompanyButton({ id, name, kind = "company" }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isCompany = kind === "company";

  function confirm() {
    startTransition(async () => {
      const result = isCompany ? await deleteCompany(id) : await deleteContact(id);
      if (result.ok) {
        toast.success(`${name} supprimé${isCompany ? "e" : ""}`);
        router.push("/contacts");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${name}`}>
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer {name} ?</DialogTitle>
          <DialogDescription>
            {isCompany
              ? "Les personnes, opportunités et relances rattachées seront supprimées avec l'entreprise. Cette action est définitive."
              : "Les relances rattachées à cette personne seront supprimées. Cette action est définitive."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Supprimer définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
