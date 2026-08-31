import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { ProductTour } from "@/components/tour/product-tour";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient, getUser } from "@/lib/supabase/server";
import {
  displayName,
  getCurrentWorkspace,
  getWorkspaces,
} from "@/lib/workspace";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured) redirect("/setup");

  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [workspace, workspaces, { data: isPlatformAdmin }] = await Promise.all([
    getCurrentWorkspace(),
    getWorkspaces(),
    supabase.rpc("is_platform_admin"),
  ]);

  // Visite guidée : lancée d'elle-même tant qu'elle n'a pas été suivie
  // ou explicitement passée.
  const { data: profile } = await supabase
    .from("profiles")
    .select("tour_step, tour_completed_at")
    .eq("id", user.id)
    .single();
  const brandName = displayName(workspace);
  const options = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    brandName: displayName(w),
  }));
  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Compte";

  return (
    <ThemeProvider branding={workspace?.branding ?? {}}>
      {/* Coquille a hauteur d'ecran : le menu reste en place, seul le contenu
          defile. C'est ce qui permet au kanban de garder sa barre de defilement
          horizontale a l'ecran au lieu de la repousser sous le pli. */}
      <div className="flex h-dvh">
        <Sidebar
          workspaces={options}
          currentId={workspace?.id ?? ""}
          isPlatformAdmin={isPlatformAdmin === true}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar brandName={brandName} email={user.email ?? ""} name={name} />
          {/* min-h-0 est indispensable : sans lui cet enfant flex garde
              min-height:auto, grandit au lieu de defiler, et la page entiere
              perd sa barre de defilement.

              Volontairement un bloc et non un conteneur flex : en flex, tout
              wrapper de tableau (qui porte un overflow, donc une taille
              minimale nulle) se ferait ecraser a la hauteur de l'ecran et
              defilerait dans sa propre boite au lieu de laisser la page
              descendre. */}
          <main className="min-h-0 flex-1 overflow-y-auto bg-surface p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>

      <ProductTour
        initialStep={profile?.tour_step ?? 0}
        autoStart={!profile?.tour_completed_at}
      />
    </ThemeProvider>
  );
}
