import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

type Client = SupabaseClient<Database>;
export type SubjectType = Database["public"]["Enums"]["custom_entity"];
export type ActivityType = Database["public"]["Enums"]["activity_type"];

/**
 * Écrit une entrée dans la timeline. Jamais bloquant : si le log échoue,
 * l'action métier reste valide — on trace l'échec côté serveur.
 */
export async function logActivity(
  supabase: Client,
  entry: {
    workspaceId: string;
    subjectType: SubjectType;
    subjectId: string;
    type: ActivityType;
    content?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("activities").insert({
    workspace_id: entry.workspaceId,
    subject_type: entry.subjectType,
    subject_id: entry.subjectId,
    type: entry.type,
    content: entry.content ?? null,
    meta: (entry.meta ?? {}) as never,
  });

  if (error) {
    console.error("[activities] écriture impossible", error.message);
  }
}

/** Remonte `last_activity_at` d'un deal — sert à repérer ceux qui dorment. */
export async function touchDeal(supabase: Client, dealId: string) {
  const { error } = await supabase
    .from("deals")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", dealId);

  if (error) console.error("[activities] touchDeal impossible", error.message);
}
