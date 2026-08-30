import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getHostBranding } from "@/lib/host-branding";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Titre et icône d'onglet viennent du branding de l'espace résolu par nom
 * d'hôte : un client en marque blanche ne doit pas voir « Kairos » dans son
 * onglet. Sans domaine dédié, on retombe sur nos valeurs par défaut.
 */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getHostBranding();

  return {
    title: {
      default: brand.brandName,
      template: `%s · ${brand.brandName}`,
    },
    description:
      "Le CRM qui te rappelle tes relances au bon moment, connecté à ton agenda.",
    // Toujours passer par `icons`, jamais par un fichier dans app/ :
    // Next donne la priorité au fichier physique et ignorerait ce réglage,
    // ce qui rendait l'icône d'onglet d'un espace sans effet.
    icons: { icon: brand.faviconUrl ?? "/favicon.ico" },
    // Search Console : preuve de propriété du domaine, exigée par Google pour
    // valider un client OAuth. Vide tant que la variable n'est pas posée —
    // Next omet alors la balise au lieu d'en écrire une vide.
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
