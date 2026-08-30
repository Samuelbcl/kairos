/**
 * Montre l'URL exacte que l'application envoie à Google, en production.
 *
 *   npm run check:oauth                          (local)
 *   npm run check:oauth -- https://mon-domaine   (prod)
 *
 * Google répond « 400 invalid_request » sans jamais dire quel paramètre le
 * gêne. Comme l'URL est construite côté serveur, derrière une session, on ne
 * peut pas la lire depuis un navigateur sans être connecté : ce script ouvre
 * une session jetable, demande la redirection sans la suivre, et découpe
 * l'URL obtenue paramètre par paramètre.
 *
 * Le compte de test est supprimé à la fin, même en cas d'erreur.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path = ".env.local") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const env = loadEnv();
const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];

const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function sessionCookies(session) {
  const name = `sb-${projectRef}-auth-token`;
  const encoded = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  if (encoded.length <= 3180) return [`${name}=${encoded}`];
  const chunks = [];
  for (let i = 0; i < encoded.length; i += 3180) {
    chunks.push(`${name}.${chunks.length}=${encoded.slice(i, i + 3180)}`);
  }
  return chunks;
}

const stamp = Date.now();
const account = { email: `kairos-oauth-${stamp}@example.com`, password: `Oauth-${stamp}!` };
let userId = null;
let workspaceId = null;

console.log(`\nCible : ${baseUrl}`);

try {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: "Inspection OAuth" },
  });
  if (error) throw new Error(`création du compte : ${error.message}`);
  userId = created.user.id;

  const { data: membership } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .single();
  workspaceId = membership?.workspace_id;

  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword(account);
  if (signInError) throw new Error(`connexion : ${signInError.message}`);

  const response = await fetch(`${baseUrl}/api/integrations/google`, {
    headers: { cookie: sessionCookies(signIn.session).join("; ") },
    redirect: "manual",
  });

  const location = response.headers.get("location");
  console.log(`\nHTTP ${response.status}`);

  if (!location) {
    console.log("Aucune redirection : l'application n'a pas produit d'URL Google.");
    console.log("Vérifie GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET sur l'hébergeur.");
    process.exitCode = 1;
  } else if (!location.startsWith("https://accounts.google.com/")) {
    console.log(`\nRedirection interne, pas vers Google :\n  ${location}`);
    console.log("\nLe paramètre `error` de cette URL dit ce qui manque.");
    process.exitCode = 1;
  } else {
    const target = new URL(location);
    console.log(`\nURL envoyée à Google\n  ${target.origin}${target.pathname}\n`);

    for (const [key, value] of target.searchParams) {
      const shown =
        key === "state" ? `${value.slice(0, 24)}… (${value.length} caractères)` : value;
      console.log(`  ${key.padEnd(22)} ${shown}`);
    }

    // Le motif d'invalid_request le plus fréquent : une redirect_uri qui n'est
    // pas une URL propre, parce que NEXT_PUBLIC_APP_URL contient un chemin.
    const redirectUri = target.searchParams.get("redirect_uri") ?? "";
    const expected = `${baseUrl}/api/integrations/google/callback`;
    console.log("");

    if (redirectUri !== expected) {
      console.log(`  PROBLEME  redirect_uri inattendue`);
      console.log(`            obtenue : ${redirectUri}`);
      console.log(`            attendue : ${expected}`);
      console.log(
        `\n  NEXT_PUBLIC_APP_URL doit valoir exactement ${baseUrl} sur l'hébergeur,\n` +
          `  sans chemin, sans paramètre, sans barre oblique finale.`,
      );
      process.exitCode = 1;
    } else {
      console.log("  OK  redirect_uri bien formée.");
      console.log("      Si Google refuse encore, la cause est dans sa console,");
      console.log("      pas dans l'URL : ouvre « détails de l'erreur » sur son écran.");
    }
  }
} catch (error) {
  console.error(`\nInterrompu : ${error.message}`);
  process.exitCode = 1;
} finally {
  if (workspaceId) await admin.from("workspaces").delete().eq("id", workspaceId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("\nCompte d'inspection supprimé.");
}
