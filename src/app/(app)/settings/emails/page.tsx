import { PageHeader } from "@/components/shell/page-header";
import {
  EmailTemplatesPanel,
  type EmailTemplate,
} from "@/components/settings/email-templates-panel";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { emailConfigured } from "@/lib/email";

export const metadata = { title: "Modèles d'e-mail" };

export default async function EmailTemplatesPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createClient();

  const { data } = workspace
    ? await supabase
        .from("email_templates")
        .select("id, name, subject, body")
        .eq("workspace_id", workspace.id)
        .order("name")
    : { data: [] };

  const templates: EmailTemplate[] = data ?? [];

  return (
    <>
      <PageHeader
        title="Modèles d'e-mail"
        description="Écris une fois, réutilise depuis une fiche ou une automatisation."
      />
      <EmailTemplatesPanel
        templates={templates}
        emailConfigured={emailConfigured()}
      />
    </>
  );
}
