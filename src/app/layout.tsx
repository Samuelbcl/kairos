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
    ...(brand.faviconUrl ? { icons: { icon: brand.faviconUrl } } : {}),
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
