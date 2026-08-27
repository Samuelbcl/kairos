"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createTask } from "@/server/actions/tasks";
import { formatMoney, formatRelative } from "@/lib/format";

export type StaleDeal = {
  id: string;
  title: string;
  value: number;
  currency: string;
  lastActivityAt: string | null;
  companyId: string | null;
  companyName: string | null;
  stageName: string | null;
  stageColor: string | null;
};

/** Programme une relance à J+2 à 9 h, en heure locale. */
function inTwoDays() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

export function StaleDeals({ deals }: { deals: StaleDeal[] }) {
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = deals.filter((deal) => !handled.has(deal.id));
  if (visible.length === 0) return null;

  function scheduleFollowUp(deal: StaleDeal) {
    startTransition(async () => {
      const result = await createTask({
        title: `Relancer ${deal.companyName ?? deal.title}`,
        due_at: inTwoDays(),
        remind_before_min: 60,
        kind: "follow_up",
        priority: "normal",
        deal_id: deal.id,
        company_id: deal.companyId ?? undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setHandled((current) => new Set(current).add(deal.id));
      toast.success("Relance programmée dans 2 jours", {
        description: result.data.synced
          ? "L'événement est dans ton agenda."
          : result.data.syncNote,
      });
    });
  }

  return (
    <ul className="flex flex-col rounded-lg border bg-card">
      {visible.map((deal) => (
        <li key={deal.id} className="flex flex-wrap items-center gap-3 border-b p-3 last:border-b-0">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{deal.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {deal.companyName && deal.companyId ? (
                <Link href={`/companies/${deal.companyId}`} className="hover:underline">
                  {deal.companyName}
                </Link>
              ) : null}
              {deal.value > 0 ? (
                <span className="tabular">{formatMoney(deal.value, deal.currency)}</span>
              ) : null}
              {deal.lastActivityAt ? (
                <span>Dernière activité {formatRelative(deal.lastActivityAt)}</span>
              ) : null}
            </p>
          </div>

          {deal.stageName ? (
            <Badge
              variant="secondary"
              style={
                deal.stageColor
                  ? {
                      backgroundColor: `color-mix(in oklch, ${deal.stageColor} 15%, transparent)`,
                      color: deal.stageColor,
                    }
                  : undefined
              }
            >
              {deal.stageName}
            </Badge>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={() => scheduleFollowUp(deal)}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Programmer une relance
          </Button>
        </li>
      ))}
    </ul>
  );
}
