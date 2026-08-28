import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { hmacSignature } from "@/lib/crypto";
import type { WebhookEvent } from "./webhook-events";

type Client = SupabaseClient<Database>;

export {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  type WebhookEvent,
} from "./webhook-events";

/**
 * Poste l'événement vers tous les webhooks abonnés de l'espace.
 * Signé HMAC-SHA256, timeout court, échecs tracés mais jamais propagés :
 * un webhook cassé ne doit pas faire échouer l'action de l'utilisateur.
 */
export async function dispatchWebhooks(
  supabase: Client,
  workspaceId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const { data: hooks, error } = await supabase
    .from("webhooks")
    .select("id, url, secret, events")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true);

  if (error) {
    console.error("[webhooks] lecture impossible", error.message);
    return;
  }

  const targets = (hooks ?? []).filter((hook) => hook.events.includes(event));
  if (targets.length === 0) return;

  const body = JSON.stringify({
    event,
    workspace_id: workspaceId,
    sent_at: new Date().toISOString(),
    data: payload,
  });

  await Promise.allSettled(
    targets.map(async (hook) => {
      try {
        const signature = await hmacSignature(hook.secret, body);
        const response = await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Kairos-Event": event,
            "X-Kairos-Signature": signature,
            "User-Agent": "Kairos-Webhook/1.0",
          },
          body,
          signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
          console.error(
            `[webhooks] ${hook.url} a répondu ${response.status} pour ${event}`,
          );
        }
      } catch (error) {
        console.error(
          `[webhooks] appel de ${hook.url} impossible`,
          error instanceof Error ? error.message : "erreur inconnue",
        );
      }
    }),
  );
}
