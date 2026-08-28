/**
 * Catalogue des champs importables — partagé serveur et client.
 *
 * Volontairement hors de `server/actions/import.ts` : dans un fichier marqué
 * `"use server"`, tous les exports doivent être des fonctions async. Une
 * constante exportée depuis là arrive côté client sous forme de référence
 * d'action, pas de valeur — et casse au premier `.map()`.
 */

export const IMPORT_FIELDS = [
  { key: "name", label: "Nom de l'entreprise", required: true },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Téléphone" },
  { key: "website", label: "Site web" },
  { key: "sector", label: "Secteur" },
  { key: "address", label: "Adresse" },
  { key: "city", label: "Ville" },
  { key: "country", label: "Pays" },
  { key: "size", label: "Taille" },
  { key: "tags", label: "Tags (séparés par une virgule)" },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];

export type ImportReport = {
  created: number;
  skipped: number;
  duplicates: string[];
  errors: { line: number; reason: string }[];
};
