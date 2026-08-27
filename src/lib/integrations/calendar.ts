import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import * as google from "./google";
import * as microsoft from "./microsoft";

type Client = SupabaseClient<Database>;
type Provider = Database["public"]["Enums"]["integration_provider"];
type Integration = Database["public"]["Tables"]["integrations"]["Row"];

export type SyncableTask = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string;
  remind_at: string | null;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  calendar_provider: Provider | null;
  external_event_id: string | null;
};

/** Durée par défaut du créneau posé dans l'agenda pour une relance. */
const SLOT_MINUTES = 30;

/** Intégration active d'un utilisateur, jeton rafraîchi si besoin. */
export async function getIntegration(
  supabase: Client,
  workspaceId: string,
  userId: string,
): Promise<Integration | null> {
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data?.length) return null;
  return ensureFreshToken(supabase, data[0]);
}

/** Rafraîchit le jeton d'accès s'il expire dans moins de cinq minutes. */
export async function ensureFreshToken(
  supabase: Client,
  integration: Integration,
): Promise<Integration> {
  const expiresAt = integration.expires_at ? new Date(integration.expires_at) : null;
  const soon = Date.now() + 5 * 60 * 1000;

  if (!expiresAt || expiresAt.getTime() > soon) return integration;
  if (!integration.refresh_token_enc) return integration;

  try {
    const refreshToken = decrypt(integration.refresh_token_enc);
    const refreshed =
      integration.provider === "google"
        ? await google.refreshAccessToken(refreshToken)
        : await microsoft.refreshAccessToken(refreshToken);

    const nextExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    const accessTokenEnc = encrypt(refreshed.access_token);

    await supabase
      .from("integrations")
      .update({ access_token_enc: accessTokenEnc, expires_at: nextExpiry })
      .eq("id", integration.id);

    return { ...integration, access_token_enc: accessTokenEnc, expires_at: nextExpiry };
  } catch (error) {
    // On ne logge jamais le jeton, même tronqué.
    console.error(
      `[calendar] rafraichissement ${integration.provider} impossible`,
      error instanceof Error ? error.message : "erreur inconnue",
    );
    return integration;
  }
}

function eventPayload(task: SyncableTask) {
  const start = new Date(task.due_at);
  const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);

  const reminderMinutes = task.remind_at
    ? Math.max(
        0,
        Math.round((start.getTime() - new Date(task.remind_at).getTime()) / 60000),
      )
    : 30;

  const link = task.company_id
    ? `${env.appUrl}/companies/${task.company_id}`
    : task.contact_id
      ? `${env.appUrl}/contacts/${task.contact_id}`
      : `${env.appUrl}/today`;

  return { start, end, reminderMinutes, link };
}

// --- Google Calendar --------------------------------------------------------

async function googleRequest(
  integration: Integration,
  path: string,
  init: RequestInit = {},
) {
  const accessToken = decrypt(integration.access_token_enc);
  const calendarId = encodeURIComponent(integration.calendar_id ?? "primary");

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    },
  );

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Google Agenda a repondu ${response.status}.`);
  }
  return response;
}

async function googleUpsert(task: SyncableTask, integration: Integration, tz: string) {
  const { start, end, reminderMinutes, link } = eventPayload(task);

  const body = {
    summary: task.title,
    description: [task.notes, `Relance Kairos - ${link}`].filter(Boolean).join("\n\n"),
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: reminderMinutes }],
    },
    source: { title: "Kairos", url: link },
  };

  if (task.external_event_id) {
    const response = await googleRequest(
      integration,
      `/events/${encodeURIComponent(task.external_event_id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    // Evenement supprime cote agenda : on en recree un plutot que d'echouer.
    if (response.status === 404 || response.status === 410) {
      const created = await googleRequest(integration, "/events", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return (await created.json()).id as string;
    }
    return task.external_event_id;
  }

  const created = await googleRequest(integration, "/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (await created.json()).id as string;
}

async function googleDelete(eventId: string, integration: Integration) {
  await googleRequest(integration, `/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
}

// --- Microsoft Graph --------------------------------------------------------

async function graphRequest(
  integration: Integration,
  path: string,
  init: RequestInit = {},
) {
  const accessToken = decrypt(integration.access_token_enc);
  const response = await fetch(`https://graph.microsoft.com/v1.0/me${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Microsoft Graph a repondu ${response.status}.`);
  }
  return response;
}

async function microsoftUpsert(
  task: SyncableTask,
  integration: Integration,
  tz: string,
) {
  const { start, end, reminderMinutes, link } = eventPayload(task);

  const body = {
    subject: task.title,
    body: {
      contentType: "text",
      content: [task.notes, `Relance Kairos - ${link}`].filter(Boolean).join("\n\n"),
    },
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    isReminderOn: reminderMinutes > 0,
    reminderMinutesBeforeStart: reminderMinutes,
  };

  if (task.external_event_id) {
    const response = await graphRequest(
      integration,
      `/events/${encodeURIComponent(task.external_event_id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    if (response.status === 404 || response.status === 410) {
      const created = await graphRequest(integration, "/events", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return (await created.json()).id as string;
    }
    return task.external_event_id;
  }

  const created = await graphRequest(integration, "/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (await created.json()).id as string;
}

async function microsoftDelete(eventId: string, integration: Integration) {
  await graphRequest(integration, `/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
}

// --- API publique -----------------------------------------------------------

/**
 * Une tache correspond a un evenement, lies par `external_event_id`.
 * Appelable autant de fois qu'on veut : cree si absent, met a jour sinon.
 * C'est ce qui empeche les doublons.
 */
export async function upsertTaskEvent(
  supabase: Client,
  task: SyncableTask,
  integration: Integration,
  timeZone: string,
): Promise<{ synced: boolean; error?: string }> {
  try {
    const eventId =
      integration.provider === "google"
        ? await googleUpsert(task, integration, timeZone)
        : await microsoftUpsert(task, integration, timeZone);

    await supabase
      .from("tasks")
      .update({
        calendar_provider: integration.provider,
        external_event_id: eventId,
        calendar_synced_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    return { synced: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erreur inconnue";
    console.error("[calendar] synchronisation impossible", message);
    return { synced: false, error: message };
  }
}

/** Supprime l'evenement lie puis nettoie les champs de synchronisation. */
export async function deleteTaskEvent(
  supabase: Client,
  task: SyncableTask,
  integration: Integration,
): Promise<{ deleted: boolean }> {
  if (!task.external_event_id) return { deleted: false };

  try {
    if (integration.provider === "google") {
      await googleDelete(task.external_event_id, integration);
    } else {
      await microsoftDelete(task.external_event_id, integration);
    }
  } catch (error) {
    // L'evenement a peut-etre deja disparu : on nettoie quand meme cote base.
    console.error(
      "[calendar] suppression de l'evenement impossible",
      error instanceof Error ? error.message : "erreur inconnue",
    );
  }

  await supabase
    .from("tasks")
    .update({
      calendar_provider: null,
      external_event_id: null,
      calendar_synced_at: null,
    })
    .eq("id", task.id);

  return { deleted: true };
}
