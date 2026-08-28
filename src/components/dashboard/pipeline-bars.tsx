import { formatMoney } from "@/lib/format";

type StageBar = {
  id: string;
  name: string;
  color: string;
  count: number;
  value: number;
};

/**
 * Barres horizontales proportionnelles à la valeur de chaque étape.
 * Pas de librairie de graphiques : une div suffit, et reste lisible partout.
 */
export function PipelineBars({
  stages,
  total,
}: {
  stages: StageBar[];
  total: number;
}) {
  const max = Math.max(...stages.map((s) => s.value), 1);

  if (stages.every((s) => s.count === 0)) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune opportunité ouverte. Crées-en une depuis le pipeline.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage) => (
        <div key={stage.id}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
                aria-hidden
              />
              <span className="truncate">{stage.name}</span>
              <span className="tabular shrink-0 text-xs text-muted-foreground">
                {stage.count}
              </span>
            </span>
            <span className="tabular shrink-0 text-xs text-muted-foreground">
              {stage.value > 0 ? formatMoney(stage.value) : "—"}
            </span>
          </div>

          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${stage.name} : ${stage.count} opportunité${stage.count > 1 ? "s" : ""}, ${formatMoney(stage.value)}`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${Math.max((stage.value / max) * 100, stage.count > 0 ? 3 : 0)}%`,
                backgroundColor: stage.color,
              }}
            />
          </div>
        </div>
      ))}

      <p className="tabular mt-1 border-t pt-3 text-sm">
        Total ouvert : <span className="font-medium">{formatMoney(total)}</span>
      </p>
    </div>
  );
}
