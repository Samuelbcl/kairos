import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authenticateApiKey,
  isErrorResponse,
  json,
  readPagination,
} from "@/lib/api-auth";
import { companyCreateSchema } from "@/lib/validators/company";
import { firstIssue } from "@/lib/validators/common";
import { dispatchWebhooks } from "@/lib/webhooks";
import { runAutomations } from "@/lib/automations/engine";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, name, email, phone, website, sector, address, city, country, size, tags, source, custom, created_at, updated_at";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (isErrorResponse(auth)) return auth;

  const { limit, offset } = readPagination(request);
  const search = request.nextUrl.searchParams.get("q")?.trim();

  const admin = createAdminClient();
  let query = admin
    .from("companies")
    .select(FIELDS, { count: "exact" })
    .eq("workspace_id", auth.workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[api/v1/companies] lecture impossible", error.message);
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

  const parsed = companyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json(auth, { error: firstIssue(parsed.error) }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .insert({ ...parsed.data, workspace_id: auth.workspaceId, source: parsed.data.source ?? "api" })
    .select(FIELDS)
    .single();

  if (error) {
    console.error("[api/v1/companies] création impossible", error.message);
    return json(auth, { error: "Création impossible." }, { status: 500 });
  }

  await Promise.all([
    runAutomations(
      { type: "company.created", payload: { company: data } },
      { workspaceId: auth.workspaceId, supabase: admin },
    ),
    dispatchWebhooks(admin, auth.workspaceId, "company.created", { company: data }),
  ]);

  return json(auth, { data }, { status: 201 });
}
