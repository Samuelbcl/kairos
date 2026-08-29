import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatRelative, isStale } from "@/lib/format";

export const metadata = { title: "Console éditeur" };

/**
 * Console de l'éditeur : voir l'état des espaces clients pour pouvoir les
 * dépanner. Volumétrie et dates seulement — jamais le contenu des fiches.
 *
 * L'appartenance à platform_admins s'accorde en SQL, jamais depuis l'app :
 * une page qui permettrait de s'auto-promouvoir n'aurait aucune valeur.
 */
export default async function AdminPage() {
  const user = await getUser();
  if (!user) notFound();

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");

  // Un non-administrateur ne doit pas apprendre que cette page existe.
  if (!isAdmin) notFound();

  const admin = createAdminClient();

  const [
    { data: workspaces },
    { data: companies },
    { data: deals },
    { data: tasks },
    { data: members },
    { data: integrations },
  ] = await Promise.all([
    admin
      .from("workspaces")
      .select("id, name, slug, plan, timezone, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("companies").select("workspace_id").is("deleted_at", null),
    admin.from("deals").select("workspace_id, status").is("deleted_at", null),
    admin.from("tasks").select("workspace_id, done, updated_at"),
    admin.from("workspace_members").select("workspace_id"),
    admin.from("integrations").select("workspace_id, provider"),
  ]);

  function tally<T extends { workspace_id: string }>(rows: T[] | null) {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      map.set(row.workspace_id, (map.get(row.workspace_id) ?? 0) + 1);
    }
    return map;
  }

  const companyCount = tally(companies);
  const dealCount = tally(deals);
  const memberCount = tally(members);
  const integrationCount = tally(integrations);
  const openTaskCount = tally((tasks ?? []).filter((task) => !task.done));

  // Dernière activité : le seul signal fiable d'un espace abandonné.
  const lastActivity = new Map<string, string>();
  for (const task of tasks ?? []) {
    const current = lastActivity.get(task.workspace_id);
    if (!current || task.updated_at > current) {
      lastActivity.set(task.workspace_id, task.updated_at);
    }
  }

  await admin.from("admin_access_log").insert({
    admin_id: user.id,
    workspace_id: null,
    action: "Consultation de la liste des espaces",
  });

  if (!workspaces?.length) {
    return (
      <>
        <PageHeader title="Console éditeur" />
        <EmptyState icon={ShieldCheck} title="Aucun espace sur cette instance." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Console éditeur"
        description={`${workspaces.length} espace${workspaces.length > 1 ? "s" : ""} sur cette instance. Volumétrie uniquement — le contenu des fiches reste inaccessible.`}
      />

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Espace</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="hidden sm:table-cell">Membres</TableHead>
              <TableHead>Entreprises</TableHead>
              <TableHead className="hidden md:table-cell">Opportunités</TableHead>
              <TableHead className="hidden md:table-cell">Relances</TableHead>
              <TableHead className="hidden lg:table-cell">Agenda</TableHead>
              <TableHead className="hidden lg:table-cell">Activité</TableHead>
              <TableHead className="hidden xl:table-cell">Créé</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {workspaces.map((workspace) => {
              const last = lastActivity.get(workspace.id);
              const dormant = !last || isStale(last, 30);

              return (
                <TableRow key={workspace.id}>
                  <TableCell>
                    <span className="font-medium">{workspace.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {workspace.slug}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{workspace.plan}</Badge>
                  </TableCell>
                  <TableCell className="tabular hidden sm:table-cell">
                    {memberCount.get(workspace.id) ?? 0}
                  </TableCell>
                  <TableCell className="tabular">
                    {companyCount.get(workspace.id) ?? 0}
                  </TableCell>
                  <TableCell className="tabular hidden md:table-cell">
                    {dealCount.get(workspace.id) ?? 0}
                  </TableCell>
                  <TableCell className="tabular hidden md:table-cell">
                    {openTaskCount.get(workspace.id) ?? 0}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {(integrationCount.get(workspace.id) ?? 0) > 0 ? (
                      <span className="text-xs text-success">connecté</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">non</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">
                    {last ? (
                      <span className={dormant ? "text-warning" : "text-muted-foreground"}>
                        {formatRelative(last)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">jamais</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                    {formatDate(workspace.created_at)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Chaque consultation est inscrite dans le journal d&apos;accès. Cette page
        n&apos;expose aucune donnée de prospection : ni noms d&apos;entreprises, ni
        contacts, ni contenu de fiche.
      </p>
    </>
  );
}
