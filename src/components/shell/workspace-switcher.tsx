"use client";

import { useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchWorkspace } from "@/server/actions/workspace";
import { cn } from "@/lib/utils";

export type WorkspaceOption = { id: string; name: string; brandName: string };

export function WorkspaceSwitcher({
  workspaces,
  currentId,
}: {
  workspaces: WorkspaceOption[];
  currentId: string;
}) {
  const [pending, startTransition] = useTransition();
  const current = workspaces.find((w) => w.id === currentId);

  // Un seul espace : pas de menu, juste le nom.
  if (workspaces.length <= 1) {
    return (
      <span className="truncate text-sm font-semibold">
        {current?.brandName ?? "Kairos"}
      </span>
    );
  }

  function select(id: string) {
    if (id === currentId) return;
    startTransition(async () => {
      const result = await switchWorkspace(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={pending}
            className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-semibold transition-colors duration-150 hover:bg-accent disabled:opacity-60"
          >
            <span className="truncate">{current?.brandName ?? "Kairos"}</span>
            <ChevronsUpDown
              className="size-3.5 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Espaces de travail
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onClick={() => select(w.id)}>
            <Check
              className={cn(
                "size-4 shrink-0",
                w.id === currentId ? "opacity-100 text-primary" : "opacity-0",
              )}
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="truncate">{w.brandName}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
