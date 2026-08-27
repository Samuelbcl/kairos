/**
 * Test d'étanchéité multi-tenant — critère de fin de la Phase 1.
 *
 *   node scripts/test-rls.mjs
 *
 * Crée deux comptes jetables, vérifie que le trigger handle_new_user a bien
 * monté leur espace, puis tente depuis le compte B toutes les lectures et
 * écritures possibles sur les données du compte A. Chacune doit échouer.
 * Les comptes sont supprimés à la fin, même en cas d'échec.
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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
function check(label, passed, detail = "") {
  results.push({ label, passed, detail });
  console.log(`  ${passed ? "OK  " : "ÉCHEC"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

const stamp = Date.now();
const accounts = [
  { tag: "A", email: `kairos-rls-a-${stamp}@example.com`, password: `Pw-${stamp}-a!` },
  { tag: "B", email: `kairos-rls-b-${stamp}@example.com`, password: `Pw-${stamp}-b!` },
];

const created = [];

try {
  // --- 1. Création des deux comptes -----------------------------------------
  console.log("\n1. Création de deux comptes et de leurs espaces");
  for (const account of accounts) {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: `Test RLS ${account.tag}` },
    });
    if (error) throw new Error(`création du compte ${account.tag} : ${error.message}`);
    account.userId = data.user.id;
    created.push(data.user.id);
  }
  check("les deux comptes sont créés", created.length === 2);

  // --- 2. Le trigger handle_new_user a-t-il fait son travail ? --------------
  console.log("\n2. Trigger handle_new_user");
  for (const account of accounts) {
    const { data: members } = await admin
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", account.userId);

    const membership = members?.[0];
    account.workspaceId = membership?.workspace_id;

    check(
      `compte ${account.tag} : un espace créé, rôle owner`,
      members?.length === 1 && membership?.role === "owner",
      `${members?.length ?? 0} espace(s), rôle ${membership?.role ?? "aucun"}`,
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", account.userId)
      .single();
    check(`compte ${account.tag} : profil créé`, Boolean(profile), profile?.full_name ?? "");

    const { data: stages } = await admin
      .from("stages")
      .select("name, position")
      .eq("workspace_id", account.workspaceId)
      .order("position");
    check(
      `compte ${account.tag} : 6 étapes de pipeline`,
      stages?.length === 6,
      stages?.map((s) => s.name).join(" → ") ?? "aucune",
    );
  }

  check(
    "les deux espaces sont bien distincts",
    accounts[0].workspaceId !== accounts[1].workspaceId,
  );

  // --- 3. A crée une donnée ------------------------------------------------
  console.log("\n3. Le compte A crée une entreprise dans son espace");
  const clientA = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInA } = await clientA.auth.signInWithPassword({
    email: accounts[0].email,
    password: accounts[0].password,
  });
  if (signInA) throw new Error(`connexion A : ${signInA.message}`);

  const { data: company, error: insertError } = await clientA
    .from("companies")
    .insert({
      workspace_id: accounts[0].workspaceId,
      name: "Menuiserie Secrète SPRL",
      email: "confidentiel@exemple.be",
    })
    .select("id, name")
    .single();
  check("A insère une entreprise dans son espace", !insertError, insertError?.message ?? "");
  const companyId = company?.id;

  const { data: ownRead } = await clientA
    .from("companies")
    .select("id")
    .eq("id", companyId);
  check("A relit bien sa propre entreprise", ownRead?.length === 1);

  // --- 4. B tente d'accéder aux données de A --------------------------------
  console.log("\n4. Le compte B tente d'atteindre les données de A");
  const clientB = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInB } = await clientB.auth.signInWithPassword({
    email: accounts[1].email,
    password: accounts[1].password,
  });
  if (signInB) throw new Error(`connexion B : ${signInB.message}`);

  const { data: leakedCompanies } = await clientB.from("companies").select("id, name");
  check(
    "B ne voit aucune entreprise de A",
    (leakedCompanies?.length ?? 0) === 0,
    `${leakedCompanies?.length ?? 0} ligne(s) visible(s)`,
  );

  const { data: targeted } = await clientB
    .from("companies")
    .select("id, name")
    .eq("id", companyId);
  check("B ne peut pas cibler l'entreprise de A par son id", (targeted?.length ?? 0) === 0);

  const { data: leakedWorkspaces } = await clientB
    .from("workspaces")
    .select("id")
    .eq("id", accounts[0].workspaceId);
  check("B ne voit pas l'espace de A", (leakedWorkspaces?.length ?? 0) === 0);

  const { data: leakedStages } = await clientB
    .from("stages")
    .select("id")
    .eq("workspace_id", accounts[0].workspaceId);
  check("B ne voit pas les étapes de A", (leakedStages?.length ?? 0) === 0);

  const { data: leakedMembers } = await clientB
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", accounts[0].workspaceId);
  check("B ne voit pas les membres de l'espace de A", (leakedMembers?.length ?? 0) === 0);

  const { error: updateError } = await clientB
    .from("companies")
    .update({ name: "Piraté" })
    .eq("id", companyId);
  const { data: afterUpdate } = await admin
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();
  check(
    "B ne peut pas modifier l'entreprise de A",
    afterUpdate?.name === "Menuiserie Secrète SPRL",
    updateError ? `refus explicite : ${updateError.code}` : "aucune ligne touchée",
  );

  const { error: deleteError } = await clientB
    .from("companies")
    .delete()
    .eq("id", companyId);
  const { data: afterDelete } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId);
  check(
    "B ne peut pas supprimer l'entreprise de A",
    afterDelete?.length === 1,
    deleteError ? `refus explicite : ${deleteError.code}` : "aucune ligne touchée",
  );

  const { error: injectError } = await clientB.from("companies").insert({
    workspace_id: accounts[0].workspaceId,
    name: "Injectée par B",
  });
  check("B ne peut pas écrire dans l'espace de A", Boolean(injectError), injectError?.code ?? "");

  const { error: selfPromote } = await clientB.from("workspace_members").insert({
    workspace_id: accounts[0].workspaceId,
    user_id: accounts[1].userId,
    role: "owner",
  });
  check(
    "B ne peut pas s'ajouter lui-même à l'espace de A",
    Boolean(selfPromote),
    selfPromote?.code ?? "",
  );

  // --- 5. La table integrations (tokens OAuth) ------------------------------
  console.log("\n5. Table integrations (tokens OAuth)");
  const { data: integrations } = await clientB.from("integrations").select("id");
  check("B ne lit aucune intégration", (integrations?.length ?? 0) === 0);

  const { error: fakeIntegration } = await clientB.from("integrations").insert({
    workspace_id: accounts[0].workspaceId,
    user_id: accounts[0].userId,
    provider: "google",
    access_token_enc: "peu-importe",
  });
  check(
    "B ne peut pas créer une intégration au nom de A",
    Boolean(fakeIntegration),
    fakeIntegration?.code ?? "",
  );
} catch (error) {
  console.error(`\nInterrompu : ${error.message}`);
  process.exitCode = 1;
} finally {
  // --- Nettoyage ------------------------------------------------------------
  // Attention : supprimer un compte ne supprime PAS son espace. workspaces.created_by
  // est en `on delete set null`, donc l'espace survivrait sans aucun membre.
  // On supprime donc les espaces explicitement, avant les comptes.
  console.log("\n6. Nettoyage");

  const workspaceIds = accounts.map((a) => a.workspaceId).filter(Boolean);
  if (workspaceIds.length) {
    const { error } = await admin.from("workspaces").delete().in("id", workspaceIds);
    if (error) console.error(`  suppression des espaces impossible : ${error.message}`);
  }

  for (const userId of created) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error(`  suppression de ${userId} impossible : ${error.message}`);
  }

  const { data: orphans } = await admin
    .from("workspaces")
    .select("id, name")
    .in("id", workspaceIds.length ? workspaceIds : [crypto.randomUUID()]);
  console.log(
    `  ${created.length} compte(s) et ${workspaceIds.length} espace(s) supprimés` +
      (orphans?.length ? ` — ATTENTION : ${orphans.length} espace(s) orphelin(s) restant(s)` : "."),
  );

  const failed = results.filter((r) => !r.passed);
  console.log(
    `\n${results.length - failed.length}/${results.length} vérifications passées.`,
  );
  if (failed.length) {
    console.log("\nFUITE DÉTECTÉE :");
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`);
    process.exitCode = 1;
  } else {
    console.log("Aucune fuite entre les deux espaces.");
  }
}
