import { formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";

/** Fuseau de référence du produit. Toutes les dates affichées y sont ramenées. */
export const TIMEZONE = "Europe/Brussels";

export function toZoned(date: string | Date, timeZone = TIMEZONE) {
  return new TZDate(new Date(date), timeZone);
}

/** « mar. 3 juin » */
export function formatDate(date: string | Date, timeZone = TIMEZONE) {
  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(new Date(date));
}

/** « mar. 3 juin, 14:30 » */
export function formatDateTime(date: string | Date, timeZone = TIMEZONE) {
  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(date));
}

/** « dans 5 jours » / « il y a 2 jours » */
export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
}

/** Échéance lisible : « Aujourd'hui », « Demain », « En retard de 2 jours »… */
export function formatDue(date: string | Date) {
  const value = new Date(date);
  if (isToday(value)) return "Aujourd'hui";
  if (isTomorrow(value)) return "Demain";
  if (isPast(value)) return `En retard — ${formatRelative(value)}`;
  return formatRelative(value);
}

/** « 1 250 € » */
export function formatMoney(
  value: number | string | null | undefined,
  currency = "EUR",
) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function initials(...parts: (string | null | undefined)[]) {
  const text = parts.filter(Boolean).join(" ").trim();
  if (!text) return "?";
  const words = text.split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function fullName(
  first: string | null | undefined,
  last: string | null | undefined,
) {
  return [first, last].filter(Boolean).join(" ").trim();
}
