import Link from "next/link";
import { brandStyle, getHostBranding } from "@/lib/host-branding";

/**
 * Coquille des pages publiques : accueil, confidentialité, conditions.
 *
 * Accessibles sans compte. Un prospect doit pouvoir juger le produit avant de
 * s'inscrire, et Google exige une page d'accueil et des règles de
 * confidentialité atteignables pour valider un client OAuth.
 *
 * Aux couleurs de l'espace, comme l'écran de connexion : un client en marque
 * blanche montre la sienne, pas la nôtre.
 */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const brand = await getHostBranding();

  return (
    <div style={brandStyle(brand)} className="flex min-h-full flex-1 flex-col bg-surface">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-6">
          <Link href="/" className="flex items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.brandName}
                className="h-7 max-w-32 object-contain"
              />
            ) : (
              <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-semibold text-primary-foreground">
                {brand.brandName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-sm font-semibold">{brand.brandName}</span>
          </Link>

          <Link
            href="/login"
            className="ml-auto rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Se connecter
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>

      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-6 py-4 text-sm text-muted-foreground">
          <span>{brand.brandName}</span>
          <Link href="/confidentialite" className="hover:underline">
            Confidentialité
          </Link>
          <Link href="/conditions" className="hover:underline">
            Conditions d&apos;utilisation
          </Link>
          <a
            href="mailto:samuelbiancola@gmail.com"
            className="ml-auto hover:underline"
          >
            Nous contacter
          </a>
        </div>
      </footer>
    </div>
  );
}
