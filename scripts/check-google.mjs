/**
 * Vérifie la configuration Google, des deux côtés.
 *
 *   npm run check:google
 *
 * Deux intégrations distinctes se cachent derrière « Google », et elles se
 * configurent à des endroits différents :
 *   1. le bouton « Continuer avec Google » — géré par Supabase ;
 *   2. la synchronisation de l'agenda — gérée par notre propre code.
 *
 * Ce script dit laquelle des deux est prête, et ce qui manque à l'autre.
 * Il ne remplace pas un essai réel, mais il attrape tout ce qui se détecte
 * sans ouvrir un navigateur.
 */
import { readFileSync } from "node:fs";

function loadEnv(path = ".env.local") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const env = loadEnv();
const ref = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(
  /https:\/\/([a-z0-9]+)\.supabase\.co/,
)?.[1];

const results = [];
const todo = [];

function check(label, ok, detail = "") {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? "OK   " : "MANQUE"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

// --- 1. Ce qui est dans .env.local -----------------------------------------
console.log("\n1. Variables locales");

const clientId = env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = env.GOOGLE_CLIENT_SECRET ?? "";

const idLooksRight = clientId.endsWith(".apps.googleusercontent.com");
check(
  "GOOGLE_CLIENT_ID au bon format",
  idLooksRight,
  clientId
    ? idLooksRight
      ? clientId.slice(0, 24) + "…"
      : "doit finir par .apps.googleusercontent.com"
    : "vide",
);
if (!idLooksRight) todo.push("Colle le Client ID dans .env.local (Google Cloud → Identifiants).");

// Google émet des secrets en GOCSPX- depuis 2022 ; les plus anciens n'ont pas
// de préfixe, on se contente donc d'un avertissement.
const secretPresent = clientSecret.length > 0;
check(
  "GOOGLE_CLIENT_SECRET renseigné",
  secretPresent,
  secretPresent
    ? clientSecret.startsWith("GOCSPX-")
      ? "format attendu"
      : "présent, mais ne commence pas par GOCSPX- — vérifie que c'est bien le secret"
    : "vide : la synchronisation agenda ne marchera pas",
);
if (!secretPresent) {
  todo.push("Colle le Client Secret dans .env.local (le même que dans Supabase).");
}

const appUrl = env.NEXT_PUBLIC_APP_URL ?? "";
check("NEXT_PUBLIC_APP_URL défini", Boolean(appUrl), appUrl || "vide");

// --- 2. Ce que Supabase a enregistré ---------------------------------------
console.log("\n2. Connexion Google (Supabase)");

let authConfig = null;
if (!ref || !env.SUPABASE_ACCESS_TOKEN) {
  check("configuration Supabase lisible", false, "SUPABASE_ACCESS_TOKEN manquant");
} else {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/config/auth`,
    { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } },
  );

  if (!response.ok) {
    check("configuration Supabase lisible", false, `HTTP ${response.status}`);
  } else {
    authConfig = await response.json();

    check("fournisseur Google activé", authConfig.external_google_enabled === true);

    const sameId = authConfig.external_google_client_id === clientId;
    check(
      "même Client ID des deux côtés",
      sameId || !clientId,
      sameId ? "" : "Supabase et .env.local ne portent pas le même identifiant",
    );
    if (clientId && !sameId) {
      todo.push("Aligne le Client ID entre Supabase et .env.local.");
    }

    check("secret enregistré dans Supabase", Boolean(authConfig.external_google_secret));

    const list = (authConfig.uri_allow_list ?? "").split(",").filter(Boolean);
    const hasWildcard = list.some((u) => u.trim().endsWith("/**"));
    check(
      "Redirect URLs avec motif générique",
      hasWildcard,
      list.length ? list.join("  ") : "vide",
    );
    if (!hasWildcard) {
      todo.push(
        "Ajoute https://ton-domaine/** dans Authentication → URL Configuration.",
      );
    }
  }
}

// --- 3. Le client existe-t-il vraiment chez Google ? ------------------------
console.log("\n3. Client OAuth chez Google");

if (!idLooksRight) {
  check("client reconnu par Google", false, "Client ID absent ou mal formé");
} else {
  // On appelle l'écran de consentement sans suivre la redirection : Google
  // répond par une erreur explicite si le client ou l'URI est inconnu.
  const redirect = `${appUrl.replace(/\/$/, "")}/api/integrations/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
  });

  try {
    const response = await fetch(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      { redirect: "manual" },
    );
    const body = response.status < 400 ? "" : await response.text();

    const unknownClient = /invalid_client|OAuth client was not found/i.test(body);
    const badRedirect = /redirect_uri_mismatch/i.test(body);

    check(
      "client reconnu par Google",
      !unknownClient,
      unknownClient ? "Google ne connaît pas ce Client ID" : "",
    );
    check(
      `URI de redirection déclarée (${redirect})`,
      !badRedirect,
      badRedirect ? "à ajouter dans Google Cloud → Identifiants → ton client" : "",
    );
    if (badRedirect) {
      todo.push(`Ajoute ${redirect} aux URI de redirection autorisés.`);
    }
  } catch (error) {
    check("client reconnu par Google", false, `appel impossible : ${error.message}`);
  }
}

// --- Rapport ----------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications passées.`);

if (todo.length) {
  console.log("\nÀ faire :");
  for (const item of todo) console.log(`  - ${item}`);
}

console.log(
  "\nCe qui ne se vérifie pas d'ici : que l'API Google Calendar soit activée " +
    "(Google Cloud → Bibliothèque), et que ton compte figure parmi les " +
    "utilisateurs de test si l'écran de consentement est encore en mode Test.",
);

process.exitCode = failed.length ? 1 : 0;
