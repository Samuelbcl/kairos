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
  /** Repère visé par la visite guidée. */
  tour?: string;
};

export const mainNav: NavItem[] = [
  {
    href: "/",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    tour: "nav-dashboard",
  },
  { href: "/today", label: "Aujourd'hui", icon: CalendarClock, tour: "nav-today" },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays, tour: "nav-calendar" },
  { href: "/pipeline", label: "Pipeline", icon: Target, tour: "nav-pipeline" },
  {
    href: "/contacts",
    label: "Contacts",
    icon: Building2,
    match: "/contacts",
    tour: "nav-contacts",
  },
  {
    href: "/automations",
    label: "Automatisations",
    icon: Zap,
    tour: "nav-automations",
  },
];

export const secondaryNav: NavItem[] = [
  {
    href: "/settings/workspace",
    label: "Réglages",
    icon: Settings,
    match: "/settings",
    tour: "nav-settings",
  },
];
