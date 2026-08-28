import { AlertCircle, CheckCircle2 } from "lucide-react";
import { formatDateTime, formatRelative } from "@/lib/format";
import { ACTION_LABELS, type ActionType } from "@/lib/automations/types";

export type Run = {
  id: string;
  status: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
  ruleName: string;
};

export function RunLog({ runs }: { runs: Run[] }) {
  return (
    <ul className="flex flex-col rounded-lg border bg-card">
      {runs.map((run) => {
        const failed = run.status !== "success";
        const action = run.detail?.action as ActionType | undefined;
        const error = run.detail?.error as string | undefined;

        return (
          <li key={run.id} className="flex items-start gap-3 border-b p-3 last:border-b-0">
            {failed ? (
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-danger"
                strokeWidth={1.75}
                aria-label="Échec"
              />
            ) : (
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-success"
                strokeWidth={1.75}
                aria-label="Succès"
              />
            )}

            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{run.ruleName}</span>
                {action ? (
                  <span className="text-muted-foreground">
                    {" — "}
                    {ACTION_LABELS[action] ?? action}
                  </span>
                ) : null}
              </p>
              {error ? <p className="mt-0.5 text-xs text-danger">{error}</p> : null}
            </div>

            <time
              dateTime={run.createdAt}
              title={formatDateTime(run.createdAt)}
              className="shrink-0 text-xs text-muted-foreground"
            >
              {formatRelative(run.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
