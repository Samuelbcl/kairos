import { getHostBranding } from "@/lib/host-branding";

export const metadata = {
  title: "Conditions d'utilisation",
  description: "Ce que le service fait, ce qu'il attend de toi, et ce qu'il ne garantit pas.",
};

/**
 * Conditions d'utilisation.
 *
 * Google les demande en même temps que la politique de confidentialité pour
 * publier un client OAuth. Volontairement courtes et lisibles : des conditions
 * que personne ne lit ne protègent personne.
 */
export default async function TermsPage() {
  const brand = await getHostBranding();
  const updated = "29 août 2026";

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Conditions d&apos;utilisation
        </h1>
        <p className="text-sm text-muted-foreground">
          Dernière mise à jour : {updated}
        </p>
      </header>

      <Section title="Le service">
        <p>
          {brand.brandName} est un outil de gestion de la relation client : il
          conserve tes contacts professionnels, suit tes opportunités et te
          rappelle tes relances, en les synchronisant avec ton agenda si tu le
          souhaites.
        </p>
      </Section>

      <Section title="Ton compte">
        <p>
          Tu es responsable de l&apos;accès à ton compte et des personnes que tu
          invites dans ton espace. Préviens-nous si tu constates un accès que tu
          n&apos;as pas autorisé.
        </p>
      </Section>

      <Section title="Tes données t'appartiennent">
        <p>
          Tout ce que tu saisis reste à toi. Nous ne le vendons pas, ne
          l&apos;exploitons pas à d&apos;autres fins, et ne nous en servons pas pour
          entraîner un modèle. Tu peux tout exporter ou tout effacer à tout
          moment depuis les réglages.
        </p>
      </Section>

      <Section title="Ce que tu t'engages à ne pas faire">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            Envoyer des messages non sollicités en masse à des personnes qui ne
            t&apos;ont rien demandé.
          </li>
          <li>
            Y stocker des données sensibles au sens du RGPD — santé, opinions
            politiques, religion, orientation sexuelle. Le service n&apos;est pas
            conçu pour ça.
          </li>
          <li>
            Tenter d&apos;accéder aux données d&apos;un autre espace, ou de contourner les
            limites du service.
          </li>
        </ul>
      </Section>

      <Section title="Disponibilité">
        <p>
          Le service est fourni en l&apos;état, sans garantie de disponibilité
          ininterrompue. Des interruptions peuvent survenir pour maintenance ou
          du fait de nos hébergeurs.
        </p>
        <p>
          Tes données sont sauvegardées par notre hébergeur, mais l&apos;export
          régulier depuis <em>Réglages → Espace</em> reste la façon la plus sûre
          d&apos;en garder une copie qui t&apos;appartient.
        </p>
      </Section>

      <Section title="Responsabilité">
        <p>
          Nous mettons tout en œuvre pour que le service fonctionne
          correctement, mais nous ne pouvons être tenus responsables des pertes
          commerciales résultant d&apos;une indisponibilité, d&apos;une erreur de
          synchronisation d&apos;agenda ou d&apos;une relance non envoyée.
        </p>
      </Section>

      <Section title="Fin du service">
        <p>
          Tu peux supprimer ton espace à tout moment, sans préavis ni
          justification. Si nous devions arrêter le service, tu serais prévenu
          suffisamment tôt pour exporter tes données.
        </p>
      </Section>

      <Section title="Nous contacter">
        <p>
          <a href="mailto:samuelbiancola@gmail.com" className="underline underline-offset-2">
            samuelbiancola@gmail.com
          </a>
        </p>
      </Section>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
