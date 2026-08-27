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
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },
};

/** True si Supabase est configuré. Sert à afficher un écran d'aide au lieu de crasher. */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
