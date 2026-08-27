import {
  ArrowRight,
  CircleDot,
  Mail,
  MessageSquare,
  Phone,
  Users,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { Database } from "@/types/db";

type ActivityType = Database["public"]["Enums"]["activity_type"];

export type TimelineEntry = {
  id: string;
  type: ActivityType;
  content: string | null;
  created_at: string;
  author: string | null;
};

const ICONS: Record<ActivityType, LucideIcon> = {
  note: MessageSquare,
  email: Mail,
  call: Phone,
  meeting: Users,
  task: CheckCircle2,
  stage_change: ArrowRight,
  system: CircleDot,
};

const FALLBACK_LABELS: Record<ActivityType, string> = {
  note: "Note",
  email: "E-mail",
  call: "Appel",
  meeting: "Rendez-vous",
  task: "Relance",
  stage_change: "Changement d'étape",
  system: "Événement",
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        Rien dans l&apos;historique. Ajoute une note pour garder une trace de tes échanges.
      </p>
    );
  }

  return (
    <ol className="relative flex flex-col gap-4 pl-6">
      {/* Filet vertical reliant les entrées */}
      <span
        className="absolute top-1 bottom-1 left-[9px] w-px bg-border"
        aria-hidden
      />
      {entries.map((entry) => {
        const Icon = ICONS[entry.type];
        return (
          <li key={entry.id} className="relative">
            <span className="absolute top-0.5 -left-6 grid size-[19px] place-items-center rounded-full border bg-card">
              <Icon
                className="size-3 text-muted-foreground"
                strokeWidth={2}
                aria-hidden
              />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium">
                {entry.content ?? FALLBACK_LABELS[entry.type]}
              </span>
              <time
                dateTime={entry.created_at}
                title={formatDateTime(entry.created_at)}
                className="text-xs text-muted-foreground"
              >
                {formatRelative(entry.created_at)}
              </time>
            </div>
            {entry.author ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{entry.author}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
