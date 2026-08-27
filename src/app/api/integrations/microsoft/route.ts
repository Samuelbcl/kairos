import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { encodeState } from "@/lib/oauth-state";
import { microsoftAuthUrl, microsoftConfigured } from "@/lib/integrations/microsoft";
import { env } from "@/lib/env";

/** Démarre la connexion Outlook / Microsoft 365. */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(`${env.appUrl}/login?next=/settings/integrations`);
  }

  if (!microsoftConfigured()) {
    return NextResponse.redirect(
      `${env.appUrl}/settings/integrations?error=microsoft_not_configured`,
    );
  }

  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return NextResponse.redirect(`${env.appUrl}/settings/integrations?error=no_workspace`);
  }

  const state = encodeState({ workspaceId: workspace.id, userId: user.id });
  return NextResponse.redirect(microsoftAuthUrl(state));
}
