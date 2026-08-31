"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { mainNav, secondaryNav, type NavItem } from "@/config/navigation";
import {
  WorkspaceSwitcher,
  type WorkspaceOption,
} from "@/components/shell/workspace-switcher";

function isActive(pathname: string, item: NavItem) {
  if (item.match) return pathname === item.match || pathname.startsWith(`${item.match}/`);
  return pathname === item.href;
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      data-tour={item.tour}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150",
        active
          ? "bg-brand-soft font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", active && "text-primary")}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar({
  workspaces,
  currentId,
  isPlatformAdmin,
}: {
  workspaces: WorkspaceOption[];
  currentId: string;
  isPlatformAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-semibold text-primary-foreground">
          K
        </span>
        <WorkspaceSwitcher workspaces={workspaces} currentId={currentId} />
      </div>

      <nav
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-2"
        aria-label="Navigation principale"
      >
        {mainNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <nav className="flex flex-col gap-0.5 border-t border-sidebar-border px-2.5 py-2.5">
        {isPlatformAdmin ? (
          <NavLink
            item={{ href: "/admin", label: "Console éditeur", icon: ShieldCheck }}
            pathname={pathname}
          />
        ) : null}
        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </aside>
  );
}
