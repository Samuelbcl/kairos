import { Search } from "lucide-react";
import { MobileNav } from "@/components/shell/mobile-nav";
import { UserMenu } from "@/components/shell/user-menu";

type TopbarProps = {
  brandName: string;
  email: string;
  name: string;
};

export function Topbar({ brandName, email, name }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 md:px-4">
      <MobileNav brandName={brandName} />

      {/* Recherche globale + QuickAdd : branchés en Phase 2 (cmdk). */}
      <button
        type="button"
        disabled
        className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-surface px-2.5 text-sm text-muted-foreground transition-colors duration-150 md:max-w-sm"
      >
        <Search className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="truncate">Rechercher…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <UserMenu email={email} name={name} />
      </div>
    </header>
  );
}
