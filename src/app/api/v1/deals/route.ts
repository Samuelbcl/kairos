import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateApiKey,
  isErrorResponse,
  json,
  readPagination,
} from "@/lib/api-auth";
import { dealCreateSchema } from "@/lib/validators/deal";
import { firstIssue } from "@/lib/validators/common";
import { dispatchWebhooks } from "@/lib/webhooks";
import { runAutomations } from "@/lib/automations/engine";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, title, value, currency, priority, status, stage_id, company_id, contact_id, expected_close, last_activity_at, created_at, updated_at";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (isErrorResponse(auth)) return auth;

  const { limit, offset } = readPagination(request);
  const status = request.nextUrl.searchParams.get("status");
  const stageId = request.nextUrl.searchParams.get("stage_id");

  const admin = createAdminClient();
  let query = admin
    .from("deals")
    .select(FIELDS, { count: "exact" })
    .eq("workspace_id", auth.workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === "open" || status === "won" || status === "lost") {
    query = query.eq("status", status);
  }
  if (stageId) query = query.eq("stage_id", stageId);

  const { data, error, count } = await query;

  if (error) {
    console.error("[api/v1/deals] lecture impossible", error.message);
    return json(auth, { error: "Lecture impossible." }, { status: 500 });
  }

  return json(auth, { data, count, limit, offset });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (isErrorResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(auth, { error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = dealCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json(auth, { error: firstIssue(parsed.error) }, { status: 422 });
  }

  const admin = createAdminClient();

  // Le pipeline se déduit de l'étape : on vérifie au passage qu'elle est bien
  // dans l'espace de la clé API.
  const { data: stage } = await admin
    .from("stages")
    .select("id, name, pipeline_id")
    .eq("id", parsed.data.stage_id)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!stage) {
    return json(auth, { error: "stage_id inconnu dans cet espace." }, { status: 422 });
  }

  const { data, error } = await admin
    .from("deals")
    .insert({
      ...parsed.data,
      workspace_id: auth.workspaceId,
      pipeline_id: stage.pipeline_id,
      last_activity_at: new Date().toISOString(),
    })
    .select(FIELDS)
    .single();

  if (error) {
    console.error("[api/v1/deals] création impossible", error.message);
    return json(auth, { error: "Création impossible." }, { status: 500 });
  }

  const payload = { deal: data, stage };
  await Promise.all([
    runAutomations(
      { type: "deal.created", payload },
      { workspaceId: auth.workspaceId, supabase: admin },
    ),
    dispatchWebhooks(admin, auth.workspaceId, "deal.created", payload),
  ]);

  return json(auth, { data }, { status: 201 });
}
