"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarClock,
  LayoutDashboard,
  Loader2,
  Plus,
  Search,
  Settings,
  Target,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchEverything } from "@/server/actions/contacts";
import { createCompany } from "@/server/actions/companies";

type Results = {
  companies: { id: string; name: string; city: string | null }[];
  contacts: {
    id: string;
    name: string;
    email: string | null;
    companyName: string | null;
  }[];
  deals: { id: string; title: string; stage: string | null }[];
};

const EMPTY: Results = { companies: [], contacts: [], deals: [] };

const NAV = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/today", label: "Aujourd'hui", icon: CalendarClock },
  { href: "/pipeline", label: "Pipeline", icon: Target },
  { href: "/contacts", label: "Contacts", icon: Building2 },
  { href: "/automations", label: "Automatisations", icon: Zap },
  { href: "/settings/workspace", label: "Réglages", icon: Settings },
];

/**
 * Barre de commande globale. Ouverte par ⌘K / Ctrl+K depuis n'importe où.
 * Cherche dans tout l'espace et permet de créer une entreprise à la volée.
 */
export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [fetched, setFetched] = useState<Results>(EMPTY);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const active = term.trim().length >= 2;
  // Résultats dérivés : sous deux caractères on n'affiche rien, sans toucher à
  // l'état — remettre EMPTY dans un effet provoquerait un rendu en cascade.
  const results = active ? fetched : EMPTY;

  // Recherche différée pour ne pas tirer une requête par frappe.
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await searchEverything(term);
      if (cancelled) return;
      if (result.ok) setFetched(result.data);
      setSearching(false);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, active]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setTerm("");
      setSearching(false);
      router.push(href);
    },
    [router],
  );

  function quickCreateCompany() {
    const name = term.trim();
    if (!name) return;

    startTransition(async () => {
      const result = await createCompany({ name, source: "quick-add" });
      if (result.ok) {
        toast.success(`${result.data.name} ajoutée`);
        go(`/companies/${result.data.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const hasResults =
    results.companies.length + results.contacts.length + results.deals.length >
    0;
  const canCreate = active;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-1/4 translate-y-0 overflow-hidden rounded-xl! p-0 sm:max-w-lg"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Recherche et création rapide</DialogTitle>
          <DialogDescription>
            Cherche une fiche dans ton espace ou crée-en une nouvelle.
          </DialogDescription>
        </DialogHeader>

        {/* shouldFilter={false} : le filtrage est fait côté serveur. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Chercher une entreprise, un contact, une opportunité…"
            value={term}
            onValueChange={setTerm}
          />
          <CommandList>
            {!hasResults && !searching && active ? (
              <CommandEmpty>Aucun résultat pour « {term} ».</CommandEmpty>
            ) : null}

            {searching ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Recherche…
              </div>
            ) : null}

            {results.companies.length > 0 ? (
              <CommandGroup heading="Entreprises">
                {results.companies.map((company) => (
                  <CommandItem
                    key={company.id}
                    value={`company-${company.id}`}
                    onSelect={() => go(`/companies/${company.id}`)}
                  >
                    <Building2
                      className="size-4"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{company.name}</span>
                    {company.city ? (
                      <span className="text-xs text-muted-foreground">
                        {company.city}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.contacts.length > 0 ? (
              <CommandGroup heading="Personnes">
                {results.contacts.map((contact) => (
                  <CommandItem
                    key={contact.id}
                    value={`contact-${contact.id}`}
                    onSelect={() => go(`/contacts/${contact.id}`)}
                  >
                    <User className="size-4" strokeWidth={1.75} aria-hidden />
                    <span className="flex-1 truncate">{contact.name}</span>
                    {contact.companyName ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {contact.companyName}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.deals.length > 0 ? (
              <CommandGroup heading="Opportunités">
                {results.deals.map((deal) => (
                  <CommandItem
                    key={deal.id}
                    value={`deal-${deal.id}`}
                    onSelect={() => go("/pipeline")}
                  >
                    <Target className="size-4" strokeWidth={1.75} aria-hidden />
                    <span className="flex-1 truncate">{deal.title}</span>
                    {deal.stage ? (
                      <span className="text-xs text-muted-foreground">
                        {deal.stage}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {canCreate ? (
              <>
                {hasResults ? <CommandSeparator /> : null}
                <CommandGroup heading="Créer">
                  <CommandItem
                    value="create-company"
                    onSelect={quickCreateCompany}
                    disabled={pending}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Plus className="size-4" strokeWidth={2} aria-hidden />
                    )}
                    Ajouter l&apos;entreprise « {term.trim()} »
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}

            {!term ? (
              <CommandGroup heading="Aller à">
                {NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.href}
                      value={item.href}
                      onSelect={() => go(item.href)}
                    >
                      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                      {item.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** Déclencheur visible dans la Topbar. */
export function QuickAddTrigger() {
  return (
    <button
      type="button"
      onClick={() =>
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "k",
            metaKey: true,
            bubbles: true,
          }),
        )
      }
      className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-surface px-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent md:max-w-sm"
    >
      <Search className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="truncate">Rechercher ou créer…</span>
      <kbd className="ml-auto hidden shrink-0 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
