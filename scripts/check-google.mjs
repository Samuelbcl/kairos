/**
 * Vérifie la configuration Google, des deux côtés.
 *
 *   npm run check:google
 *   npm run check:google -- https://mon-domaine.app   (teste la prod)
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

/**
 * NEXT_PUBLIC_APP_URL doit être une origine nue — schéma + domaine, rien
 * d'autre. Toutes les URI de redirection OAuth et tous les liens des e-mails
 * sont construits par concaténation dessus : un chemin ou une query collés
 * depuis la barre d'adresse du navigateur les casse tous en silence.
 */
// Un argument permet de viser la prod depuis la machine locale : les pages
// publiques doivent être atteignables là où Google ira les chercher.
const appUrl = (process.argv[2] ?? env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
check("NEXT_PUBLIC_APP_URL défini", Boolean(appUrl), appUrl || "vide");

let appOrigin = "";
if (appUrl) {
  let parsed = null;
  try {
    parsed = new URL(appUrl);
  } catch {
    /* url invalide : signalée juste en dessous */
  }

  const bare = Boolean(parsed) && parsed.pathname === "/" && !parsed.search && !parsed.hash;
  appOrigin = parsed ? parsed.origin : "";

  check(
    "NEXT_PUBLIC_APP_URL est une origine nue",
    bare,
    bare
      ? ""
      : parsed
        ? `contient « ${parsed.pathname}${parsed.search} » — attendu : ${parsed.origin}`
        : "URL illisible",
  );

  if (!bare && parsed) {
    todo.push(
      `Remplace NEXT_PUBLIC_APP_URL par ${parsed.origin} (sans chemin ni paramètre), ` +
        "dans .env.local et sur Vercel.",
    );
  }
}

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
  const redirect = `${appOrigin}/api/integrations/google/callback`;

  try {
    const reason = await probeRedirectUri(clientId, redirect);

    check(
      "client reconnu par Google",
      reason !== "invalid_client",
      reason === "invalid_client" ? "Google ne connaît pas ce Client ID" : "",
    );

    const declared = reason === null;
    check(
      `URI de redirection déclarée (${redirect})`,
      declared,
      declared ? "" : reason ?? "",
    );
    if (reason === "redirect_uri_mismatch") {
      todo.push(
        `Ajoute ${redirect} aux URI de redirection autorisés : Google Cloud → ` +
          `API et services → Identifiants → ton ID client OAuth → « URI de ` +
          `redirection autorisés » (pas « Origines JavaScript autorisées »).`,
      );
    }
  } catch (error) {
    check("client reconnu par Google", false, `appel impossible : ${error.message}`);
  }
}

/**
 * Demande l'écran de consentement sans le suivre, et rend la raison du refus.
 * `null` si Google accepte l'URI.
 *
 * Google ne répond pas en erreur HTTP : il redirige (302) vers sa page
 * d'erreur, et range le motif réel dans le paramètre `authError`, encodé en
 * base64. Une version antérieure de ce script ne lisait le corps qu'au-delà de
 * 400 : elle annonçait « URI déclarée » sur un client où elle ne l'était pas.
 * Une vérification qui ne sait pas échouer ne vérifie rien.
 */
async function probeRedirectUri(clientId, redirect) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
  });

  const response = await fetch(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    { redirect: "manual" },
  );

  const location = response.headers.get("location") ?? "";
  const encoded = /[?&]authError=([^&]+)/.exec(location)?.[1];
  if (!encoded) return null;

  // Le motif est en tête du message, suivi d'une explication localisée dont la
  // langue dépend du serveur Google qui répond : on ne garde que le motif.
  const decoded = Buffer.from(decodeURIComponent(encoded), "base64url").toString("utf8");
  return /(redirect_uri_mismatch|invalid_client|invalid_request|access_denied|org_internal|admin_policy_enforced)/.exec(
    decoded,
  )?.[1] ?? "refus non identifié par Google";
}

// --- Pages publiques exigées par la validation du branding ------------------
// Google refuse un client dont la page d'accueil est derrière une connexion,
// et demande une politique de confidentialité atteignable. On teste sans
// cookie, exactement comme son validateur.
if (appOrigin) {
  console.log("\nPages publiques");

  // On exige un marqueur de contenu, pas seulement un 200 : une redirection
  // vers /login répond 200 elle aussi, et passerait pour une réussite.
  for (const [path, label, marker] of [
    ["/", "page d'accueil lisible sans compte", "Aucune relance oubliée"],
    ["/confidentialite", "règles de confidentialité publiques", "Règles de confidentialité"],
    ["/conditions", "conditions d'utilisation publiques", "Conditions d'utilisation"],
  ]) {
    const target = `${appOrigin}${path}`;
    try {
      const response = await fetch(target, { redirect: "manual" });
      const body = response.status === 200 ? await response.text() : "";
      const served = response.status === 200 && body.includes(marker);
      const redirected = response.status >= 300 && response.status < 400;

      check(
        label,
        served,
        redirected
          ? `redirige vers ${response.headers.get("location") ?? "ailleurs"}`
          : response.status !== 200
            ? `HTTP ${response.status}`
            : served
              ? ""
              : `page servie, mais « ${marker} » absent`,
      );

      if (!served) {
        todo.push(`${target} doit répondre 200 sans être connecté.`);
      }
    } catch (error) {
      check(label, false, `injoignable : ${error.message}`);
    }
  }

  check(
    "propriété du domaine vérifiable",
    Boolean(env.GOOGLE_SITE_VERIFICATION),
    env.GOOGLE_SITE_VERIFICATION
      ? ""
      : "GOOGLE_SITE_VERIFICATION absent — requis pour faire valider le branding",
  );
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
