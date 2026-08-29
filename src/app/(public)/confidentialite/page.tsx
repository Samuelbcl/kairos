import { getHostBranding } from "@/lib/host-branding";

export const metadata = {
  title: "Règles de confidentialité",
  description:
    "Quelles données Kairos traite, pourquoi, combien de temps, et comment les récupérer ou les effacer.",
};

/**
 * Politique de confidentialité.
 *
 * Exigée par Google pour autoriser un client OAuth, et de toute façon
 * nécessaire dès qu'on héberge les données d'un client. Le contenu décrit
 * ce que le produit fait réellement — voir docs/RGPD.md pour le détail
 * technique et le modèle de contrat de sous-traitance.
 */
export default async function PrivacyPage() {
  const brand = await getHostBranding();
  const updated = "29 août 2026";

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Règles de confidentialité
        </h1>
        <p className="text-sm text-muted-foreground">
          Dernière mise à jour : {updated}
        </p>
      </header>

      <Section title="En bref">
        <p>
          {brand.brandName} est un outil de gestion de la relation client. Il
          conserve les coordonnées professionnelles que tu y saisis, et les
          rendez-vous de relance que tu programmes. Ces données t&apos;appartiennent :
          elles ne sont ni revendues, ni utilisées à d&apos;autres fins, ni exploitées
          pour entraîner un modèle. Tu peux les exporter ou les effacer à tout
          moment depuis l&apos;application.
        </p>
      </Section>

      <Section title="Données traitées">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            <strong>Ton compte</strong> — adresse e-mail, nom affiché, et le
            fournisseur utilisé pour te connecter.
          </li>
          <li>
            <strong>Tes contacts professionnels</strong> — entreprises et
            personnes que tu saisis ou importes : nom, e-mail, téléphone,
            adresse, secteur, notes et historique de tes échanges.
          </li>
          <li>
            <strong>Ton activité commerciale</strong> — opportunités, montants,
            étapes, relances et leurs échéances.
          </li>
          <li>
            <strong>Tes connexions</strong> — si tu relies un agenda Google ou
            Microsoft, les jetons d&apos;accès correspondants.
          </li>
        </ul>
      </Section>

      <Section title="Accès à ton agenda">
        <p>
          Quand tu connectes un agenda, {brand.brandName} demande la seule
          autorisation dont il a besoin : <strong>gérer les événements</strong>{" "}
          de ton calendrier.
        </p>
        <p>
          Cet accès sert exclusivement à créer, modifier et supprimer les
          événements correspondant à tes relances. {brand.brandName} ne lit pas
          tes autres rendez-vous, n&apos;en conserve aucune copie, et n&apos;accède ni à
          tes e-mails ni à tes contacts Google.
        </p>
        <p>
          Tu peux couper cet accès à tout moment depuis{" "}
          <em>Réglages → Intégrations → Déconnecter</em>, ou depuis les
          paramètres de sécurité de ton compte Google. Les événements déjà créés
          restent dans ton agenda ; {brand.brandName} cesse simplement de les
          gérer.
        </p>
      </Section>

      <Section title="Où sont les données">
        <p>
          Elles sont hébergées dans l&apos;Union européenne, chez Supabase, région
          Francfort. Aucun transfert hors UE n&apos;est prévu.
        </p>
        <p>
          Chaque espace de travail est cloisonné au niveau de la base de
          données : les données d&apos;un client sont inaccessibles à un autre, y
          compris en cas de faille applicative.
        </p>
      </Section>

      <Section title="Sécurité">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Chiffrement en transit et au repos.</li>
          <li>
            Jetons d&apos;agenda chiffrés en AES-256-GCM avant stockage, jamais
            écrits dans les journaux.
          </li>
          <li>Clés d&apos;API conservées sous forme d&apos;empreinte, jamais en clair.</li>
          <li>Accès journalisés.</li>
        </ul>
      </Section>

      <Section title="Durées de conservation">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            Une fiche supprimée reste <strong>trente jours</strong> dans la
            corbeille, puis est effacée définitivement.
          </li>
          <li>
            Supprimer un espace de travail efface immédiatement tout ce qu&apos;il
            contient.
          </li>
          <li>
            Supprimer ton compte supprime aussi ton espace s&apos;il n&apos;a plus aucun
            membre.
          </li>
        </ul>
      </Section>

      <Section title="Tes droits">
        <p>
          Conformément au RGPD, tu peux accéder à tes données, les rectifier,
          les effacer, et les récupérer dans un format lisible par machine.
        </p>
        <p>
          Ces trois droits s&apos;exercent directement dans l&apos;application, sans avoir
          à écrire à qui que ce soit : <em>Réglages → Espace</em> contient un
          export complet au format JSON et la suppression définitive de
          l&apos;espace.
        </p>
      </Section>

      <Section title="Sous-traitants">
        <p>
          {brand.brandName} s&apos;appuie sur : <strong>Supabase</strong> (base de
          données et stockage, UE), <strong>Vercel</strong> (hébergement de
          l&apos;application), <strong>Resend</strong> (envoi des e-mails), et{" "}
          <strong>Google</strong> ou <strong>Microsoft</strong> uniquement si tu
          connectes un agenda.
        </p>
      </Section>

      <Section title="Nous contacter">
        <p>
          Pour toute question sur ces règles ou pour exercer un droit :{" "}
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
