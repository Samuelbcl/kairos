import { resourceHandlers } from "@/lib/api-resource";
import { companyUpdateSchema } from "@/lib/validators/company";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, name, email, phone, website, sector, address, city, country, size, tags, source, custom, created_at, updated_at";

export const { GET, PATCH, DELETE } = resourceHandlers({
  table: "companies",
  fields: FIELDS,
  updateSchema: companyUpdateSchema,
});
