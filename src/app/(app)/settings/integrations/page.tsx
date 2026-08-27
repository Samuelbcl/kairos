import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IntegrationCard } from "@/components/settings/integration-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { googleConfigured } from "@/lib/integrations/google";
import { microsoftConfigured } from "@/lib/integrations/microsoft";

export const metadata = { title: "Intégrations" };

const MESSAGES: Record<string, string> = {
  refused: "Connexion annulée. Rien n'a été modifié.",
  state:
    "Le lien de connexion a expiré. Relance la connexion depuis cette page.",
  session: "Ta session a changé pendant la connexion. Réessaie.",
  save: "Les jetons n'ont pas pu être enregistrés. Réessaie dans un instant.",
  exchange:
    "Le fournisseur a refusé l'échange. Vérifie que l'URL de redirection est bien déclarée de son côté.",
  google_not_configured:
    "GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET ne sont pas renseignés dans les variables d'environnement.",
  microsoft_not_configured:
    "MICROSOFT_CLIENT_ID et MICROSOFT_CLIENT_SECRET ne sont pas renseignés dans les variables d'environnement.",
  no_workspace: "Aucun espace actif. Reconnecte-toi.",
};

export default async function IntegrationsPage(
  props: PageProps<"/settings/integrations">,
) {
  const params = await props.searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const connected = typeof params.connected === "string" ? params.connected : undefined;

  const workspace = await getCurrentWorkspace();
  const user = await getUser();

  // La table integrations contient des jetons : lecture serveur uniquement,
  // et on n'en extrait que des métadonnées, jamais les jetons eux-mêmes.
  let rows: { provider: string; account_email: string | null; created_at: string }[] = [];

  if (workspace && user) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("integrations")
      .select("provider, account_email, created_at")
      .eq("workspace_id", workspace.id)
      .eq("user_id", user.id);
    rows = data ?? [];
  }

  const google = rows.find((r) => r.provider === "google");
  const microsoft = rows.find((r) => r.provider === "microsoft");

  return (
    <>
      <PageHeader
        title="Intégrations"
        description="Connecte ton agenda : chaque relance devient un vrai rappel."
      />

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Connexion impossible</AlertTitle>
          <AlertDescription>
            {MESSAGES[error] ?? "Une erreur inattendue est survenue. Réessaie."}
          </AlertDescription>
        </Alert>
      ) : null}

      {connected ? (
        <Alert className="mb-4">
          <AlertTitle>
            {connected === "google" ? "Google Agenda connecté" : "Outlook connecté"}
          </AlertTitle>
          <AlertDescription>
            Tes prochaines relances y créeront un événement avec rappel. Tu peux
            aussi y envoyer celles qui existent déjà.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <IntegrationCard
          provider="google"
          name="Google Agenda"
          description="Chaque relance crée un événement dans ton agenda, avec rappel. Terminer la relance retire l'événement."
          configured={googleConfigured()}
          accountEmail={google?.account_email ?? null}
          connectedAt={google?.created_at ?? null}
          missingEnvHint="Ajoute GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans .env.local (et dans Vercel), puis redémarre."
        />

        <IntegrationCard
          provider="microsoft"
          name="Outlook / Microsoft 365"
          description="Mêmes capacités que Google Agenda, via Microsoft Graph."
          configured={microsoftConfigured()}
          accountEmail={microsoft?.account_email ?? null}
          connectedAt={microsoft?.created_at ?? null}
          missingEnvHint="Ajoute MICROSOFT_CLIENT_ID et MICROSOFT_CLIENT_SECRET dans .env.local (et dans Vercel), puis redémarre."
        />
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        Les jetons d&apos;accès sont chiffrés en AES-256-GCM avant d&apos;être stockés,
        ne quittent jamais le serveur et ne sont jamais écrits dans les journaux.
        La synchronisation est unidirectionnelle : Kairos écrit dans ton agenda,
        jamais l&apos;inverse.
      </p>
    </>
  );
}
