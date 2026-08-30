/**
 * Test de bout en bout : crée un compte jetable, remplit son espace, puis
 * parcourt chaque page de l'app avec une vraie session authentifiée.
 *
 *   npm run test:smoke            (le serveur dev doit tourner)
 *   BASE_URL=... npm run test:smoke
 *
 * Vérifie le code HTTP, l'absence de page d'erreur Next, et la présence d'un
 * marqueur de contenu attendu. Nettoie tout à la fin, même en cas d'échec.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path = ".env.local") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) continue;
    env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const env = loadEnv();
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
function check(label, passed, detail = "") {
  results.push({ label, passed, detail });
  console.log(`  ${passed ? "OK   " : "ÉCHEC"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

/**
 * Reproduit le cookie de session écrit par @supabase/ssr : JSON de la session,
 * encodé en base64url avec le préfixe `base64-`, découpé en morceaux de
 * 3180 caractères au-delà de la limite d'un cookie.
 */
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
const account = {
  email: `kairos-smoke-${stamp}@example.com`,
  password: `Smoke-${stamp}!`,
};

let userId = null;
let workspaceId = null;

try {
  // --- 1. Compte et espace --------------------------------------------------
  console.log("\n1. Compte de test");
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: "Smoke Test" },
  });
  if (createError) throw new Error(`création du compte : ${createError.message}`);
  userId = created.user.id;

  const { data: membership } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .single();
  workspaceId = membership?.workspace_id;
  check("compte et espace créés", Boolean(workspaceId));

  // --- 2. Données de démonstration -----------------------------------------
  console.log("\n2. Jeu de données");
  const { data: stages } = await admin
    .from("stages")
    .select("id, name, pipeline_id")
    .eq("workspace_id", workspaceId)
    .order("position");

  const { data: company } = await admin
    .from("companies")
    .insert({
      workspace_id: workspaceId,
      name: "Menuiserie Dupont",
      email: "info@menuiserie-dupont.be",
      sector: "Menuiserie",
      city: "Liège",
      tags: ["prospect"],
    })
    .select("id")
    .single();

  const { data: contact } = await admin
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      company_id: company.id,
      first_name: "Marc",
      last_name: "Dupont",
      email: "marc@menuiserie-dupont.be",
      role_title: "Gérant",
    })
    .select("id")
    .single();

  const { data: deal } = await admin
    .from("deals")
    .insert({
      workspace_id: workspaceId,
      pipeline_id: stages[0].pipeline_id,
      stage_id: stages[1].id,
      company_id: company.id,
      title: "Site vitrine Menuiserie Dupont",
      value: 3500,
      priority: "high",
      last_activity_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    })
    .select("id")
    .single();

  await admin.from("tasks").insert([
    {
      workspace_id: workspaceId,
      title: "Relancer Menuiserie Dupont",
      due_at: new Date(Date.now() - 86_400_000).toISOString(),
      company_id: company.id,
      deal_id: deal.id,
      priority: "high",
    },
    {
      workspace_id: workspaceId,
      title: "Envoyer le devis",
      due_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      company_id: company.id,
    },
  ]);

  await admin.from("activities").insert({
    workspace_id: workspaceId,
    subject_type: "company",
    subject_id: company.id,
    type: "note",
    content: "Premier contact par e-mail, en attente de réponse.",
  });

  await admin.from("tags").insert({ workspace_id: workspaceId, name: "prospect" });

  check("entreprise, contact, opportunité, relances et note créés", true);

  // --- 3. Session authentifiée ---------------------------------------------
  console.log("\n3. Session");
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword(account);
  if (signInError) throw new Error(`connexion : ${signInError.message}`);

  const cookie = sessionCookies(signIn.session).join("; ");
  check("session obtenue", Boolean(signIn.session?.access_token));

  // --- 4. Parcours des pages -----------------------------------------------
  console.log("\n4. Pages");
  const pages = [
    ["/", "Tableau de bord"],
    ["/today", "Aujourd'hui"],
    ["/pipeline", "Menuiserie Dupont"],
    ["/contacts", "Menuiserie Dupont"],
    ["/contacts?tab=people", "Dupont"],
    ["/contacts/import", "Importer un CSV"],
    [`/companies/${company.id}`, "Menuiserie Dupont"],
    [`/contacts/${contact.id}`, "Marc"],
    ["/automations", "Automatisations"],
    ["/settings/workspace", "Réglages"],
    ["/settings/members", "Membres"],
    ["/settings/integrations", "Intégrations"],
    ["/settings/api", "Clés API"],
    ["/settings/emails", "Modèles"],
    ["/calendar", "Calendrier"],
    ["/settings/trash", "Corbeille"],
  ];

  // Sans cookie : Google doit pouvoir atteindre ces pages, et un prospect aussi.
  for (const [path, marker] of [
    ["/", "Aucune relance oubliée"],
    ["/confidentialite", "Règles de confidentialité"],
    ["/conditions", "Conditions d'utilisation"],
  ]) {
    const response = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
    const body = await response.text();
    check(
      `GET ${path} sans compte`,
      response.status === 200 && body.includes(marker),
      response.status !== 200 ? `HTTP ${response.status}` : "",
    );
  }

  for (const [path, marker] of pages) {
    let status = 0;
    let body = "";
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: { cookie },
        redirect: "manual",
      });
      status = response.status;
      body = await response.text();
    } catch (error) {
      check(`GET ${path}`, false, error.message);
      continue;
    }

    const serverError =
      body.includes("Application error") ||
      body.includes("__next_error__") ||
      body.includes("Internal Server Error");
    const hasMarker = body.includes(marker);

    check(
      `GET ${path}`,
      status === 200 && !serverError && hasMarker,
      status !== 200
        ? `HTTP ${status}`
        : serverError
          ? "page d'erreur Next"
          : hasMarker
            ? ""
            : `contenu « ${marker} » absent`,
    );
  }
} catch (error) {
  console.error(`\nInterrompu : ${error.message}`);
  process.exitCode = 1;
} finally {
  console.log("\n5. Nettoyage");
  if (workspaceId) await admin.from("workspaces").delete().eq("id", workspaceId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("  compte et espace de test supprimés.");

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications passées.`);
  if (failed.length) {
    console.log("\nÉchecs :");
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`);
    process.exitCode = 1;
  }
}
