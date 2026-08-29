"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, RotateCcw, Target, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { restoreFromTrash } from "@/server/actions/trash";
import { formatRelative } from "@/lib/format";

export type TrashedRow = {
  id: string;
  entity: "company" | "contact" | "deal";
  label: string;
  deletedAt: string;
};

const META = {
  company: { icon: Building2, label: "Entreprise" },
  contact: { icon: User, label: "Contact" },
  deal: { icon: Target, label: "Opportunité" },
} as const;

export function TrashList({ rows }: { rows: TrashedRow[] }) {
  const [restored, setRestored] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const visible = rows.filter((row) => !restored.has(row.id));

  function restore(row: TrashedRow) {
    setRestored((current) => new Set(current).add(row.id));

    startTransition(async () => {
      const result = await restoreFromTrash(row.entity, row.id);
      if (result.ok) {
        toast.success(`« ${row.label} » restauré`);
        router.refresh();
      } else {
        setRestored((current) => {
          const next = new Set(current);
          next.delete(row.id);
          return next;
        });
        toast.error(result.error);
      }
    });
  }

  return (
    <ul className="flex flex-col rounded-lg border bg-card">
      {visible.map((row) => {
        const { icon: Icon, label } = META[row.entity];
        return (
          <li
            key={`${row.entity}-${row.id}`}
            className="flex items-center gap-3 border-b p-3 last:border-b-0"
          >
            <Icon
              className="size-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.label}</p>
              <p className="text-xs text-muted-foreground">
                Supprimé {formatRelative(row.deletedAt)}
              </p>
            </div>

            <Badge variant="secondary" className="shrink-0">
              {label}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() => restore(row)}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
              )}
              Restaurer
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
