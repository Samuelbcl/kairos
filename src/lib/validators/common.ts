import { z } from "zod";

/** Chaîne vide → undefined. Les formulaires HTML envoient "" pour un champ vide. */
export const emptyToUndefined = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

export const optionalText = emptyToUndefined(z.string().trim().max(500));
export const optionalEmail = emptyToUndefined(z.email("Adresse e-mail invalide."));
export const optionalUrl = emptyToUndefined(
  z.string().trim().transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`)),
);
export const optionalPhone = emptyToUndefined(z.string().trim().max(40));

export const uuid = z.uuid("Identifiant invalide.");

export const tagsSchema = z.preprocess(
  (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim())
      return v.split(",").map((t) => t.trim()).filter(Boolean);
    return [];
  },
  z.array(z.string().trim().min(1).max(40)).max(20),
);

/**
 * Champs personnalisés : jsonb libre, mais on borne la taille.
 *
 * Surtout : pas de `.default({})`. Avec un défaut, une modification qui ne
 * touche pas aux champs personnalisés renvoyait quand même `custom: {}` — et
 * écrasait donc silencieusement toutes leurs valeurs à chaque édition en ligne.
 */
export const customSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export const priorityEnum = z.enum(["low", "normal", "high"]);

/** Première erreur zod, en français, prête à afficher dans un toast. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.join(".");
  return path ? `${path} : ${issue.message}` : issue.message;
}
