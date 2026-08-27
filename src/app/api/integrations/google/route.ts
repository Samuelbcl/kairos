import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { encodeState } from "@/lib/oauth-state";
import { googleAuthUrl, googleConfigured } from "@/lib/integrations/google";
import { env } from "@/lib/env";

/** Démarre la connexion Google Agenda : state signé puis écran de consentement. */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(`${env.appUrl}/login?next=/settings/integrations`);
  }

  if (!googleConfigured()) {
    return NextResponse.redirect(
      `${env.appUrl}/settings/integrations?error=google_not_configured`,
    );
  }

  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return NextResponse.redirect(`${env.appUrl}/settings/integrations?error=no_workspace`);
  }

  const state = encodeState({ workspaceId: workspace.id, userId: user.id });
  return NextResponse.redirect(googleAuthUrl(state));
}
