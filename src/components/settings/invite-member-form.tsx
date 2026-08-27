"use client";

import { useRef, useTransition } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteMember } from "@/server/actions/members";

export function InviteMemberForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await inviteMember(formData);
      if (result.ok) {
        toast.success(result.data.message);
        formRef.current?.reset();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="py-5">
        <form
          ref={formRef}
          action={onSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="invite-email">Inviter par e-mail</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="collegue@entreprise.be"
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:w-40">
            <Label htmlFor="invite-role">Rôle</Label>
            <Select name="role" defaultValue="member" disabled={pending}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membre</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
            )}
            Inviter
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
