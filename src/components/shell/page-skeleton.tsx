import { Skeleton } from "@/components/ui/skeleton";

/**
 * Squelettes de chargement. Le but n'est pas de faire joli mais de montrer la
 * forme de ce qui arrive : une page qui apparaît d'un bloc après deux secondes
 * de blanc donne l'impression que rien ne s'est passé au clic.
 */
export function PageSkeleton({
  variant = "list",
}: {
  variant?: "list" | "board" | "detail" | "cards";
}) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>

      {variant === "board" ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, column) => (
            <div key={column} className="flex w-72 shrink-0 flex-col gap-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              {Array.from({ length: 3 - (column % 2) }).map((_, card) => (
                <Skeleton key={card} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {variant === "list" ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
          {Array.from({ length: 8 }).map((_, row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-28 sm:block" />
              <Skeleton className="hidden h-4 w-20 md:block" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, card) => (
            <Skeleton key={card} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : null}

      {variant === "detail" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            {Array.from({ length: 9 }).map((_, row) => (
              <div key={row} className="grid grid-cols-[8rem_1fr] gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
          <Skeleton className="h-56 rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}
