"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  tab: "companies" | "people";
  query: string;
  tag: string;
  tags: { name: string; color: string }[];
  companiesCount?: number;
  peopleCount?: number;
};

export function ContactsToolbar({ tab, query, tag, tags, companiesCount, peopleCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(query);
  const [, startTransition] = useTransition();

  // Recherche différée : on ne relance pas une requête à chaque frappe.
  useEffect(() => {
    if (term === query) return;
    const timer = setTimeout(() => {
      startTransition(() => router.replace(buildUrl({ q: term }), { scroll: false }));
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  function buildUrl(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    return qs ? `/contacts?${qs}` : "/contacts";
  }

  const count = tab === "companies" ? companiesCount : peopleCount;

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border bg-card p-0.5">
          <TabLink
            active={tab === "companies"}
            href={buildUrl({ tab: null })}
            label="Entreprises"
          />
          <TabLink
            active={tab === "people"}
            href={buildUrl({ tab: "people" })}
            label="Personnes"
          />
        </div>

        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={tab === "companies" ? "Nom, e-mail, ville…" : "Nom, e-mail…"}
            aria-label="Rechercher"
            className="h-8 pl-8"
          />
        </div>

        {count !== undefined ? (
          <span className="tabular text-sm text-muted-foreground">
            {count} résultat{count > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => {
            const active = tag === t.name;
            return (
              <button
                key={t.name}
                type="button"
                onClick={() =>
                  startTransition(() =>
                    router.replace(buildUrl({ tag: active ? null : t.name }), {
                      scroll: false,
                    }),
                  )
                }
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors duration-150",
                  active
                    ? "border-primary bg-brand-soft font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {t.name}
              </button>
            );
          })}
          {tag ? (
            <button
              type="button"
              onClick={() =>
                startTransition(() => router.replace(buildUrl({ tag: null }), { scroll: false }))
              }
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" strokeWidth={2} aria-hidden />
              Retirer le filtre
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TabLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.replace(href, { scroll: false })}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-[calc(var(--radius)*0.6)] px-2.5 py-1 text-sm transition-colors duration-150",
        active
          ? "bg-brand-soft font-medium text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
