"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/settings/workspace", label: "Espace" },
  { href: "/settings/members", label: "Membres" },
  { href: "/settings/integrations", label: "Intégrations" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Réglages"
      className="-mx-1 flex gap-1 overflow-x-auto border-b pb-px"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm transition-colors duration-150",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
