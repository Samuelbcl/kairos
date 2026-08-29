import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateApiKey,
  isErrorResponse,
  json,
  readPagination,
} from "@/lib/api-auth";
import { contactCreateSchema } from "@/lib/validators/contact";
import { firstIssue } from "@/lib/validators/common";
import { dispatchWebhooks } from "@/lib/webhooks";
import { runAutomations } from "@/lib/automations/engine";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, company_id, first_name, last_name, email, phone, role_title, tags, custom, created_at, updated_at";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (isErrorResponse(auth)) return auth;

  const { limit, offset } = readPagination(request);
  const companyId = request.nextUrl.searchParams.get("company_id");

  const admin = createAdminClient();
  let query = admin
    .from("contacts")
    .select(FIELDS, { count: "exact" })
    .eq("workspace_id", auth.workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (companyId) query = query.eq("company_id", companyId);

  const { data, error, count } = await query;

  if (error) {
    console.error("[api/v1/contacts] lecture impossible", error.message);
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

  const parsed = contactCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json(auth, { error: firstIssue(parsed.error) }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contacts")
    .insert({ ...parsed.data, workspace_id: auth.workspaceId })
    .select(FIELDS)
    .single();

  if (error) {
    console.error("[api/v1/contacts] création impossible", error.message);
    return json(auth, { error: "Création impossible." }, { status: 500 });
  }

  await Promise.all([
    runAutomations(
      { type: "contact.created", payload: { contact: data } },
      { workspaceId: auth.workspaceId, supabase: admin },
    ),
    dispatchWebhooks(admin, auth.workspaceId, "contact.created", { contact: data }),
  ]);

  return json(auth, { data }, { status: 201 });
}
