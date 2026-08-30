/**
 * Variables d'environnement publiques (safe côté client).
 * Les valeurs NEXT_PUBLIC_* sont inlinées au build : on doit les lire
 * littéralement, pas via une destructuration de process.env.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Ajoute-la dans .env.local (voir .env.example), puis relance npm run dev.`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    );
  },
  get supabaseAnonKey() {
    return required(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  },
  get appUrl() {
    return normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  },
};

const warned = new Set<string>();

/**
 * Ramène NEXT_PUBLIC_APP_URL à une origine utilisable : schéma + domaine, rien
 * d'autre.
 *
 * Toutes les URI de redirection OAuth et tous les liens des e-mails sont
 * construits par concaténation sur cette valeur. Deux fautes de saisie
 * classiques la cassaient entièrement, sans le moindre message :
 *
 *   « kairos.vercel.app »            → redirect_uri sans schéma, Google
 *                                      répond 400 invalid_request
 *   « https://kairos.app/login?x=1 » → collé depuis la barre d'adresse, le
 *                                      chemin se retrouve au milieu de l'URI
 *
 * On répare et on le dit dans les journaux, une fois par valeur fautive. Le
 * réglage reste à corriger chez l'hébergeur : la réparation évite la panne,
 * elle ne remplace pas la configuration.
 */
export function normalizeAppUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return "http://localhost:3000";

  // Sans schéma, on en choisit un : http en local, https partout ailleurs.
  const withScheme = /^https?:\/\//i.test(value)
    ? value
    : `${/^(localhost|127\.0\.0\.1)(:|$)/i.test(value) ? "http" : "https"}://${value}`;

  let origin: string;
  try {
    origin = new URL(withScheme).origin;
  } catch {
    // Illisible : mieux vaut une valeur par défaut qu'une URL absurde envoyée
    // à Google. L'avertissement dit quoi corriger.
    origin = "http://localhost:3000";
  }

  if (origin !== value && !warned.has(value)) {
    warned.add(value);
    console.warn(
      `[env] NEXT_PUBLIC_APP_URL vaut « ${value} », utilisée comme « ${origin} ». ` +
        `Corrige-la chez ton hébergeur : elle doit être une origine nue, ` +
        `sans chemin, sans paramètre et sans barre oblique finale.`,
    );
  }

  return origin;
}

/** True si Supabase est configuré. Sert à afficher un écran d'aide au lieu de crasher. */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
