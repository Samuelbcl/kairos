"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { changeMemberRole, removeMember } from "@/server/actions/members";
import type { Member } from "@/app/(app)/settings/members/page";

const ROLE_LABELS: Record<Member["role"], string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
};

export function MembersTable({
  members,
  currentUserId,
  canManage,
}: {
  members: Member[];
  currentUserId: string;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onRoleChange(userId: string, role: string) {
    startTransition(async () => {
      const result = await changeMemberRole(userId, role);
      if (result.ok) toast.success("Rôle mis à jour.");
      else toast.error(result.error);
    });
  }

  function onRemove(userId: string, name: string) {
    startTransition(async () => {
      const result = await removeMember(userId);
      if (result.ok) toast.success(`${name} a été retiré de l'espace.`);
      else toast.error(result.error);
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Membre</TableHead>
            <TableHead className="w-48">Rôle</TableHead>
            {canManage ? <TableHead className="w-16" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const name = member.fullName ?? "Compte sans nom";
            const isMe = member.userId === currentUserId;

            return (
              <TableRow key={member.userId}>
                <TableCell className="font-medium">
                  {name}
                  {isMe ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      toi
                    </span>
                  ) : null}
                </TableCell>

                <TableCell>
                  {canManage ? (
                    <Select
                      value={member.role}
                      onValueChange={(v) => onRoleChange(member.userId, String(v))}
                      disabled={pending}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`Rôle de ${name}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Propriétaire</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                        <SelectItem value="member">Membre</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
                  )}
                </TableCell>

                {canManage ? (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={pending || isMe}
                      aria-label={`Retirer ${name} de l'espace`}
                      onClick={() => onRemove(member.userId, name)}
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
