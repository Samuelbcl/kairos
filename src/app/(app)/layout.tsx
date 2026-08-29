import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { ThemeProvider } from "@/components/shell/theme-provider";
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
      <div className="flex min-h-full flex-1">
        <Sidebar
          workspaces={options}
          currentId={workspace?.id ?? ""}
          isPlatformAdmin={isPlatformAdmin === true}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar brandName={brandName} email={user.email ?? ""} name={name} />
          {/* Pas d'overflow ici : un enfant flex a min-height:auto, donc il
              grandirait au lieu de defiler. La page defile, la sidebar colle. */}
          <main className="flex-1 bg-surface p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
