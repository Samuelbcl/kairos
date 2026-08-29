"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";

const schema = z.object({
  entity: z.enum(["company", "contact", "deal"]),
  id: z.uuid(),
});

const TABLES = {
  company: "companies",
  contact: "contacts",
  deal: "deals",
} as const;

/**
 * Sort une fiche de la corbeille. Restaurer une entreprise ne ressuscite pas
 * automatiquement ses contacts et opportunités : ils se restaurent un par un,
 * ce qui évite de faire revenir ce qu'on avait volontairement supprimé avant.
 */
export async function restoreFromTrash(
  entity: string,
  id: string,
): Promise<ActionResult> {
  const parsed = schema.safeParse({ entity, id });
  if (!parsed.success) return fail("Élément invalide.");

  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from(TABLES[parsed.data.entity])
    .update({ deleted_at: null })
    .eq("id", parsed.data.id)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("[corbeille] restauration impossible", error.message);
    return fail(pgError(error, "Restauration impossible. Réessaie."));
  }

  revalidatePath("/settings/trash");
  revalidatePath("/contacts");
  revalidatePath("/pipeline");
  return ok(undefined);
}
