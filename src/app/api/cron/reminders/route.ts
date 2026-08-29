import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { runAutomations } from "@/lib/automations/engine";
import { sendEmail, emailConfigured } from "@/lib/email";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Seuil d'inactivité au-delà duquel une opportunité est considérée endormie. */
const STALE_DAYS = 14;

/**
 * Cron horaire. Deux rôles :
 *  1. envoyer les rappels dont l'heure est venue (et déclencher task.overdue) ;
 *  2. repérer les opportunités qui dorment et déclencher deal.stale.
 *
 * Tourne sans session : passe par le client service_role, seul cas où c'est
 * légitime. Chaque espace est traité isolément.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const report = { reminders: 0, overdue: 0, stale: 0, emails: 0, errors: 0 };

  // --- 1. Rappels arrivés à échéance ---------------------------------------
  const { data: dueReminders, error: remindersError } = await admin
    .from("tasks")
    .select(
      "id, workspace_id, title, due_at, remind_at, assignee_id, company_id, contact_id, deal_id, companies(name)",
    )
    .eq("done", false)
    .not("remind_at", "is", null)
    .lte("remind_at", now.toISOString())
    .gte("due_at", now.toISOString())
    .limit(500);

  if (remindersError) {
    console.error("[cron/reminders] lecture des rappels", remindersError.message);
    report.errors += 1;
  }

  // Nom de marque par espace, résolu une fois : un rappel signé « Kairos »
  // chez un client en marque blanche trahit l'éditeur au premier message.
  const brandNames = new Map<string, string>();
  async function brandFor(workspaceId: string) {
    if (!brandNames.has(workspaceId)) {
      const { data } = await admin
        .from("workspaces")
        .select("name, branding")
        .eq("id", workspaceId)
        .single();
      const branding = (data?.branding ?? {}) as { brand_name?: string };
      brandNames.set(workspaceId, branding.brand_name || data?.name || "Kairos");
    }
    return brandNames.get(workspaceId) ?? "Kairos";
  }

  for (const task of dueReminders ?? []) {
    report.reminders += 1;

    if (!emailConfigured() || !task.assignee_id) continue;

    const { data: profile } = await admin.auth.admin.getUserById(task.assignee_id);
    const to = profile.user?.email;
    if (!to) continue;

    const brand = await brandFor(task.workspace_id);

    const result = await sendEmail({
      to,
      subject: `Rappel : ${task.title}`,
      text: [
        `Relance prévue : ${task.title}`,
        task.companies?.name ? `Entreprise : ${task.companies.name}` : null,
        `Échéance : ${new Date(task.due_at).toLocaleString("fr-BE", { timeZone: "Europe/Brussels" })}`,
        "",
        `Ouvrir dans ${brand} : ${env.appUrl}/today`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    if (result.sent) report.emails += 1;

    // Le rappel est consommé : on l'efface pour ne pas le renvoyer à chaque tour.
    await admin.from("tasks").update({ remind_at: null }).eq("id", task.id);
  }

  // --- 2. Relances en retard → déclencheur task.overdue --------------------
  const { data: overdueTasks } = await admin
    .from("tasks")
    .select("id, workspace_id, title, due_at, company_id, contact_id, deal_id")
    .eq("done", false)
    .lt("due_at", now.toISOString())
    .gte("due_at", new Date(now.getTime() - 25 * 3600 * 1000).toISOString())
    .limit(500);

  for (const task of overdueTasks ?? []) {
    report.overdue += 1;
    await runAutomations(
      { type: "task.overdue", payload: { task } },
      { workspaceId: task.workspace_id, supabase: admin },
    );
  }

  // --- 3. Opportunités endormies → déclencheur deal.stale ------------------
  const staleBefore = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString();
  const { data: staleDeals } = await admin
    .from("deals")
    .select("id, workspace_id, title, value, priority, status, company_id, companies(id, name, email)")
    .eq("status", "open")
    .lt("last_activity_at", staleBefore)
    .limit(200);

  for (const deal of staleDeals ?? []) {
    report.stale += 1;
    await runAutomations(
      {
        type: "deal.stale",
        payload: { deal, company: deal.companies ?? undefined },
      },
      { workspaceId: deal.workspace_id, supabase: admin },
    );
  }

  console.log("[cron/reminders]", report);
  return NextResponse.json({ ok: true, ...report });
}
