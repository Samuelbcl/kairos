"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarCheck2,
  Check,
  Clock,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Target,
  Trash2,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { completeTask, deleteTask, snoozeTask } from "@/server/actions/tasks";
import { formatDue, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/db";

type TaskKind = Database["public"]["Enums"]["task_kind"];

export type ListTask = {
  id: string;
  title: string;
  kind: TaskKind;
  dueAt: string;
  priority: "low" | "normal" | "high";
  syncedToCalendar: boolean;
  company: { id: string; name: string } | null;
  contactId: string | null;
  contactName: string | null;
  dealTitle: string | null;
};

const KIND_ICONS: Record<TaskKind, LucideIcon> = {
  follow_up: Clock,
  call: Phone,
  email: Mail,
  meeting: Users,
  todo: Check,
};

const SNOOZE_OPTIONS = [
  { days: 1, label: "Demain" },
  { days: 3, label: "Dans 3 jours" },
  { days: 7, label: "Dans 1 semaine" },
];

export function TaskList({
  title,
  tasks,
  count,
  tone,
  muted,
}: {
  title: string;
  tasks: ListTask[];
  count: number;
  tone?: "danger";
  muted?: boolean;
}) {
  // Retire la ligne dès le clic : l'attente serveur ne doit pas se voir.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = tasks.filter((task) => !hidden.has(task.id));
  if (visible.length === 0) return null;

  function hide(id: string) {
    setHidden((current) => new Set(current).add(id));
  }

  function restore(id: string) {
    setHidden((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function complete(task: ListTask) {
    hide(task.id);
    startTransition(async () => {
      const result = await completeTask(task.id);
      if (result.ok) {
        toast.success("Relance terminée", {
          description: task.syncedToCalendar
            ? "L'événement a été retiré de ton agenda."
            : undefined,
        });
      } else {
        restore(task.id);
        toast.error(result.error);
      }
    });
  }

  function snooze(task: ListTask, days: number) {
    hide(task.id);
    startTransition(async () => {
      const result = await snoozeTask({ id: task.id, days });
      if (result.ok) toast.success(`Reportée de ${days} jour${days > 1 ? "s" : ""}`);
      else {
        restore(task.id);
        toast.error(result.error);
      }
    });
  }

  function remove(task: ListTask) {
    hide(task.id);
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (result.ok) toast.success("Relance supprimée");
      else {
        restore(task.id);
        toast.error(result.error);
      }
    });
  }

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <span className={cn(tone === "danger" && "text-danger")}>{title}</span>
        <span className="tabular text-xs font-normal text-muted-foreground">{count}</span>
      </h2>

      <ul className={cn("flex flex-col rounded-lg border bg-card", muted && "opacity-90")}>
        {visible.map((task) => {
          const Icon = KIND_ICONS[task.kind];
          const late = isOverdue(task.dueAt);

          return (
            <li
              key={task.id}
              className="flex items-start gap-3 border-b p-3 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => complete(task)}
                disabled={pending}
                aria-label={`Terminer : ${task.title}`}
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-transparent transition-colors duration-150 hover:border-success hover:bg-success hover:text-white"
              >
                <Check className="size-3" strokeWidth={2.5} aria-hidden />
              </button>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon
                    className="size-3.5 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="truncate">{task.title}</span>
                </p>

                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span className={cn(late ? "text-danger" : "text-muted-foreground")}>
                    {formatDue(task.dueAt)}
                  </span>

                  {task.company ? (
                    <Link
                      href={`/companies/${task.company.id}`}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
                    >
                      <Building2 className="size-3" strokeWidth={1.75} aria-hidden />
                      {task.company.name}
                    </Link>
                  ) : null}

                  {task.contactId && task.contactName ? (
                    <Link
                      href={`/contacts/${task.contactId}`}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
                    >
                      <User className="size-3" strokeWidth={1.75} aria-hidden />
                      {task.contactName}
                    </Link>
                  ) : null}

                  {task.dealTitle ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Target className="size-3" strokeWidth={1.75} aria-hidden />
                      {task.dealTitle}
                    </span>
                  ) : null}

                  {task.syncedToCalendar ? (
                    <CalendarCheck2
                      className="size-3 text-muted-foreground"
                      strokeWidth={1.75}
                      aria-label="Dans ton agenda"
                    />
                  ) : null}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {task.company?.name ? (
                  <Button
                    variant="outline"
                    size="xs"
                    render={<Link href={`/companies/${task.company.id}`} />}
                  >
                    Ouvrir
                  </Button>
                ) : null}

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-xs" aria-label="Autres actions">
                        {pending ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <MoreHorizontal className="size-3.5" strokeWidth={2} aria-hidden />
                        )}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    {SNOOZE_OPTIONS.map((option) => (
                      <DropdownMenuItem
                        key={option.days}
                        onClick={() => snooze(task, option.days)}
                      >
                        <Clock className="size-4" strokeWidth={1.75} aria-hidden />
                        Reporter à {option.label.toLowerCase()}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => remove(task)}>
                      <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
