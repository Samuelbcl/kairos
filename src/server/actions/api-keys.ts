"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { generateApiKey, hashApiKey } from "@/lib/crypto";
import { firstIssue } from "@/lib/validators/common";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";
import { WEBHOOK_EVENTS } from "@/lib/webhook-events";

// --- Clés API ---------------------------------------------------------------

/**
 * Crée une clé API. La clé en clair n'est renvoyée qu'ici, une seule fois :
 * en base on ne garde que son hash et son préfixe d'affichage.
 */
export async function createApiKey(
  name: string,
): Promise<ActionResult<{ key: string; prefix: string }>> {
  const parsed = z.string().trim().min(1, "Donne un nom à la clé.").max(80).safeParse(name);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  if (workspace.role === "member") {
    return fail("Seuls les propriétaires et administrateurs peuvent créer une clé.");
  }

  const user = await getUser();
  const supabase = await createClient();
  const { key, prefix } = generateApiKey();

  const { error } = await supabase.from("api_keys").insert({
    workspace_id: workspace.id,
    name: parsed.data,
    key_hash: await hashApiKey(key),
    prefix,
    created_by: user?.id ?? null,
  });

  if (error) {
    console.error("[api-keys] création impossible", error.message);
    return fail(pgError(error, "Création de la clé impossible. Réessaie."));
  }

  revalidatePath("/settings/api");
  return ok({ key, prefix });
}

export async function revokeApiKey(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    return fail(pgError(error, "Révocation refusée. Vérifie que tu es administrateur."));
  }

  revalidatePath("/settings/api");
  return ok(undefined);
}

// --- Webhooks ---------------------------------------------------------------

const webhookSchema = z.object({
  url: z.url("L'URL doit commencer par http:// ou https://"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Choisis au moins un événement."),
});

export async function createWebhook(
  input: unknown,
): Promise<ActionResult<{ secret: string }>> {
  const parsed = webhookSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const workspace = await requireWorkspace();
  if (workspace.role === "member") {
    return fail("Seuls les propriétaires et administrateurs peuvent créer un webhook.");
  }

  const supabase = await createClient();
  const secret = randomBytes(24).toString("base64url");

  const { error } = await supabase.from("webhooks").insert({
    workspace_id: workspace.id,
    url: parsed.data.url,
    events: parsed.data.events,
    secret,
    enabled: true,
  });

  if (error) {
    console.error("[webhooks] création impossible", error.message);
    return fail(pgError(error, "Création du webhook impossible. Réessaie."));
  }

  revalidatePath("/settings/api");
  return ok({ secret });
}

export async function toggleWebhook(
  id: string,
  enabled: boolean,
): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("webhooks")
    .update({ enabled })
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return fail(pgError(error, "Changement d'état refusé."));

  revalidatePath("/settings/api");
  return ok(undefined);
}

export async function deleteWebhook(id: string): Promise<ActionResult> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return fail(pgError(error, "Suppression refusée."));

  revalidatePath("/settings/api");
  return ok(undefined);
}

/** Envoie un événement de test vers un webhook, pour valider le branchement. */
export async function testWebhook(id: string): Promise<ActionResult<{ status: number }>> {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { data: hook } = await supabase
    .from("webhooks")
    .select("url, secret")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();

  if (!hook) return fail("Webhook introuvable. Recharge la page.");

  const { hmacSignature } = await import("@/lib/crypto");
  const body = JSON.stringify({
    event: "test",
    workspace_id: workspace.id,
    sent_at: new Date().toISOString(),
    data: { message: "Ceci est un test envoyé depuis Kairos." },
  });

  try {
    const response = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kairos-Event": "test",
        "X-Kairos-Signature": await hmacSignature(hook.secret, body),
        "User-Agent": "Kairos-Webhook/1.0",
      },
      body,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return fail(
        `L'URL a répondu ${response.status}. Vérifie qu'elle accepte bien un POST JSON.`,
      );
    }

    return ok({ status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "erreur inconnue";
    return fail(`Appel impossible : ${message}. Vérifie l'URL et qu'elle est joignable.`);
  }
}
