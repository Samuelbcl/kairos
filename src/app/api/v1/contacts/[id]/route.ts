import { resourceHandlers } from "@/lib/api-resource";
import { contactUpdateSchema } from "@/lib/validators/contact";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, company_id, first_name, last_name, email, phone, role_title, tags, custom, created_at, updated_at";

export const { GET, PATCH, DELETE } = resourceHandlers({
  table: "contacts",
  fields: FIELDS,
  updateSchema: contactUpdateSchema,
});
