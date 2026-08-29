import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey, isErrorResponse, json } from "@/lib/api-auth";
import { firstIssue } from "@/lib/validators/common";
import { dispatchWebhooks, type WebhookEvent } from "@/lib/webhooks";

/**
 * Fabrique les routes `/api/v1/<ressource>/[id]` : GET, PATCH, DELETE.
 *
 * L'API ne savait que lire et créer — Make ou n8n pouvaient alimenter Kairos,
 * pas le tenir à jour. Les quatre ressources se comportent pareil, autant
 * n'écrire la mécanique qu'une fois.
 */

type Table = "companies" | "contacts" | "deals" | "tasks";

export function resourceHandlers({
  table,
  fields,
  updateSchema,
  softDelete = true,
  updatedEvent,
}: {
  table: Table;
  fields: string;
  updateSchema: z.ZodType;
  /** tasks n'a pas de corbeille : la suppression y est définitive. */
  softDelete?: boolean;
  updatedEvent?: WebhookEvent;
}) {
  async function resolve(request: NextRequest, id: string) {
    const auth = await authenticateApiKey(request);
    if (isErrorResponse(auth)) return { error: auth } as const;

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return {
        error: NextResponse.json({ error: "Identifiant invalide." }, { status: 400 }),
      } as const;
    }

    return { auth, admin: createAdminClient() } as const;
  }

  return {
    async GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
      const { id } = await context.params;
      const resolved = await resolve(request, id);
      if ("error" in resolved) return resolved.error;

      const { auth, admin } = resolved;
      const { data, error } = await admin
        .from(table)
        .select(fields)
        .eq("id", id)
        .eq("workspace_id", auth.workspaceId)
        .maybeSingle();

      if (error) {
        console.error(`[api/v1/${table}] lecture impossible`, error.message);
        return json(auth, { error: "Lecture impossible." }, { status: 500 });
      }
      if (!data) return json(auth, { error: "Introuvable." }, { status: 404 });

      return json(auth, { data });
    },

    async PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
      const { id } = await context.params;
      const resolved = await resolve(request, id);
      if ("error" in resolved) return resolved.error;

      const { auth, admin } = resolved;

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json(auth, { error: "Corps JSON invalide." }, { status: 400 });
      }

      const parsed = updateSchema.safeParse({ ...(body as object), id });
      if (!parsed.success) {
        return json(
          auth,
          { error: firstIssue(parsed.error as z.ZodError) },
          { status: 422 },
        );
      }

      // `id` vient de l'URL, pas du corps : on le retire du patch.
      const patch = Object.fromEntries(
        Object.entries(parsed.data as Record<string, unknown>).filter(
          ([key]) => key !== "id",
        ),
      );
      if (Object.keys(patch).length === 0) {
        return json(auth, { error: "Aucun champ à modifier." }, { status: 422 });
      }

      const { data, error } = await admin
        .from(table)
        .update(patch as never)
        .eq("id", id)
        .eq("workspace_id", auth.workspaceId)
        .select(fields)
        .maybeSingle();

      if (error) {
        console.error(`[api/v1/${table}] mise à jour impossible`, error.message);
        return json(auth, { error: "Mise à jour impossible." }, { status: 500 });
      }
      if (!data) return json(auth, { error: "Introuvable." }, { status: 404 });

      if (updatedEvent) {
        await dispatchWebhooks(admin, auth.workspaceId, updatedEvent, {
          [table.slice(0, -1)]: data,
        });
      }

      return json(auth, { data });
    },

    async DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
      const { id } = await context.params;
      const resolved = await resolve(request, id);
      if ("error" in resolved) return resolved.error;

      const { auth, admin } = resolved;

      const query = softDelete
        ? admin
            .from(table)
            .update({ deleted_at: new Date().toISOString() } as never)
            .eq("id", id)
            .eq("workspace_id", auth.workspaceId)
            .select("id")
            .maybeSingle()
        : admin
            .from(table)
            .delete()
            .eq("id", id)
            .eq("workspace_id", auth.workspaceId)
            .select("id")
            .maybeSingle();

      const { data, error } = await query;

      if (error) {
        console.error(`[api/v1/${table}] suppression impossible`, error.message);
        return json(auth, { error: "Suppression impossible." }, { status: 500 });
      }
      if (!data) return json(auth, { error: "Introuvable." }, { status: 404 });

      return json(auth, {
        data: { id },
        // Dire ce qui s'est réellement passé : « supprimé » est ambigu quand
        // la fiche est en fait récupérable un mois.
        deleted: softDelete ? "trashed" : "permanent",
      });
    },
  };
}
