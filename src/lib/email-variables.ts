/**
 * Variables interpolables dans un modèle d'e-mail — partagé serveur et client.
 * Le composeur les insère au clic : personne ne devrait avoir à taper
 * `{{company.name}}` de mémoire.
 */

export const EMAIL_VARIABLES = [
  { token: "{{company.name}}", label: "Nom de l'entreprise" },
  { token: "{{company.email}}", label: "E-mail de l'entreprise" },
  { token: "{{company.city}}", label: "Ville de l'entreprise" },
  { token: "{{company.sector}}", label: "Secteur de l'entreprise" },
  { token: "{{contact.first_name}}", label: "Prénom du contact" },
  { token: "{{contact.last_name}}", label: "Nom du contact" },
  { token: "{{contact.email}}", label: "E-mail du contact" },
  { token: "{{deal.title}}", label: "Titre de l'opportunité" },
  { token: "{{deal.value}}", label: "Montant de l'opportunité" },
  { token: "{{user.full_name}}", label: "Ton nom" },
  { token: "{{today}}", label: "Date du jour" },
] as const;

/** Aperçu : de quoi juger le rendu sans avoir à envoyer un vrai message. */
export const PREVIEW_CONTEXT: Record<string, unknown> = {
  company: {
    name: "Menuiserie Dupont",
    email: "info@menuiserie-dupont.be",
    city: "Liège",
    sector: "Menuiserie",
  },
  contact: {
    first_name: "Marc",
    last_name: "Dupont",
    email: "marc@menuiserie-dupont.be",
  },
  deal: { title: "Site vitrine", value: "3 500 €" },
  user: { full_name: "Samuel Biancola" },
  today: new Intl.DateTimeFormat("fr-BE", { dateStyle: "long" }).format(new Date()),
};

/** Interpole {{variable}}. Variable inconnue → chaîne vide, jamais le jeton brut. */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = path
      .split(".")
      .reduce<unknown>(
        (acc, key) =>
          acc && typeof acc === "object"
            ? (acc as Record<string, unknown>)[key]
            : undefined,
        context,
      );
    return value == null ? "" : String(value);
  });
}
