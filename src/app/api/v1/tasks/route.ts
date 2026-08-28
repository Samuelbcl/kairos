import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey, isErrorResponse, readPagination } from "@/lib/api-auth";
import { taskCreateSchema } from "@/lib/validators/task";
import { firstIssue } from "@/lib/validators/common";
import { dispatchWebhooks } from "@/lib/webhooks";
import { runAutomations } from "@/lib/automations/engine";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, title, kind, notes, due_at, remind_at, done, done_at, priority, company_id, contact_id, deal_id, external_event_id, created_at, updated_at";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (isErrorResponse(auth)) return auth;

  const { limit, offset } = readPagination(request);
  const { searchParams } = request.nextUrl;
  const done = searchParams.get("done");
  const overdue = searchParams.get("overdue") === "true";

  const admin = createAdminClient();
  let query = admin
    .from("tasks")
    .select(FIELDS, { count: "exact" })
    .eq("workspace_id", auth.workspaceId)
    .order("due_at")
    .range(offset, offset + limit - 1);

  if (done === "true" || done === "false") query = query.eq("done", done === "true");
  if (overdue) {
    query = query.eq("done", false).lt("due_at", new Date().toISOString());
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[api/v1/tasks] lecture impossible", error.message);
    return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
  }

  return NextResponse.json({ data, count, limit, offset });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (isErrorResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 422 });
  }

  const { remind_before_min, ...fields } = parsed.data;
  const dueAt = new Date(fields.due_at);
  const remindAt =
    remind_before_min > 0
      ? new Date(dueAt.getTime() - remind_before_min * 60_000).toISOString()
      : null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .insert({ ...fields, workspace_id: auth.workspaceId, remind_at: remindAt })
    .select(FIELDS)
    .single();

  if (error) {
    console.error("[api/v1/tasks] création impossible", error.message);
    return NextResponse.json({ error: "Création impossible." }, { status: 500 });
  }

  // La synchronisation agenda dépend d'un utilisateur connecté : une relance
  // créée par l'API vit dans Kairos, et partira vers l'agenda au prochain
  // « Envoyer les relances en attente » de son propriétaire.
  await Promise.all([
    runAutomations(
      { type: "task.created", payload: { task: data } },
      { workspaceId: auth.workspaceId, supabase: admin },
    ),
    dispatchWebhooks(admin, auth.workspaceId, "task.created", { task: data }),
  ]);

  return NextResponse.json({ data }, { status: 201 });
}
