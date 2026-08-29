import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Chef d'orchestre des tâches planifiées.
 *
 * Vercel limite le plan Hobby à deux crons, exécutables une fois par jour.
 * Déclarer six entrées faisait rejeter le déploiement entier. On n'en déclare
 * donc plus qu'une, qui appelle les autres à la suite.
 *
 * Les routes individuelles restent accessibles : elles servent au déclenchement
 * manuel, et à des planifications plus fines sur un plan qui les autorise —
 * voir la section « Cron Jobs » du README.
 *
 * Un job en échec n'arrête pas les suivants : une URL de webhook morte ne doit
 * pas empêcher les rappels de partir.
 */
const JOBS = [
  "reminders",
  "sync-calendar",
  "pull-calendar",
  "retry-webhooks",
  "refresh-tokens",
  "purge",
] as const;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const secret = process.env.CRON_SECRET ?? "";
  const results: Record<string, unknown> = {};
  const started = Date.now();

  for (const job of JOBS) {
    const jobStarted = Date.now();
    try {
      const response = await fetch(`${env.appUrl}/api/cron/${job}`, {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(60_000),
      });

      results[job] = {
        status: response.status,
        ms: Date.now() - jobStarted,
        ...(response.ok ? await response.json().catch(() => ({})) : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "erreur inconnue";
      console.error(`[cron/run] ${job} en échec`, message);
      results[job] = { error: message, ms: Date.now() - jobStarted };
    }
  }

  const report = { ok: true, totalMs: Date.now() - started, jobs: results };
  console.log("[cron/run]", JSON.stringify(report));
  return NextResponse.json(report);
}
