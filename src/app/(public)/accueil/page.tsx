import Link from "next/link";
import { ArrowRight, CalendarClock, KanbanSquare, ShieldCheck, Zap } from "lucide-react";
import { getHostBranding } from "@/lib/host-branding";

export const metadata = {
  title: "Le CRM qui te rappelle tes relances",
  description:
    "Comptes, contacts, opportunités et relances synchronisées à ton agenda. Hébergé en Europe.",
};

/**
 * Page d'accueil publique.
 *
 * Servie à la racine aux visiteurs non connectés (réécriture dans `proxy.ts`).
 * Deux raisons, dans cet ordre d'importance :
 *
 *  1. Un prospect doit pouvoir comprendre le produit avant de créer un compte.
 *  2. Google refuse de valider un client OAuth dont la page d'accueil est
 *     derrière un écran de connexion — « modifiez votre page d'accueil pour
 *     permettre aux utilisateurs de consulter des informations sur votre
 *     application sans avoir à se connecter ».
 *
 * D'où la section sur l'agenda : c'est exactement ce que le validateur cherche,
 * et ce qu'un client demandera de toute façon.
 */
export default async function HomePage() {
  const brand = await getHostBranding();

  return (
    <div className="flex flex-col gap-14">
      <section className="flex flex-col items-start gap-5">
        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium">
          CRM de relance
        </span>

        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Aucune relance oubliée, aucun devis en suspens.
        </h1>

        <p className="max-w-xl text-base text-muted-foreground text-pretty">
          {brand.brandName} regroupe tes clients, tes opportunités et tes
          relances au même endroit — et pose chaque relance dans ton agenda pour
          qu&apos;elle arrive au bon moment, sans que tu aies à y penser.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Ouvrir mon espace
            <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
          </Link>
          <Link
            href="/confidentialite"
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Comment les données sont traitées
          </Link>
        </div>
      </section>

      <section className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
        <Feature
          icon={KanbanSquare}
          title="Un pipeline qui te ressemble"
          body="Tes étapes, tes intitulés, tes champs. Fais glisser une opportunité d'une colonne à l'autre : tout le monde voit où en est l'affaire."
        />
        <Feature
          icon={CalendarClock}
          title="Les relances dans ton agenda"
          body="Chaque relance devient un événement de ton calendrier. Tu la déplaces, la coches ou la reportes depuis le CRM, l'agenda suit."
        />
        <Feature
          icon={Zap}
          title="Des automatisations lisibles"
          body="« Quand une opportunité passe en Devis envoyé, crée une relance à 7 jours. » Des règles écrites en français, pas un langage de programmation."
        />
        <Feature
          icon={ShieldCheck}
          title="Tes données restent tiennes"
          body="Hébergement dans l'Union européenne, cloisonnement par espace, export complet en un clic. Ni revente, ni entraînement de modèle."
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">
          Ce que {brand.brandName} fait de ton agenda
        </h2>
        <p className="text-sm text-muted-foreground">
          Connecter ton calendrier est facultatif. Si tu le fais,{" "}
          {brand.brandName} demande une seule autorisation :{" "}
          <strong className="font-medium text-foreground">
            gérer les événements
          </strong>{" "}
          de ton agenda. Elle sert uniquement à créer, déplacer et supprimer les
          événements correspondant à tes relances.
        </p>
        <p className="text-sm text-muted-foreground">
          {brand.brandName} ne lit pas tes autres rendez-vous, n&apos;en garde
          aucune copie, et n&apos;accède ni à tes e-mails ni à tes contacts Google.
          Tu peux couper l&apos;accès à tout moment, depuis l&apos;application ou depuis
          ton compte Google. Le détail est dans les{" "}
          <Link href="/confidentialite" className="underline underline-offset-2">
            règles de confidentialité
          </Link>
          .
        </p>
      </section>

      <section className="flex flex-col items-start gap-3 border-t pt-8">
        <h2 className="text-lg font-semibold tracking-tight">
          Prêt à reprendre la main sur tes relances ?
        </h2>
        <p className="text-sm text-muted-foreground">
          Connexion par e-mail ou par compte Google. Rien à installer.
        </p>
        <Link
          href="/login"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Commencer
          <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
        </Link>
      </section>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Icon className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground text-pretty">{body}</p>
    </div>
  );
}
