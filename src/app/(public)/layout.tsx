import Link from "next/link";
import { getHostBranding } from "@/lib/host-branding";

/**
 * Pages publiques : confidentialité et conditions.
 *
 * Accessibles sans compte — Google exige une politique de confidentialité
 * atteignable pour autoriser un client OAuth, et un client qui évalue le
 * produit doit pouvoir les lire avant de s'inscrire.
 */
export default async function PublicLayout({ children }: LayoutProps<"/"> ) {
  const brand = await getHostBranding();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-6">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-semibold text-primary-foreground">
            {brand.brandName.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-sm font-semibold">{brand.brandName}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>

      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-6 py-4 text-sm text-muted-foreground">
          <Link href="/confidentialite" className="hover:underline">
            Confidentialité
          </Link>
          <Link href="/conditions" className="hover:underline">
            Conditions d&apos;utilisation
          </Link>
          <Link href="/login" className="ml-auto hover:underline">
            Se connecter
          </Link>
        </div>
      </footer>
    </div>
  );
}
