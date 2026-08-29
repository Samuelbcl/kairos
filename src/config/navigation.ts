import {
  Building2,
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  Settings,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Correspondance de préfixe pour l'état actif (fiches enfants incluses). */
  match?: string;
};

export const mainNav: NavItem[] = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/today", label: "Aujourd'hui", icon: CalendarClock },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays },
  { href: "/pipeline", label: "Pipeline", icon: Target },
  { href: "/contacts", label: "Contacts", icon: Building2, match: "/contacts" },
  { href: "/automations", label: "Automatisations", icon: Zap },
];

export const secondaryNav: NavItem[] = [
  {
    href: "/settings/workspace",
    label: "Réglages",
    icon: Settings,
    match: "/settings",
  },
];
