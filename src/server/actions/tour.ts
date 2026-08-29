"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/server/actions/types";

/**
 * Progression de la visite guidée, retenue sur le profil.
 *
 * Pas dans le navigateur : quelqu'un qui a suivi la visite sur son ordinateur
 * ne doit pas la revoir en ouvrant Kairos sur son téléphone.
 */
export async function saveTourProgress(
  step: number,
  completed: boolean,
): Promise<ActionResult> {
  const parsed = z
    .object({ step: z.number().int().min(0).max(50), completed: z.boolean() })
    .safeParse({ step, completed });
  if (!parsed.success) return fail("Progression invalide.");

  const user = await getUser();
  if (!user) return ok(undefined);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      tour_step: parsed.data.step,
      tour_completed_at: parsed.data.completed ? new Date().toISOString() : null,
    })
    .eq("id", user.id);

  if (error) {
    // Une visite guidée qui n'enregistre pas sa progression n'est pas un
    // incident : on trace et on laisse l'utilisateur continuer.
    console.error("[visite] progression non enregistrée", error.message);
  }

  return ok(undefined);
}

/** Remet la visite à zéro pour la rejouer depuis les réglages. */
export async function restartTour(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("Session expirée. Reconnecte-toi.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ tour_step: 0, tour_completed_at: null })
    .eq("id", user.id);

  if (error) return fail("Impossible de relancer la visite. Réessaie.");

  revalidatePath("/", "layout");
  return ok(undefined);
}
