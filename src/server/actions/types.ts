/** Contrat de retour de toutes les Server Actions. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Traduit une erreur Postgres en message actionnable pour l'utilisateur.
 * On ne renvoie jamais le message brut : il fuite des noms de contraintes.
 */
export function pgError(
  error: { code?: string; message: string },
  fallback: string,
): string {
  switch (error.code) {
    case "23505":
      return "Cet enregistrement existe déjà.";
    case "23503":
      return "Un élément lié a été supprimé entre-temps. Recharge la page.";
    case "42501":
      return "Tu n'as pas les droits pour cette action dans cet espace.";
    case "22P02":
      return "Une valeur envoyée n'a pas le bon format.";
    default:
      return fallback;
  }
}
