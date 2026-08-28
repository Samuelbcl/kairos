"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RuleDialog } from "./rule-dialog";
import { RuleSummary } from "./rule-summary";
import { deleteAutomation, toggleAutomation } from "@/server/actions/automations";
import type { Rule } from "@/lib/automations/types";
import { cn } from "@/lib/utils";

type Stage = { id: string; name: string; color?: string };

export function AutomationList({
  rules,
  stages,
}: {
  rules: Rule[];
  stages: Stage[];
}) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const visible = rules.filter((rule) => !removed.has(rule.id));

  function toggle(rule: Rule, enabled: boolean) {
    startTransition(async () => {
      const result = await toggleAutomation(rule.id, enabled);
      if (result.ok) {
        toast.success(enabled ? "Règle activée" : "Règle désactivée");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(rule: Rule) {
    setRemoved((current) => new Set(current).add(rule.id));
    startTransition(async () => {
      const result = await deleteAutomation(rule.id);
      if (result.ok) {
        toast.success("Règle supprimée");
        router.refresh();
      } else {
        setRemoved((current) => {
          const next = new Set(current);
          next.delete(rule.id);
          return next;
        });
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {visible.map((rule) => (
        <Card key={rule.id} className={cn(!rule.enabled && "opacity-60")}>
          <CardContent className="flex flex-wrap items-start gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{rule.name}</p>
              <div className="mt-2">
                <RuleSummary
                  trigger={rule.trigger}
                  conditions={rule.conditions}
                  actions={rule.actions}
                  stages={stages}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(v) => toggle(rule, v === true)}
                disabled={pending}
                aria-label={`${rule.enabled ? "Désactiver" : "Activer"} ${rule.name}`}
              />

              <RuleDialog
                stages={stages}
                rule={rule}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${rule.name}`}>
                    <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </Button>
                }
              />

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(rule)}
                disabled={pending}
                aria-label={`Supprimer ${rule.name}`}
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
