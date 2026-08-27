/**
 * Types de la base — PLACEHOLDER.
 *
 * Une fois le projet Supabase créé et 0001_init.sql exécuté, régénère ce fichier :
 *   npx supabase link --project-ref <ref>
 *   npm run db:types
 *
 * Le placeholder garde le typage souple pour que l'app compile avant la
 * première génération. Ne pas l'éditer à la main après génération.
 */

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
        Relationships: [];
      }
    >;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
