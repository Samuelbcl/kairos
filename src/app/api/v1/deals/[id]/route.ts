import { resourceHandlers } from "@/lib/api-resource";
import { dealUpdateSchema } from "@/lib/validators/deal";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, title, value, currency, priority, status, stage_id, company_id, contact_id, expected_close, last_activity_at, created_at, updated_at";

export const { GET, PATCH, DELETE } = resourceHandlers({
  table: "deals",
  fields: FIELDS,
  updateSchema: dealUpdateSchema,
  updatedEvent: "deal.stage_changed",
});
