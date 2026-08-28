import { PageHeader } from "@/components/shell/page-header";
import { ApiKeysPanel } from "@/components/settings/api-keys-panel";
import { WebhooksPanel } from "@/components/settings/webhooks-panel";
import { ApiReference } from "@/components/settings/api-reference";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { env } from "@/lib/env";
import type { WebhookEvent } from "@/lib/webhooks";

export const metadata = { title: "API & webhooks" };

export default async function ApiSettingsPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createClient();

  const [{ data: keys }, { data: hooks }] = workspace
    ? await Promise.all([
        supabase
          .from("api_keys")
          .select("id, name, prefix, last_used_at, created_at")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("webhooks")
          .select("id, url, events, enabled, created_at")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const canManage = workspace ? workspace.role !== "member" : false;

  return (
    <>
      <PageHeader
        title="API & webhooks"
        description="Branche Kairos sur n'importe quelle app — Make, Zapier, n8n, ou ton propre code."
      />

      <div className="flex flex-col gap-6">
        <ApiKeysPanel keys={keys ?? []} canManage={canManage} />

        <WebhooksPanel
          hooks={(hooks ?? []).map((hook) => ({
            ...hook,
            events: hook.events as WebhookEvent[],
          }))}
          canManage={canManage}
        />

        <ApiReference baseUrl={env.appUrl} />
      </div>
    </>
  );
}
