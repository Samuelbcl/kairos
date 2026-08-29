/**
 * Vérifie l'API REST publique et la protection des routes système.
 *
 *   npm run test:api            (le serveur dev doit tourner)
 *
 * Crée un espace jetable et une clé API, exerce chaque endpoint, vérifie
 * qu'une clé d'un autre espace ne voit rien, puis nettoie tout.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
function check(label, passed, detail = "") {
  results.push({ label, passed, detail });
  console.log(`  ${passed ? "OK   " : "ÉCHEC"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

async function call(path, { key, method = "GET", body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* réponse sans corps JSON */
  }
  return { status: response.status, payload };
}

const stamp = Date.now();
const accounts = [
  { tag: "A", email: `kairos-api-a-${stamp}@example.com`, password: `Api-${stamp}-a!` },
  { tag: "B", email: `kairos-api-b-${stamp}@example.com`, password: `Api-${stamp}-b!` },
];

const created = [];

try {
  // --- 1. Deux espaces, deux clés ------------------------------------------
  console.log("\n1. Espaces et clés API");
  for (const account of accounts) {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: `API ${account.tag}` },
    });
    if (error) throw new Error(`compte ${account.tag} : ${error.message}`);
    account.userId = data.user.id;
    created.push(account);

    const { data: membership } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", account.userId)
      .single();
    account.workspaceId = membership.workspace_id;

    account.apiKey = `kai_test_${account.tag}_${stamp}`;
    const { error: keyError } = await admin.from("api_keys").insert({
      workspace_id: account.workspaceId,
      name: `Test ${account.tag}`,
      key_hash: hashKey(account.apiKey),
      prefix: account.apiKey.slice(0, 8),
    });
    if (keyError) throw new Error(`clé ${account.tag} : ${keyError.message}`);
  }
  check("deux espaces avec une clé API chacun", created.length === 2);

  const [a, b] = accounts;

  // --- 2. Authentification --------------------------------------------------
  console.log("\n2. Authentification");
  const noKey = await call("/api/v1/companies");
  check("sans clé → 401", noKey.status === 401, `HTTP ${noKey.status}`);

  const badKey = await call("/api/v1/companies", { key: "kai_totalement_invalide" });
  check("clé invalide → 401", badKey.status === 401, `HTTP ${badKey.status}`);

  // --- 3. Écriture et lecture ----------------------------------------------
  console.log("\n3. Écriture et lecture");
  const createCompany = await call("/api/v1/companies", {
    key: a.apiKey,
    method: "POST",
    body: { name: "Boucha Group", email: "info@boucha.be", city: "Herstal" },
  });
  check(
    "POST /companies → 201",
    createCompany.status === 201 && Boolean(createCompany.payload?.data?.id),
    `HTTP ${createCompany.status}`,
  );
  const companyId = createCompany.payload?.data?.id;

  const invalid = await call("/api/v1/companies", {
    key: a.apiKey,
    method: "POST",
    body: { email: "sans-nom@exemple.be" },
  });
  check("POST sans nom → 422", invalid.status === 422, `HTTP ${invalid.status}`);

  const listA = await call("/api/v1/companies", { key: a.apiKey });
  check(
    "GET /companies renvoie l'entreprise créée",
    listA.status === 200 && listA.payload?.data?.some((c) => c.id === companyId),
    `HTTP ${listA.status}, ${listA.payload?.count ?? 0} ligne(s)`,
  );

  const { data: stages } = await admin
    .from("stages")
    .select("id")
    .eq("workspace_id", a.workspaceId)
    .order("position");

  const createDeal = await call("/api/v1/deals", {
    key: a.apiKey,
    method: "POST",
    body: {
      title: "Refonte site Boucha",
      stage_id: stages[1].id,
      company_id: companyId,
      value: 4200,
    },
  });
  check("POST /deals → 201", createDeal.status === 201, `HTTP ${createDeal.status}`);

  const foreignStage = await call("/api/v1/deals", {
    key: b.apiKey,
    method: "POST",
    body: { title: "Tentative", stage_id: stages[1].id },
  });
  check(
    "POST /deals avec une étape d'un autre espace → 422",
    foreignStage.status === 422,
    `HTTP ${foreignStage.status}`,
  );

  const createTask = await call("/api/v1/tasks", {
    key: a.apiKey,
    method: "POST",
    body: {
      title: "Relancer Boucha Group",
      due_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      company_id: companyId,
      remind_before_min: 60,
    },
  });
  check("POST /tasks → 201", createTask.status === 201, `HTTP ${createTask.status}`);

  const createContact = await call("/api/v1/contacts", {
    key: a.apiKey,
    method: "POST",
    body: { first_name: "Sarah", email: "sarah@boucha.be", company_id: companyId },
  });
  check("POST /contacts → 201", createContact.status === 201, `HTTP ${createContact.status}`);

  // --- 4. Cloisonnement entre espaces --------------------------------------
  console.log("\n4. Cloisonnement");
  const listB = await call("/api/v1/companies", { key: b.apiKey });
  check(
    "la clé de B ne voit aucune entreprise de A",
    listB.status === 200 && (listB.payload?.count ?? 0) === 0,
    `${listB.payload?.count ?? 0} ligne(s)`,
  );

  const dealsB = await call("/api/v1/deals", { key: b.apiKey });
  check(
    "la clé de B ne voit aucune opportunité de A",
    (dealsB.payload?.count ?? 0) === 0,
    `${dealsB.payload?.count ?? 0} ligne(s)`,
  );

  const tasksB = await call("/api/v1/tasks", { key: b.apiKey });
  check(
    "la clé de B ne voit aucune relance de A",
    (tasksB.payload?.count ?? 0) === 0,
    `${tasksB.payload?.count ?? 0} ligne(s)`,
  );

  // --- 5. Filtres et pagination --------------------------------------------
  console.log("\n5. Filtres et pagination");
  const search = await call("/api/v1/companies?q=Boucha", { key: a.apiKey });
  check("recherche ?q= fonctionne", (search.payload?.count ?? 0) === 1);

  const paged = await call("/api/v1/companies?limit=1&offset=0", { key: a.apiKey });
  check(
    "pagination respectée",
    paged.payload?.data?.length === 1 && paged.payload?.limit === 1,
  );

  const openTasks = await call("/api/v1/tasks?done=false", { key: a.apiKey });
  check("filtre ?done=false fonctionne", (openTasks.payload?.count ?? 0) >= 1);

  // --- 6. Ressource par identifiant : PATCH et DELETE ---------------------
  console.log("\n6. PATCH, DELETE et quota");

  const getOne = await call(`/api/v1/companies/${companyId}`, { key: a.apiKey });
  check("GET /companies/:id", getOne.status === 200 && getOne.payload?.data?.id === companyId, `HTTP ${getOne.status}`);

  const patched = await call(`/api/v1/companies/${companyId}`, {
    key: a.apiKey, method: "PATCH", body: { city: "Liege", sector: "Industrie" },
  });
  check(
    "PATCH modifie bien les champs",
    patched.status === 200 && patched.payload?.data?.city === "Liege" && patched.payload?.data?.sector === "Industrie",
    `HTTP ${patched.status}`,
  );

  const patchInvalid = await call(`/api/v1/companies/${companyId}`, {
    key: a.apiKey, method: "PATCH", body: { email: "pas-une-adresse" },
  });
  check("PATCH avec e-mail invalide donne 422", patchInvalid.status === 422, `HTTP ${patchInvalid.status}`);

  const foreignPatch = await call(`/api/v1/companies/${companyId}`, {
    key: b.apiKey, method: "PATCH", body: { city: "Pirate" },
  });
  check("la cle de B ne peut pas modifier une fiche de A", foreignPatch.status === 404, `HTTP ${foreignPatch.status}`);

  const badId = await call("/api/v1/companies/pas-un-uuid", { key: a.apiKey });
  check("identifiant mal forme donne 400", badId.status === 400, `HTTP ${badId.status}`);

  const missing = await call("/api/v1/companies/00000000-0000-0000-0000-000000000000", { key: a.apiKey });
  check("identifiant inconnu donne 404", missing.status === 404, `HTTP ${missing.status}`);

  const trashed = await call(`/api/v1/companies/${companyId}`, { key: a.apiKey, method: "DELETE" });
  check("DELETE met a la corbeille", trashed.status === 200 && trashed.payload?.deleted === "trashed", `HTTP ${trashed.status}`);

  const afterDelete = await call("/api/v1/companies", { key: a.apiKey });
  check(
    "la fiche a la corbeille disparait de la liste",
    !afterDelete.payload?.data?.some((c) => c.id === companyId),
    `${afterDelete.payload?.count ?? 0} ligne(s)`,
  );

  const headed = await fetch(`${BASE_URL}/api/v1/companies`, {
    headers: { Authorization: `Bearer ${a.apiKey}` },
  });
  check(
    "en-tetes de quota presents",
    headed.headers.has("x-ratelimit-limit") && headed.headers.has("x-ratelimit-remaining"),
    `limite ${headed.headers.get("x-ratelimit-limit")}, reste ${headed.headers.get("x-ratelimit-remaining")}`,
  );


  // --- 7. Routes système ----------------------------------------------------
  console.log("\n6. Routes système");
  const cronNoSecret = await call("/api/cron/reminders");
  check("cron sans secret → 401", cronNoSecret.status === 401, `HTTP ${cronNoSecret.status}`);

  const cronBadSecret = await call("/api/cron/reminders?secret=faux");
  check("cron avec mauvais secret → 401", cronBadSecret.status === 401);

  const cronOk = await call(`/api/cron/reminders?secret=${env.CRON_SECRET}`);
  check("cron avec le bon secret → 200", cronOk.status === 200, `HTTP ${cronOk.status}`);

  const refreshOk = await call(`/api/cron/refresh-tokens?secret=${env.CRON_SECRET}`);
  check("refresh-tokens avec le bon secret → 200", refreshOk.status === 200);

  for (const route of ["sync-calendar", "retry-webhooks", "pull-calendar", "purge"]) {
    const guarded = await call(`/api/cron/${route}`);
    check(`cron ${route} refuse sans secret`, guarded.status === 401, `HTTP ${guarded.status}`);
    const allowed = await call(`/api/cron/${route}?secret=${env.CRON_SECRET}`);
    check(`cron ${route} repond avec le bon secret`, allowed.status === 200, `HTTP ${allowed.status}`);
  }
} catch (error) {
  console.error(`\nInterrompu : ${error.message}`);
  process.exitCode = 1;
} finally {
  console.log("\n7. Nettoyage");
  for (const account of created) {
    if (account.workspaceId) {
      await admin.from("workspaces").delete().eq("id", account.workspaceId);
    }
    await admin.auth.admin.deleteUser(account.userId);
  }
  console.log(`  ${created.length} compte(s) et espace(s) supprimés.`);

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications passées.`);
  if (failed.length) {
    console.log("\nÉchecs :");
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`);
    process.exitCode = 1;
  }
}
