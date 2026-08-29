"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CalendarCheck2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rescheduleTask } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

export type CalendarTask = {
  id: string;
  title: string;
  dueAt: string;
  done: boolean;
  priority: "low" | "normal" | "high";
  syncedToCalendar: boolean;
  companyId: string | null;
  companyName: string | null;
};

const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

/** Clé de jour locale — pas d'UTC, sinon une relance de 23 h change de case. */
function dayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Grille complète : semaines entières, du lundi au dimanche. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  // Une sixième semaine vide n'apporte rien : on la retire quand elle sort du mois.
  const lastVisible = days[35];
  return lastVisible.getMonth() === month ? days : days.slice(0, 35);
}

export function CalendarView({ tasks }: { tasks: CalendarTask[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const days = useMemo(
    () => monthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const task of tasks) {
      const key = dayKey(new Date(task.dueAt));
      const list = map.get(key);
      if (list) list.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [tasks]);

  const monthLabel = new Intl.DateTimeFormat("fr-BE", {
    month: "long",
    year: "numeric",
  }).format(cursor);

  const todayKey = dayKey(today);

  function shift(months: number) {
    setCursor(
      (current) => new Date(current.getFullYear(), current.getMonth() + months, 1),
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const target = event.over ? String(event.over.id) : null;
    if (!target) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || dayKey(new Date(task.dueAt)) === target) return;

    startTransition(async () => {
      const result = await rescheduleTask(taskId, target);
      if (result.ok) {
        toast.success("Relance déplacée", {
          description: task.syncedToCalendar
            ? "L'événement d'agenda suit."
            : undefined,
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => shift(-1)}
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => shift(1)}
            aria-label="Mois suivant"
          >
            <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
          </Button>
          <h2 className="text-sm font-medium first-letter:uppercase">{monthLabel}</h2>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            Aujourd&apos;hui
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[44rem]">
            <div className="grid grid-cols-7 gap-px border-b pb-1.5">
              {WEEKDAYS.map((day) => (
                <span
                  key={day}
                  className="px-1 text-xs font-medium text-muted-foreground"
                >
                  {day}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-border">
              {days.map((day) => (
                <DayCell
                  key={dayKey(day)}
                  day={day}
                  tasks={byDay.get(dayKey(day)) ?? []}
                  inMonth={day.getMonth() === cursor.getMonth()}
                  isToday={dayKey(day) === todayKey}
                  pending={pending}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Glisse une relance sur un autre jour pour la reporter. L&apos;heure est
          conservée, et l&apos;événement d&apos;agenda suit.
        </p>
      </div>
    </DndContext>
  );
}

function DayCell({
  day,
  tasks,
  inMonth,
  isToday,
  pending,
}: {
  day: Date;
  tasks: CalendarTask[];
  inMonth: boolean;
  isToday: boolean;
  pending: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(day) });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-24 flex-col gap-1 p-1.5 transition-colors duration-150",
        inMonth ? "bg-card" : "bg-surface",
        isOver && "bg-brand-soft",
      )}
    >
      <span
        className={cn(
          "tabular self-start rounded px-1 text-xs",
          isToday
            ? "bg-primary font-medium text-primary-foreground"
            : inMonth
              ? "text-muted-foreground"
              : "text-muted-foreground/50",
        )}
      >
        {day.getDate()}
      </span>

      {tasks.map((task) => (
        <CalendarChip key={task.id} task={task} disabled={pending} />
      ))}
    </div>
  );
}

function CalendarChip({
  task,
  disabled,
}: {
  task: CalendarTask;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled,
  });

  const time = new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(task.dueAt));

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab rounded border-l-2 bg-surface px-1.5 py-1 text-[11px] leading-tight",
        task.done && "opacity-50 line-through",
        isDragging && "opacity-40",
      )}
      style={{
        borderLeftColor:
          task.priority === "high"
            ? "var(--warning)"
            : task.priority === "low"
              ? "var(--muted-foreground)"
              : "var(--info)",
      }}
    >
      <span className="flex items-center gap-1">
        <span className="tabular shrink-0 text-muted-foreground">{time}</span>
        {task.syncedToCalendar ? (
          <CalendarCheck2
            className="size-2.5 shrink-0 text-muted-foreground"
            strokeWidth={2}
            aria-label="Dans ton agenda"
          />
        ) : null}
      </span>

      {task.companyId ? (
        <Link
          href={`/companies/${task.companyId}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="block truncate font-medium hover:underline"
        >
          {task.title}
        </Link>
      ) : (
        <span className="block truncate font-medium">{task.title}</span>
      )}
    </div>
  );
}
