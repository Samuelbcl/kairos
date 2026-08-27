import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeState } from "@/lib/oauth-state";
import { encrypt } from "@/lib/crypto";
import {
  emailFromIdToken,
  exchangeCode,
  GOOGLE_SCOPES,
} from "@/lib/integrations/google";
import { env } from "@/lib/env";

const SETTINGS = "/settings/integrations";

/**
 * Retour de Google. Vérifie le state signé, échange le code, chiffre les jetons.
 *
 * L'écriture passe par le client service_role : la table integrations n'est
 * jamais manipulée avec la session du navigateur. L'autorisation vient du state
 * signé, recoupé avec l'utilisateur réellement connecté.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    // L'utilisateur a refusé : ce n'est pas une panne.
    return NextResponse.redirect(`${env.appUrl}${SETTINGS}?error=refused`);
  }

  const state = decodeState(searchParams.get("state"));
  if (!state || !code) {
    return NextResponse.redirect(`${env.appUrl}${SETTINGS}?error=state`);
  }

  // Le state prouve l'origine ; on vérifie en plus que c'est bien la même session.
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
        provider: "google",
        account_email: emailFromIdToken(tokens.id_token),
        access_token_enc: encrypt(tokens.access_token),
        // Google ne renvoie le refresh_token qu'au premier consentement.
        ...(tokens.refresh_token
          ? { refresh_token_enc: encrypt(tokens.refresh_token) }
          : {}),
        scopes: tokens.scope?.split(" ") ?? GOOGLE_SCOPES,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        calendar_id: "primary",
      },
      { onConflict: "workspace_id,user_id,provider" },
    );

    if (error) {
      console.error("[google/callback] enregistrement impossible", error.message);
      return NextResponse.redirect(`${env.appUrl}${SETTINGS}?error=save`);
    }

    return NextResponse.redirect(`${env.appUrl}${SETTINGS}?connected=google`);
  } catch (error) {
    // Ne jamais logger la réponse brute : elle contient les jetons.
    console.error(
      "[google/callback] échange impossible",
      error instanceof Error ? error.message : "erreur inconnue",
    );
    return NextResponse.redirect(`${env.appUrl}${SETTINGS}?error=exchange`);
  }
}
