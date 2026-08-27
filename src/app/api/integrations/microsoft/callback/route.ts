import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeState } from "@/lib/oauth-state";
import { encrypt } from "@/lib/crypto";
import {
  emailFromIdToken,
  exchangeCode,
  MICROSOFT_SCOPES,
} from "@/lib/integrations/microsoft";
import { env } from "@/lib/env";

const SETTINGS = "/settings/integrations";

/** Retour de Microsoft Entra. Même contrat que le callback Google. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${env.appUrl}${SETTINGS}?error=refused`);
  }

  const state = decodeState(searchParams.get("state"));
  if (!state || !code) {
    return NextResponse.redirect(`${env.appUrl}${SETTINGS}?error=state`);
  }

  const user = await getUser();
  if (!user || user.id !== state.userId) {
    return NextResponse.redirect(`${env.appUrl}${SETTINGS}?error=session`);
  }

  try {
    const tokens = await exchangeCode(code);
    const admin = createAdminClient();

    const { error } = await admin.from("integrations").upsert(
      {
        workspace_id: state.workspaceId,
        user_id: state.userId,
        provider: "microsoft",
        account_email: emailFromIdToken(tokens.id_token),
        access_token_enc: encrypt(tokens.access_token),
        ...(tokens.refresh_token
          ? { refresh_token_enc: encrypt(tokens.refresh_token) }
          : {}),
        scopes: tokens.scope?.split(" ") ?? MICROSOFT_SCOPES,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        calendar_id: "primary",
      },
      { onConflict: "workspace_id,user_id,provider" },
    );

    if (error) {
      console.error("[microsoft/callback] enregistrement impossible", error.message);
      return NextResponse.redirect(`${env.appUrl}${SETTINGS}?error=save`);
    }

    return NextResponse.redirect(`${env.appUrl}${SETTINGS}?connected=microsoft`);
  } catch (error) {
    console.error(
      "[microsoft/callback] échange impossible",
      error instanceof Error ? error.message : "erreur inconnue",
    );
    return NextResponse.redirect(`${env.appUrl}${SETTINGS}?error=exchange`);
  }
}
