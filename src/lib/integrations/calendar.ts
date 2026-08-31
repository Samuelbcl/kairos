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

/**
 * Intégration à utiliser quand aucun utilisateur n'est connecté — relance créée
 * par l'API, par une automatisation, ou poussée par le cron.
 *
 * Priorité au responsable de la relance s'il a connecté un agenda ; sinon le
 * premier agenda de l'espace qui accepte de recevoir les relances des autres.
 * Sans ça, ces relances n'atteignaient jamais aucun agenda.
 */
export async function getWorkspaceIntegration(
  supabase: Client,
  workspaceId: string,
  preferredUserId?: string | null,
): Promise<Integration | null> {
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error || !data?.length) return null;

  const own = preferredUserId
    ? data.find((integration) => integration.user_id === preferredUserId)
    : undefined;
  const shared = data.find((integration) => integration.share_with_workspace);
  const chosen = own ?? shared;

  return chosen ? ensureFreshToken(supabase, chosen) : null;
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

// --- Sens retour : agenda → Kairos ------------------------------------------

/**
 * Relit les événements liés à des relances et reporte les déplacements faits
 * dans l'agenda.
 *
 * Volontairement limité : on ne synchronise que l'heure d'un événement que
 * Kairos a lui-même créé, jamais la création ni la suppression. C'est ce qui
 * évite les doublons et les boucles qui rendent la synchronisation
 * bidirectionnelle si pénible — et ça couvre le cas réel, celui où on déplace
 * un rendez-vous depuis son téléphone.
 */
/** Un rendez-vous lu dans l'agenda de l'utilisateur, jamais modifie par Kairos. */
export type ExternalEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  link: string | null;
};

/**
 * Lit les rendez-vous d'une periode, en lecture seule.
 *
 * Kairos ne montrait que ses propres relances : on ne voyait donc pas ses
 * reunions, et on posait des relances par-dessus. Cette lecture ne cree, ne
 * modifie ni ne supprime rien — la portee demandee a Google reste la meme.
 *
 * Les evenements poses par Kairos remontent aussi : c'est a l'appelant de les
 * ecarter en comparant leur identifiant a `tasks.external_event_id`, sinon une
 * relance s'afficherait deux fois.
 *
 * Renvoie une liste vide plutot que de lever : un agenda momentanement
 * injoignable ne doit pas empecher d'ouvrir la page.
 */
export async function listExternalEvents(
  integration: Integration,
  from: Date,
  to: Date,
): Promise<ExternalEvent[]> {
  try {
    if (integration.provider === "google") {
      const params = new URLSearchParams({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "500",
      });

      const response = await googleRequest(integration, `/events?${params}`);
      if (!response.ok) return [];

      const body = (await response.json()) as {
        items?: {
          id: string;
          summary?: string;
          status?: string;
          htmlLink?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
        }[];
      };

      return (body.items ?? [])
        .filter((item) => item.status !== "cancelled" && (item.start?.dateTime || item.start?.date))
        .map((item) => ({
          id: item.id,
          title: item.summary?.trim() || "(sans titre)",
          start: item.start?.dateTime ?? `${item.start?.date}T00:00:00`,
          end: item.end?.dateTime ?? null,
          allDay: !item.start?.dateTime,
          link: item.htmlLink ?? null,
        }));
    }

    if (integration.provider === "microsoft") {
      const params = new URLSearchParams({
        startDateTime: from.toISOString(),
        endDateTime: to.toISOString(),
        $orderby: "start/dateTime",
        $top: "500",
      });

      const response = await graphRequest(integration, `/calendarView?${params}`);
      if (!response.ok) return [];

      const body = (await response.json()) as {
        value?: {
          id: string;
          subject?: string;
          isAllDay?: boolean;
          webLink?: string;
          start?: { dateTime?: string };
          end?: { dateTime?: string };
        }[];
      };

      return (body.value ?? [])
        .filter((item) => item.start?.dateTime)
        .map((item) => ({
          id: item.id,
          title: item.subject?.trim() || "(sans titre)",
          start: item.start!.dateTime!,
          end: item.end?.dateTime ?? null,
          allDay: Boolean(item.isAllDay),
          link: item.webLink ?? null,
        }));
    }

    return [];
  } catch (error) {
    console.error(
      "[calendar] lecture des evenements impossible",
      error instanceof Error ? error.message : "erreur inconnue",
    );
    return [];
  }
}

export async function pullCalendarChanges(
  supabase: Client,
  workspaceId: string,
  integration: Integration,
): Promise<{ updated: number; checked: number }> {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, due_at, remind_at, external_event_id, calendar_synced_at")
    .eq("workspace_id", workspaceId)
    .eq("done", false)
    .eq("calendar_provider", integration.provider)
    .not("external_event_id", "is", null)
    .gte("due_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .limit(200);

  let updated = 0;

  for (const task of tasks ?? []) {
    if (!task.external_event_id) continue;

    try {
      const response =
        integration.provider === "google"
          ? await googleRequest(
              integration,
              `/events/${encodeURIComponent(task.external_event_id)}`,
            )
          : await graphRequest(
              integration,
              `/events/${encodeURIComponent(task.external_event_id)}`,
            );

      // Événement supprimé côté agenda : on délie sans supprimer la relance.
      if (response.status === 404 || response.status === 410) {
        await supabase
          .from("tasks")
          .update({
            calendar_provider: null,
            external_event_id: null,
            calendar_synced_at: null,
          })
          .eq("id", task.id);
        continue;
      }

      const event = await response.json();
      const remoteStart: string | undefined =
        integration.provider === "google"
          ? event?.start?.dateTime
          : event?.start?.dateTime
            ? `${event.start.dateTime}Z`.replace(/Z+$/, "Z")
            : undefined;

      if (!remoteStart) continue;

      const remote = new Date(remoteStart);
      const local = new Date(task.due_at);
      // Une minute de tolérance : les fournisseurs arrondissent les secondes.
      if (Math.abs(remote.getTime() - local.getTime()) < 60_000) continue;

      const shift = remote.getTime() - local.getTime();

      await supabase
        .from("tasks")
        .update({
          due_at: remote.toISOString(),
          remind_at: task.remind_at
            ? new Date(new Date(task.remind_at).getTime() + shift).toISOString()
            : null,
          calendar_synced_at: new Date().toISOString(),
        })
        .eq("id", task.id);

      updated += 1;
    } catch (error) {
      console.error(
        "[calendar] relecture d'un evenement impossible",
        error instanceof Error ? error.message : "erreur inconnue",
      );
    }
  }

  return { updated, checked: tasks?.length ?? 0 };
}
