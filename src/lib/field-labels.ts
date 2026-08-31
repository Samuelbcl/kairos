/**
 * Noms des champs intégrés, renommables par espace.
 *
 * Les champs personnalisés (Réglages → Champs) permettent d'en ajouter ; ceci
 * permet de renommer ceux qui existent déjà. Un cabinet parle de « Raison
 * sociale » plutôt que de « Nom », un artisan de « Chantier » plutôt que de
 * « Secteur » : le vocabulaire du métier prime sur le nôtre.
 *
 * Volontairement sans `server-only` : le panneau de réglages et les fiches sont
 * des composants client, ils ont besoin de cette liste.
 */

export type LabelledEntity = "company" | "contact";

export type FieldDefinition = {
  /** Clé technique, jamais affichée. Sert de colonne en base. */
  field: string;
  /** Nom affiché par défaut. */
  label: string;
};

export const FIELD_DEFINITIONS: Record<LabelledEntity, FieldDefinition[]> = {
  company: [
    { field: "name", label: "Nom" },
    { field: "email", label: "E-mail" },
    { field: "phone", label: "Téléphone" },
    { field: "website", label: "Site web" },
    { field: "sector", label: "Secteur" },
    { field: "address", label: "Adresse" },
    { field: "city", label: "Ville" },
    { field: "size", label: "Taille" },
    { field: "tags", label: "Tags" },
    { field: "source", label: "Source" },
  ],
  contact: [
    { field: "first_name", label: "Prénom" },
    { field: "last_name", label: "Nom" },
    { field: "email", label: "E-mail" },
    { field: "phone", label: "Téléphone" },
    { field: "role_title", label: "Fonction" },
    { field: "tags", label: "Tags" },
  ],
};

export const ENTITY_LABELS: Record<LabelledEntity, string> = {
  company: "Entreprises",
  contact: "Contacts",
};

/** Ce que l'espace a stocké : `{ "company.name": "Raison sociale" }`. */
export type FieldLabelOverrides = Record<string, string>;

export type ResolvedLabels = Record<string, string>;

/**
 * Fusionne les noms par défaut et ceux de l'espace.
 *
 * Une valeur vide vaut « pas de renommage » : effacer le champ dans les
 * réglages doit rendre le nom d'origine, pas un libellé vide.
 */
export function resolveFieldLabels(
  entity: LabelledEntity,
  overrides: FieldLabelOverrides | null | undefined,
): ResolvedLabels {
  const labels: ResolvedLabels = {};

  for (const definition of FIELD_DEFINITIONS[entity]) {
    const custom = overrides?.[`${entity}.${definition.field}`]?.trim();
    labels[definition.field] = custom || definition.label;
  }

  return labels;
}

/** Clé de stockage d'un champ. Un seul endroit pour la former. */
export function labelKey(entity: LabelledEntity, field: string) {
  return `${entity}.${field}`;
}
