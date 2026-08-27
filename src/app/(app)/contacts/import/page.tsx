import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { CsvImport } from "@/components/contacts/csv-import";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Importer un CSV" };

export default async function ImportPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createClient();

  const { data: stages } = workspace
    ? await supabase
        .from("stages")
        .select("id, name")
        .eq("workspace_id", workspace.id)
        .order("position")
    : { data: [] };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link
        href="/contacts"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
        Contacts
      </Link>

      <PageHeader
        title="Importer un CSV"
        description="Reprends ton tableur existant. Les doublons sont détectés, rien n'est écrasé."
      />

      <CsvImport stages={stages ?? []} />
    </div>
  );
}
