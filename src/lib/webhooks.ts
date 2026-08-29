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

/** Attentes entre tentatives : 1 min, 5 min, 30 min, 2 h, 12 h. */
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length;

const TIMEOUT_MS = 8000;

function nextRetryAt(attempts: number): string | null {
  const minutes = BACKOFF_MINUTES[attempts - 1];
  return minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
}

/** Un appel HTTP signé, sans effet de bord en base. */
async function post(
  url: string,
  secret: string,
  event: string,
  body: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kairos-Event": event,
        "X-Kairos-Signature": await hmacSignature(secret, body),
        "User-Agent": "Kairos-Webhook/1.0",
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    return response.ok
      ? { ok: true, status: response.status }
      : { ok: false, status: response.status, error: `HTTP ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erreur inconnue";
    return { ok: false, error: message };
  }
}

/**
 * Poste l'événement vers tous les webhooks abonnés de l'espace.
 *
 * Chaque tentative est consignée : jusqu'ici un échec partait dans les logs
 * serveur et le client ne pouvait ni le voir ni le rejouer. Un webhook cassé
 * ne fait jamais échouer l'action de l'utilisateur.
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

  const envelope = {
    event,
    workspace_id: workspaceId,
    sent_at: new Date().toISOString(),
    data: payload,
  };
  const body = JSON.stringify(envelope);

  await Promise.allSettled(
    targets.map(async (hook) => {
      const result = await post(hook.url, hook.secret, event, body);

      const { error: logError } = await supabase.from("webhook_deliveries").insert({
        workspace_id: workspaceId,
        webhook_id: hook.id,
        event,
        payload: envelope as never,
        status: result.ok ? "success" : "failed",
        status_code: result.status ?? null,
        error: result.error ?? null,
        attempts: 1,
        next_retry_at: result.ok ? null : nextRetryAt(1),
        delivered_at: result.ok ? new Date().toISOString() : null,
      });

      if (logError) {
        console.error("[webhooks] journalisation impossible", logError.message);
      }
      if (!result.ok) {
        console.error(`[webhooks] ${hook.url} — ${result.error} (${event})`);
      }
    }),
  );
}

/**
 * Retente une livraison. Utilisé par le cron et par le bouton « Rejouer ».
 * Renvoie true si la livraison est passée.
 */
export async function retryDelivery(
  supabase: Client,
  deliveryId: string,
): Promise<boolean> {
  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .select("id, workspace_id, webhook_id, event, payload, attempts, webhooks(url, secret, enabled)")
    .eq("id", deliveryId)
    .single();

  if (!delivery?.webhooks) return false;
  if (!delivery.webhooks.enabled) return false;

  const body = JSON.stringify(delivery.payload);
  const result = await post(
    delivery.webhooks.url,
    delivery.webhooks.secret,
    delivery.event,
    body,
  );

  const attempts = delivery.attempts + 1;

  await supabase
    .from("webhook_deliveries")
    .update({
      status: result.ok ? "success" : "failed",
      status_code: result.status ?? null,
      error: result.error ?? null,
      attempts,
      // Au-delà du dernier palier, on arrête : c'est à un humain de regarder.
      next_retry_at: result.ok ? null : nextRetryAt(attempts),
      delivered_at: result.ok ? new Date().toISOString() : null,
    })
    .eq("id", deliveryId);

  return result.ok;
}
