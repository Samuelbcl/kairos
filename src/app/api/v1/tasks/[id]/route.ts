import { resourceHandlers } from "@/lib/api-resource";
import { taskUpdateSchema } from "@/lib/validators/task";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, title, kind, notes, due_at, remind_at, done, done_at, priority, company_id, contact_id, deal_id, external_event_id, created_at, updated_at";

// Les relances n'ont pas de corbeille : une relance supprimée n'a pas vocation
// à revenir, et son événement d'agenda est nettoyé par ailleurs.
export const { GET, PATCH, DELETE } = resourceHandlers({
  table: "tasks",
  fields: FIELDS,
  updateSchema: taskUpdateSchema,
  softDelete: false,
});
