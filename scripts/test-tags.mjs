/**
 * Vérifie la gestion des tags : catalogue, renommage propagé, fusion,
 * suppression, et récupération des tags déjà présents sur les fiches.
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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const results = [];
const check = (l, ok, d = "") => {
  results.push({ l, ok, d });
  console.log(`  ${ok ? "OK   " : "ÉCHEC"}  ${l}${d ? ` — ${d}` : ""}`);
};

const stamp = Date.now();
const email = `kairos-tags-${stamp}@example.com`;
const password = `Tag-${stamp}!`;
let userId = null;
let wsId = null;

try {
  const { data: created } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: "Tags" },
  });
  userId = created.user.id;
  const { data: m } = await admin
    .from("workspace_members").select("workspace_id").eq("user_id", userId).single();
  wsId = m.workspace_id;

  // Fiches portant des tags libres, sans passer par le catalogue — comme un import.
  await admin.from("companies").insert([
    { workspace_id: wsId, name: "Sibelga", tags: ["a rappeler", "energie"] },
    { workspace_id: wsId, name: "Boucha Group", tags: ["a rappeler"] },
  ]);
  await admin.from("contacts").insert({
    workspace_id: wsId, first_name: "Marc", tags: ["a rappeler"],
  });

  // Session utilisateur : tout passe par la RLS, comme dans l'app.
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await anon.auth.signInWithPassword({ email, password });

  console.log("\n1. Récupération depuis les fiches");
  const { data: added, error: syncErr } = await anon.rpc("sync_workspace_tags", { ws: wsId });
  check("sync_workspace_tags répond", !syncErr, syncErr?.message ?? `${added} ajouté(s)`);

  const { data: cat1 } = await anon.from("tags").select("name").eq("workspace_id", wsId).order("name");
  check(
    "catalogue rempli depuis les fiches",
    cat1?.length === 2 && cat1.map((t) => t.name).join(",") === "a rappeler,energie",
    cat1?.map((t) => t.name).join(", "),
  );

  console.log("\n2. Renommage propagé");
  const { error: renErr } = await anon.rpc("rename_workspace_tag", {
    ws: wsId, old_name: "a rappeler", new_name: "À rappeler",
  });
  check("rename_workspace_tag répond", !renErr, renErr?.message ?? "");

  const { data: cos } = await anon.from("companies").select("name, tags").eq("workspace_id", wsId).order("name");
  check(
    "les 2 entreprises portent le nouveau nom",
    cos?.every((c) => c.tags.includes("À rappeler")) && !cos?.some((c) => c.tags.includes("a rappeler")),
    JSON.stringify(cos?.map((c) => c.tags)),
  );

  const { data: cts } = await anon.from("contacts").select("tags").eq("workspace_id", wsId);
  check("le contact aussi", cts?.[0]?.tags.includes("À rappeler"));

  const { data: cat2 } = await anon.from("tags").select("name").eq("workspace_id", wsId).order("name");
  check("catalogue renommé", cat2?.some((t) => t.name === "À rappeler"), cat2?.map((t) => t.name).join(", "));

  console.log("\n3. Fusion de deux tags");
  await anon.rpc("rename_workspace_tag", { ws: wsId, old_name: "energie", new_name: "À rappeler" });
  const { data: cat3 } = await anon.from("tags").select("name").eq("workspace_id", wsId);
  check("les deux tags ont fusionné", cat3?.length === 1, cat3?.map((t) => t.name).join(", "));

  const { data: sibelga } = await anon.from("companies").select("tags").eq("name", "Sibelga").single();
  check(
    "pas de doublon sur la fiche fusionnée",
    sibelga?.tags.filter((t) => t === "À rappeler").length === 1 &&
      !sibelga?.tags.includes("energie"),
    JSON.stringify(sibelga?.tags),
  );

  console.log("\n4. Suppression");
  const { error: delErr } = await anon.rpc("delete_workspace_tag", { ws: wsId, tag_name: "À rappeler" });
  check("delete_workspace_tag répond", !delErr, delErr?.message ?? "");

  const { data: cos2 } = await anon.from("companies").select("tags").eq("workspace_id", wsId);
  check("tag retiré de toutes les fiches", cos2?.every((c) => c.tags.length === 0), JSON.stringify(cos2?.map((c) => c.tags)));

  const { data: cat4 } = await anon.from("tags").select("name").eq("workspace_id", wsId);
  check("catalogue vidé", cat4?.length === 0);

  console.log("\n5. Cloisonnement");
  const { data: otherUser } = await admin.auth.admin.createUser({
    email: `kairos-tags-b-${stamp}@example.com`, password, email_confirm: true,
  });
  const anonB = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await anonB.auth.signInWithPassword({ email: `kairos-tags-b-${stamp}@example.com`, password });
  await anon.from("tags").insert({ workspace_id: wsId, name: "prive" });
  const { data: leak } = await anonB.from("tags").select("name").eq("workspace_id", wsId);
  check("un autre compte ne voit pas les tags", (leak?.length ?? 0) === 0, `${leak?.length ?? 0} ligne(s)`);
  await admin.auth.admin.deleteUser(otherUser.user.id);
} catch (e) {
  console.error(`\nInterrompu : ${e.message}`);
  process.exitCode = 1;
} finally {
  console.log("\n6. Nettoyage");
  if (wsId) await admin.from("workspaces").delete().eq("id", wsId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("  compte et espace de test supprimés.");
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications passées.`);
  if (failed.length) process.exitCode = 1;
}
