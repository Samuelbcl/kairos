import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/types/db";

/**
 * Client Supabase côté serveur (Server Components, Server Actions, Route Handlers).
 * Utilise la session de l'utilisateur : toutes les requêtes passent par la RLS.
 *
 * Dans un Server Component, l'écriture de cookies est interdite par React —
 * on l'ignore silencieusement, le rafraîchissement de session est fait par proxy.ts.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : proxy.ts rafraîchit déjà la session.
        }
      },
    },
  });
}

/**
 * Utilisateur connecté, vérifié auprès du serveur Auth (jamais depuis le cookie seul).
 * Renvoie null si personne n'est connecté.
 */
export async function getUser() {
  // Le layout redirige vers /setup, mais la page rend en parallèle : on sort proprement.
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
