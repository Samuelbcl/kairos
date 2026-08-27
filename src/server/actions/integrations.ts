"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/workspace";
import { fail, ok, type ActionResult } from "@/server/actions/types";

/**
 * Déconnecte un agenda. Nettoie aussi les références d'événements des relances :
 * sans ça, une reconnexion tenterait de mettre à jour des événements fantômes.
 */
export async function disconnectIntegration(
  provider: "google" | "microsoft",
): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const user = await getUser();
  if (!user) return fail("Session expirée. Reconnecte-toi.");

  const supabase = await createClient();

  const { error: cleanupError } = await supabase
    .from("tasks")
    .update({
      calendar_provider: null,
      external_event_id: null,
      calendar_synced_at: null,
    })
    .eq("workspace_id", workspace.id)
    .eq("calendar_provider", provider);

  if (cleanupError) {
    console.error("[integrations] nettoyage des relances", cleanupError.message);
  }

  // La ligne contient des jetons : suppression via service_role, après contrôle.
  const admin = createAdminClient();
  const { error } = await admin
    .from("integrations")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) {
    console.error("[integrations] suppression impossible", error.message);
    return fail("Déconnexion impossible. Réessaie dans un instant.");
  }

  revalidatePath("/settings/integrations");
  return ok(undefined);
}

/**
 * Renvoie vers l'agenda toutes les relances en cours non synchronisées.
 * Utile juste après une (re)connexion.
 */
export async function resyncCalendar(): Promise<ActionResult<{ synced: number }>> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("done", false)
    .is("external_event_id", null)
    .gte("due_at", new Date().toISOString())
    .limit(100);

  if (error) {
    console.error("[integrations] lecture des relances", error.message);
    return fail("Impossible de lister les relances à synchroniser.");
  }

  const { syncTaskToCalendar } = await import("./calendar-sync");
  let synced = 0;

  for (const task of tasks ?? []) {
    const result = await syncTaskToCalendar(task.id);
    if (result.ok && result.data.synced) synced += 1;
  }

  revalidatePath("/settings/integrations");
  revalidatePath("/today");
  return ok({ synced });
}
