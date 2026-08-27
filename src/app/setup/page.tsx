import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Configuration requise" };

const steps = [
  "Crée un projet Supabase en région Central EU (Frankfurt) — eu-central-1.",
  "Project Settings → API : copie Project URL, la clé anon et la clé service_role.",
  "Colle-les dans .env.local (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).",
  "SQL Editor : exécute supabase/migrations/0001_init.sql.",
  "Relance npm run dev.",
];

export default function SetupPage() {
  if (isSupabaseConfigured) redirect("/");

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-lg rounded-lg border bg-card p-6">
        <Database className="size-6 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <h1 className="mt-3 text-lg font-semibold tracking-tight">
          Kairos n&apos;est pas encore relié à Supabase
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Il manque les variables d&apos;environnement. Cinq étapes et c&apos;est réglé.
        </p>
        <ol className="mt-5 flex flex-col gap-2.5">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="tabular mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-medium">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
