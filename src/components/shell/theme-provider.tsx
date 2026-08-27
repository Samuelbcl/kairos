"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { Branding } from "@/lib/workspace";

/**
 * Injecte le branding de l'espace en variables CSS (white-label) et gère
 * le mode clair/sombre. La couleur passe par --primary : tous les composants
 * shadcn la suivent sans autre changement.
 */
export function ThemeProvider({
  branding,
  children,
}: {
  branding: Branding;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties & Record<string, string> = {};
  if (branding.accent) {
    style["--primary"] = branding.accent;
    style["--ring"] = branding.accent;
    style["--sidebar-primary"] = branding.accent;
    style["--brand-soft"] = `color-mix(in oklch, ${branding.accent} 12%, var(--background))`;
    style["--sidebar-accent"] = `color-mix(in oklch, ${branding.accent} 12%, var(--background))`;
  }
  if (branding.radius) {
    style["--radius"] = branding.radius;
  }

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={branding.mode ?? "light"}
      enableSystem
      disableTransitionOnChange
    >
      <div style={style} className="flex min-h-full flex-1 flex-col">
        {children}
      </div>
    </NextThemesProvider>
  );
}
