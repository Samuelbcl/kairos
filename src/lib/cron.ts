import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Garde des routes /api/cron/*.
 *
 * Vercel Cron envoie `Authorization: Bearer <CRON_SECRET>`. On accepte aussi
 * `?secret=` pour pouvoir déclencher un run manuellement en debug.
 * Comparaison à temps constant : le secret ne doit pas fuir par le timing.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron] CRON_SECRET absent : toutes les exécutions sont refusées.");
    return false;
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ")
    ? header.slice(7)
    : (request.nextUrl.searchParams.get("secret") ?? "");

  if (provided.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
