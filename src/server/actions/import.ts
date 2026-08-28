"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { fail, ok, pgError, type ActionResult } from "@/server/actions/types";
import type { ImportReport } from "@/lib/import-fields";

const rowSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  website: z.string().trim().optional(),
  sector: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  size: z.string().trim().optional(),
  tags: z.array(z.string()).optional(),
});

const payloadSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1).max(5000),
  /** colonne CSV → champ Kairos ; une colonne non mappée est ignorée. */
  mapping: z.record(z.string(), z.string()),
  /** Étape du pipeline où créer une opportunité par ligne (facultatif). */
  createDealsInStage: z.string().optional(),
});

/**
 * Importe des entreprises depuis un CSV déjà découpé côté client.
 *
 * Dédoublonnage sur l'e-mail (le seul identifiant fiable d'une prospection),
 * puis sur le nom exact si la ligne n'a pas d'e-mail. Rien n'est écrasé :
 * un doublon est signalé, jamais fusionné en silence.
 */
export async function importCompanies(
  input: unknown,
): Promise<ActionResult<ImportReport>> {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Fichier illisible. Vérifie que c'est bien un CSV avec un en-tête.");
  }

  const workspace = await requireWorkspace();
  const supabase = await createClient();
  const { rows, mapping, createDealsInStage } = parsed.data;

  // Index de l'existant, pour ne pas créer de doublon.
  const { data: existing } = await supabase
    .from("companies")
    .select("name, email")
    .eq("workspace_id", workspace.id)
    .limit(10000);

  const knownEmails = new Set(
    (existing ?? [])
      .map((c) => c.email?.toLowerCase().trim())
      .filter((v): v is string => Boolean(v)),
  );
  const knownNames = new Set(
    (existing ?? []).map((c) => c.name.toLowerCase().trim()),
  );

  const report: ImportReport = { created: 0, skipped: 0, duplicates: [], errors: [] };
  const toInsert: Record<string, unknown>[] = [];

  rows.forEach((row, index) => {
    const line = index + 2; // +1 pour l'en-tête, +1 pour compter à partir de 1
    const candidate: Record<string, unknown> = {};

    for (const [column, field] of Object.entries(mapping)) {
      if (!field) continue;
      const raw = (row[column] ?? "").trim();
      if (!raw) continue;

      if (field === "tags") {
        candidate.tags = raw
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean);
      } else {
        candidate[field] = raw;
      }
    }

    const validated = rowSchema.safeParse(candidate);
    if (!validated.success) {
      report.errors.push({
        line,
        reason: "Nom d'entreprise manquant ou invalide.",
      });
      return;
    }

    const email = validated.data.email?.toLowerCase();
    const nameKey = validated.data.name.toLowerCase();

    if (email ? knownEmails.has(email) : knownNames.has(nameKey)) {
      report.skipped += 1;
      if (report.duplicates.length < 20) report.duplicates.push(validated.data.name);
      return;
    }

    if (email) knownEmails.add(email);
    knownNames.add(nameKey);

    toInsert.push({
      ...validated.data,
      workspace_id: workspace.id,
      source: "import",
    });
  });

  if (toInsert.length === 0) {
    return ok(report);
  }

  // Insertion par lots : au-delà, la requête devient trop lourde.
  const BATCH = 200;
  const insertedIds: string[] = [];

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("companies")
      .insert(batch as never)
      .select("id");

    if (error) {
      console.error("[import] insertion impossible", error.message);
      return fail(
        pgError(
          error,
          `Import interrompu après ${report.created} entreprise(s). Rien d'autre n'a été créé.`,
        ),
      );
    }

    report.created += data?.length ?? 0;
    insertedIds.push(...(data ?? []).map((d) => d.id));
  }

  // Option : une opportunité par entreprise importée, dans l'étape choisie.
  if (createDealsInStage && insertedIds.length) {
    const { data: stage } = await supabase
      .from("stages")
      .select("id, pipeline_id")
      .eq("id", createDealsInStage)
      .eq("workspace_id", workspace.id)
      .single();

    if (stage) {
      const names = new Map(
        toInsert.map((row, index) => [insertedIds[index], String(row.name)]),
      );

      for (let i = 0; i < insertedIds.length; i += BATCH) {
        const batch = insertedIds.slice(i, i + BATCH).map((companyId) => ({
          workspace_id: workspace.id,
          pipeline_id: stage.pipeline_id,
          stage_id: stage.id,
          company_id: companyId,
          title: names.get(companyId) ?? "Opportunité importée",
          last_activity_at: new Date().toISOString(),
        }));

        const { error } = await supabase.from("deals").insert(batch as never);
        if (error) {
          console.error("[import] création des opportunités impossible", error.message);
          break;
        }
      }
    }
  }

  revalidatePath("/contacts");
  revalidatePath("/pipeline");
  return ok(report);
}
