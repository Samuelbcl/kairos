"use client";

import { useState, useTransition } from "react";
import { CalendarCheck2, CalendarClock, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeTask, createTask } from "@/server/actions/tasks";
import { formatDue, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PanelTask = {
  id: string;
  title: string;
  due_at: string;
  done: boolean;
  priority: "low" | "normal" | "high";
  external_event_id: string | null;
};

type Target = {
  company_id?: string;
  contact_id?: string;
  deal_id?: string;
};

/** Délais proposés — les mêmes que ceux qu'on utilise à la main. */
const PRESETS = [
  { days: 2, label: "Dans 2 jours" },
  { days: 5, label: "Dans 5 jours" },
  { days: 7, label: "Dans 1 semaine" },
  { days: 14, label: "Dans 2 semaines" },
  { days: 30, label: "Dans 1 mois" },
];

function defaultDue(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  // Format attendu par datetime-local, en heure locale.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TaskPanel({
  tasks,
  target,
  defaultTitle,
}: {
  tasks: PanelTask[];
  target: Target;
  defaultTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState(() => defaultDue(5));
  const [title, setTitle] = useState(defaultTitle);
  const [remind, setRemind] = useState("60");
  const [pending, startTransition] = useTransition();

  const pendingTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  function submit() {
    startTransition(async () => {
      const result = await createTask({
        ...target,
        title,
        due_at: due,
        remind_before_min: Number(remind),
        kind: "follow_up",
        priority: "normal",
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      setTitle(defaultTitle);
      setDue(defaultDue(5));

      if (result.data.synced) {
        toast.success("Relance programmée", {
          description: "L'événement est dans ton agenda, avec rappel.",
        });
      } else {
        toast.success("Relance programmée", {
          description: result.data.syncNote,
        });
      }
    });
  }

  function complete(id: string) {
    startTransition(async () => {
      const result = await completeTask(id);
      if (result.ok) toast.success("Relance terminée");
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarClock className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          Relances
        </CardTitle>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fermer le formulaire" : "Programmer une relance"}
          aria-expanded={open}
        >
          <Plus
            className={cn("size-4 transition-transform duration-150", open && "rotate-45")}
            strokeWidth={2}
            aria-hidden
          />
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {open ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-surface p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-title">Intitulé</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={pending}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => setDue(defaultDue(preset.days))}
                  disabled={pending}
                  className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-due">Échéance</Label>
                <Input
                  id="task-due"
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-remind">Rappel</Label>
                <Select value={remind} onValueChange={(v) => setRemind(String(v))} disabled={pending}>
                  <SelectTrigger id="task-remind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Aucun</SelectItem>
                    <SelectItem value="15">15 min avant</SelectItem>
                    <SelectItem value="60">1 h avant</SelectItem>
                    <SelectItem value="1440">1 jour avant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={submit} disabled={pending || !title.trim()}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Programmer la relance
            </Button>
          </div>
        ) : null}

        {pendingTasks.length === 0 && doneTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune relance prévue. Programme-en une pour ne pas l&apos;oublier.
          </p>
        ) : null}

        {pendingTasks.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {pendingTasks.map((task) => {
              const overdue = isOverdue(task.due_at);
              return (
                <li key={task.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => complete(task.id)}
                    disabled={pending}
                    aria-label={`Terminer : ${task.title}`}
                    className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-transparent transition-colors duration-150 hover:border-success hover:text-success"
                  >
                    <Check className="size-3" strokeWidth={2.5} aria-hidden />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{task.title}</p>
                    <p
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        overdue ? "text-danger" : "text-muted-foreground",
                      )}
                    >
                      {formatDue(task.due_at)}
                      {task.external_event_id ? (
                        <CalendarCheck2
                          className="size-3"
                          strokeWidth={1.75}
                          aria-label="Synchronisée avec l'agenda"
                        />
                      ) : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {doneTasks.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {doneTasks.length} relance{doneTasks.length > 1 ? "s" : ""} terminée
              {doneTasks.length > 1 ? "s" : ""}
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {doneTasks.map((task) => (
                <li key={task.id} className="text-xs text-muted-foreground line-through">
                  {task.title}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
