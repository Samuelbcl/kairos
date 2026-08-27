import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

/**
 * Client `service_role` — CONTOURNE LA RLS.
 *
 * Réservé aux routes système sans utilisateur connecté : cron (rappels, refresh
 * des tokens OAuth) et webhooks entrants. Ne jamais l'utiliser dans une action
 * déclenchée par un utilisateur : passer par le client serveur normal, qui
 * respecte la RLS.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL manquante. " +
        "Ajoute-les dans .env.local (et dans les variables Vercel pour la prod).",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
