/**
 * Mesure la mise en page dans un vrai navigateur, sur écran d'ordinateur et de
 * téléphone.
 *
 *   npm run check:layout
 *   npm run check:layout -- https://kairos-xi-gray.vercel.app
 *
 * Pilote Chrome par le protocole DevTools — Node sait parler WebSocket, il n'y
 * a aucune dépendance à installer. Vérifie ce qu'aucun test HTTP ne voit : la
 * page déborde-t-elle horizontalement, la barre de défilement du kanban est-elle
 * atteignable sans descendre, la dernière colonne est-elle joignable.
 *
 * Crée un compte jetable avec assez d'opportunités pour que le tableau déborde
 * vraiment, et le supprime à la fin.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const VIEWPORTS = [
  { label: "ordinateur", width: 1440, height: 900, mobile: false },
  { label: "telephone ", width: 390, height: 844, mobile: true },
];

function loadEnv(path = ".env.local") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const env = loadEnv();
const BASE_URL = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
function check(label, passed, detail = "") {
  results.push({ label, passed, detail });
  console.log(`  ${passed ? "OK   " : "ECHEC"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

// --- Pilotage de Chrome ------------------------------------------------------

class Browser {
  #ws;
  #id = 0;
  #pending = new Map();
  #handlers = new Map();

  static async launch() {
    const binary = CHROME_PATHS.find((p) => existsSync(p));
    if (!binary) throw new Error("aucun navigateur Chrome ou Edge trouve");

    const port = 9000 + Math.floor(Math.random() * 900);
    const profile = join(tmpdir(), `kairos-layout-${Date.now()}`);
    const child = spawn(
      binary,
      [
        "--headless=new",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "about:blank",
      ],
      { stdio: "ignore" },
    );

    let target = null;
    for (let attempt = 0; attempt < 60 && !target; attempt++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        target = list.find((t) => t.type === "page");
      } catch {
        // le port n'est pas encore ouvert
      }
    }
    if (!target) {
      child.kill();
      throw new Error("Chrome n'a pas ouvert son port de debogage");
    }

    const browser = new Browser();
    await browser.connect(target.webSocketDebuggerUrl);
    browser.child = child;
    browser.profile = profile;
    return browser;
  }

  async connect(wsUrl) {
    this.#ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      this.#ws.addEventListener("open", resolve, { once: true });
      this.#ws.addEventListener("error", reject, { once: true });
    });

    this.#ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.#pending.has(message.id)) {
        const { resolve, reject } = this.#pending.get(message.id);
        this.#pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method && this.#handlers.has(message.method)) {
        this.#handlers.get(message.method)();
        this.#handlers.delete(message.method);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => this.#handlers.set(method, resolve));
  }

  /** Evalue une expression dans la page et rend sa valeur. */
  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", {
      expression: `(() => { ${expression} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? "erreur dans la page");
    }
    return result.value;
  }

  /** Attend qu'un selecteur apparaisse : React hydrate apres le chargement. */
  async waitFor(selector, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const found = await this.evaluate(
        `return Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      );
      if (found) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  }

  /**
   * Attend que la mise en page cesse de bouger.
   *
   * Le HTML arrive avant les styles et avant l'hydratation. Mesure faite trop
   * tot, une table de 40 lignes non stylees tient dans un ecran : le test
   * annoncait alors que la page ne debordait pas.
   */
  async settle(timeout = 5000) {
    const deadline = Date.now() + timeout;
    let previous = -1;

    while (Date.now() < deadline) {
      const height = await this.evaluate(`
        return new Promise((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(document.body.scrollHeight)),
          );
        });
      `);
      if (height === previous) return;
      previous = height;
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  close() {
    try {
      this.#ws.close();
      this.child.kill();
      rmSync(this.profile, { recursive: true, force: true });
    } catch {
      // le profil temporaire disparaitra avec le dossier temp
    }
  }
}

// --- Gestes -----------------------------------------------------------------

/** Glissement horizontal du doigt, depuis un point donne. */
async function swipe(browser, x, y, distance) {
  await browser.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });

  // En plusieurs pas : un saut unique ne ressemble a rien et n'est pas
  // interprete comme un defilement.
  for (let step = 1; step <= 8; step++) {
    await browser.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + (distance * step) / 8, y }],
    });
    await new Promise((r) => setTimeout(r, 16));
  }

  await browser.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise((r) => setTimeout(r, 250));
}

/**
 * Molette verticale. `shift` la transforme en defilement horizontal : c'est la
 * convention du navigateur, pas une invention de l'application.
 */
async function wheel(browser, x, y, { shift = false } = {}) {
  for (let step = 0; step < 4; step++) {
    await browser.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x,
      y,
      deltaX: 0,
      deltaY: 120,
      modifiers: shift ? 8 : 0,
    });
    await new Promise((r) => setTimeout(r, 40));
  }
  await new Promise((r) => setTimeout(r, 250));
}

/**
 * Glisser-deposer au doigt : on maintient, puis on deplace. Le maintien est ce
 * qui distingue « je deplace une carte » de « je fais defiler le tableau ».
 */
async function dragTouch(browser, from, to, y) {
  await browser.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from, y }],
  });
  await new Promise((r) => setTimeout(r, 400));

  for (let step = 1; step <= 10; step++) {
    await browser.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from + ((to - from) * step) / 10, y }],
    });
    await new Promise((r) => setTimeout(r, 25));
  }

  const started = await browser.evaluate(
    "return Boolean(document.querySelector('.rotate-2'))",
  );

  await browser.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise((r) => setTimeout(r, 1200));
  return started;
}

/** Glisser-deposer a la souris. */
async function dragMouse(browser, from, to, y) {
  await browser.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: from,
    y,
    button: "left",
    clickCount: 1,
  });

  for (let step = 1; step <= 10; step++) {
    await browser.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: from + ((to - from) * step) / 10,
      y,
      button: "left",
      buttons: 1,
    });
    await new Promise((r) => setTimeout(r, 25));
  }

  const started = await browser.evaluate(
    "return Boolean(document.querySelector('.rotate-2'))",
  );

  await browser.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: to,
    y,
    button: "left",
    clickCount: 1,
  });
  await new Promise((r) => setTimeout(r, 1200));
  return started;
}

// --- Session et jeu de donnees ----------------------------------------------

function sessionCookies(session) {
  const name = `sb-${projectRef}-auth-token`;
  const encoded = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  if (encoded.length <= 3180) return [{ name, value: encoded }];
  const chunks = [];
  for (let i = 0; i < encoded.length; i += 3180) {
    chunks.push({ name: `${name}.${chunks.length}`, value: encoded.slice(i, i + 3180) });
  }
  return chunks;
}

const stamp = Date.now();
const account = { email: `kairos-layout-${stamp}@example.com`, password: `Layout-${stamp}!` };
let userId = null;
let workspaceId = null;
let browser = null;

try {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: "Test mise en page" },
  });
  if (error) throw new Error(`creation du compte : ${error.message}`);
  userId = created.user.id;

  const { data: membership } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .single();
  workspaceId = membership.workspace_id;

  // Sans ca, la visite guidee se lance et son voile plein ecran intercepte
  // tous les gestes : on mesurerait le voile, pas l'application.
  await admin
    .from("profiles")
    .update({ tour_completed_at: new Date().toISOString() })
    .eq("id", userId);

  const { data: stages } = await admin
    .from("stages")
    .select("id, pipeline_id")
    .eq("workspace_id", workspaceId)
    .order("position");

  // Assez d'opportunites pour que les colonnes depassent la hauteur de l'ecran.
  // C'est le cas reel : avec quelques dizaines d'affaires, la page grandit et
  // la barre de defilement horizontale du tableau part sous le pli.
  const deals = [];
  for (const [index, stage] of stages.entries()) {
    for (let n = 0; n < 14; n++) {
      deals.push({
        workspace_id: workspaceId,
        pipeline_id: stage.pipeline_id,
        stage_id: stage.id,
        title: `Opportunite ${index + 1}.${n + 1}`,
        value: 1000 * (n + 1),
      });
    }
  }
  await admin.from("deals").insert(deals);

  // Assez d'entreprises pour que la liste depasse l'ecran : c'est le cas qui
  // avait fait disparaitre la barre de defilement verticale.
  await admin.from("companies").insert(
    Array.from({ length: 40 }, (_, n) => ({
      workspace_id: workspaceId,
      name: `Entreprise ${String(n + 1).padStart(2, "0")}`,
      city: "Liege",
    })),
  );

  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword(account);
  if (signInError) throw new Error(`connexion : ${signInError.message}`);

  browser = await Browser.launch();
  await browser.send("Page.enable");
  await browser.send("Runtime.enable");
  await browser.send("Network.enable");

  const domain = new URL(BASE_URL).hostname;
  for (const cookie of sessionCookies(signIn.session)) {
    await browser.send("Network.setCookie", { ...cookie, domain, path: "/" });
  }

  console.log(`\nCible : ${BASE_URL}`);
  console.log(`${stages.length} etapes, ${deals.length} opportunites`);

  for (const viewport of VIEWPORTS) {
    console.log(`\n${viewport.label} — ${viewport.width}x${viewport.height}`);

    await browser.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
    });

    const loaded = browser.once("Page.loadEventFired");
    await browser.send("Page.navigate", { url: `${BASE_URL}/pipeline` });
    await loaded;

    const ready = await browser.waitFor('section[aria-label^="\u00c9tape"] article');
    if (!ready) {
      check(`${viewport.label} : kanban affiche`, false, "aucune colonne trouvee");
      continue;
    }

    await browser.settle();

    const m = await browser.evaluate(`
      const columns = [...document.querySelectorAll('section[aria-label^="\u00c9tape"]')];
      const board = columns[0].parentElement;

      // Le tableau defile-t-il reellement ?
      const before = board.scrollLeft;
      board.scrollLeft = 99999;
      const maxScroll = board.scrollLeft;
      board.scrollLeft = before;

      const rect = board.getBoundingClientRect();
      const card = document.querySelector('section[aria-label^="Étape"] article');
      const cardRect = card ? card.getBoundingClientRect() : null;

      return {
        pageOverflows: document.documentElement.scrollWidth > window.innerWidth + 1,
        boardOverflows: board.scrollWidth > board.clientWidth + 1,
        canScroll: maxScroll > 0,
        overflowX: getComputedStyle(board).overflowX,
        boardBottom: Math.round(rect.bottom),
        boardTop: Math.round(rect.top),
        viewportHeight: window.innerHeight,
        columnCount: columns.length,
        cardCount: document.querySelectorAll('section[aria-label^="Étape"] article').length,
        pageScrollHeight: document.documentElement.scrollHeight,
        // Point de depart des gestes : le centre d'une carte, la ou l'utilisateur
        // pose vraiment le doigt ou la souris.
        cardX: cardRect ? Math.round(cardRect.left + cardRect.width / 2) : null,
        cardY: cardRect ? Math.round(cardRect.top + cardRect.height / 2) : null,
      };
    `);

    // Le fond de page ne doit jamais deborder : c'est le tableau qui defile.
    check(
      `${viewport.label} : la page ne deborde pas horizontalement`,
      !m.pageOverflows,
      m.pageOverflows ? "le corps de page deborde" : "",
    );

    check(
      `${viewport.label} : le tableau peut defiler`,
      !m.boardOverflows || m.canScroll,
      m.boardOverflows && !m.canScroll ? `overflow-x: ${m.overflowX}` : "",
    );

    // Le point decisif : la barre horizontale est au bas du conteneur. Si ce
    // bas passe sous l'ecran, elle reste invisible tant qu'on n'a pas descendu.
    const reachable = m.boardBottom <= m.viewportHeight;
    check(
      `${viewport.label} : barre horizontale visible sans descendre`,
      reachable,
      reachable
        ? ""
        : `bas du tableau a ${m.boardBottom}px pour un ecran de ${m.viewportHeight}px`,
    );

    // Un tableau qui defile par programme ne sert a rien si aucun geste
    // humain ne le fait defiler. On repart de zero et on essaie pour de vrai.
    if (m.boardOverflows && m.cardX !== null) {
      await browser.evaluate(`
        document.querySelector('section[aria-label^="Étape"]').parentElement.scrollLeft = 0;
        return true;
      `);

      if (viewport.mobile) {
        // Au doigt, le balayage horizontal doit faire defiler et non attraper
        // une carte : c'est le seul geste disponible sur telephone.
        await swipe(browser, m.cardX, m.cardY, -220);
      } else {
        await wheel(browser, m.cardX, m.cardY, { shift: true });
      }

      const left = await browser.evaluate(`
        const board = document.querySelector('section[aria-label^="Étape"]').parentElement;
        return Math.round(board.scrollLeft);
      `);

      check(
        `${viewport.label} : ${viewport.mobile ? "balayage du doigt" : "maj+molette"} fait defiler le tableau`,
        left > 0,
        left > 0 ? `${left}px` : "aucun deplacement",
      );

      // Sur ordinateur, la molette seule doit rester verticale et faire defiler
      // la colonne survolee : sans ca, une colonne longue devient illisible.
      if (!viewport.mobile) {
        await browser.evaluate(`
          const board = document.querySelector('section[aria-label^="Étape"]').parentElement;
          board.scrollLeft = 0;
          return true;
        `);
        await wheel(browser, m.cardX, m.cardY);

        const columnTop = await browser.evaluate(`
          const list = document.querySelector('section[aria-label^="Étape"] article').parentElement;
          return Math.round(list.scrollTop);
        `);

        check(
          `${viewport.label} : la molette fait defiler la colonne`,
          columnTop > 0,
          columnTop > 0 ? `${columnTop}px` : "la colonne ne defile pas",
        );
      }
    }

    // Deplacer une opportunite est la raison d'etre du kanban : si ce geste ne
    // marche pas sur un format, la page n'y sert a rien.
    const target = await browser.evaluate(`
      const columns = [...document.querySelectorAll('section[aria-label^="Étape"]')];
      const board = columns[0].parentElement;
      const card = columns[0].querySelector('article');
      if (!card) return null;

      // Les tests precedents ont laisse le tableau et la colonne defiles :
      // sans remise a zero, la carte visee est hors de l'ecran et le geste
      // tombe dans le vide.
      board.scrollLeft = 0;
      card.parentElement.scrollTop = 0;

      // Amener la deuxieme colonne dans l'ecran sans perdre la premiere de vue.
      // Sur telephone, deux colonnes de 288px n'y tiennent pas entierement.
      const delta = columns[1].getBoundingClientRect().left - window.innerWidth * 0.55;
      if (delta > 0) board.scrollLeft += delta;

      const cardRect = card.getBoundingClientRect();
      const nextRect = columns[1].getBoundingClientRect();

      return {
        title: card.querySelector('p').textContent,
        fromX: Math.round(cardRect.left + cardRect.width / 2),
        y: Math.round(cardRect.top + cardRect.height / 2),
        toX: Math.round(nextRect.left + nextRect.width / 2),
        secondStage: columns[1].getAttribute('aria-label'),
        // Ce qui se trouve reellement sous le pointeur : si ce n'est pas la
        // carte, le geste ne partira jamais.
        under: (() => {
          const el = document.elementFromPoint(
            Math.round(cardRect.left + cardRect.width / 2),
            Math.round(cardRect.top + cardRect.height / 2),
          );
          if (!el) return 'rien';
          return (el.tagName.toLowerCase() + '.' + el.className).slice(0, 70);
        })(),
      };
    `);

    if (target && target.toX > 0) {
      const started = viewport.mobile
        ? await dragTouch(browser, target.fromX, target.toX, target.y)
        : await dragMouse(browser, target.fromX, target.toX, target.y);

      const moved = await browser.evaluate(`
        const columns = [...document.querySelectorAll('section[aria-label^="Étape"]')];
        if (columns.length < 2) return null;
        const titles = [...columns[1].querySelectorAll('article p')].map((p) => p.textContent);
        return titles.includes(${JSON.stringify(target.title)});
      `);

      check(
        `${viewport.label} : deplacer une opportunite vers une autre etape`,
        moved === true,
        moved === null
          ? "le geste a quitte le pipeline au lieu de deplacer la carte"
          : moved
            ? `${target.title} deplacee`
            : started
              ? "glissement demarre mais depot rate"
              : `glissement jamais demarre — sous le pointeur : ${target.under}`,
      );
    }

    console.log(
      `         ${m.columnCount} colonnes, ${m.cardCount} cartes, tableau de ${m.boardTop}px a ${m.boardBottom}px`,
    );

    // Une page longue doit descendre. La coquille est a hauteur d'ecran : si
    // la zone de contenu perdait son min-h-0, elle grandirait au lieu de
    // defiler et le bas de la liste deviendrait inatteignable.
    const listLoaded = browser.once("Page.loadEventFired");
    await browser.send("Page.navigate", { url: `${BASE_URL}/contacts` });
    await listLoaded;
    await browser.waitFor("table");
    await browser.settle();

    const scroll = await browser.evaluate(`
      const main = document.querySelector('main');
      main.scrollTop = 0;
      const overflows = main.scrollHeight > main.clientHeight + 1;
      main.scrollTop = 99999;
      return {
        overflows,
        reached: Math.round(main.scrollTop),
        scrollHeight: main.scrollHeight,
        clientHeight: main.clientHeight,
        rows: document.querySelectorAll('tbody tr').length,
      };
    `);

    check(
      `${viewport.label} : une liste longue peut descendre`,
      scroll.overflows && scroll.reached > 0,
      scroll.overflows
        ? scroll.reached > 0
          ? `${scroll.reached}px`
          : "le contenu deborde mais ne defile pas"
        : `contenu ${scroll.scrollHeight}px dans ${scroll.clientHeight}px, ${scroll.rows} lignes`,
    );
  }
} catch (error) {
  console.error(`\nInterrompu : ${error.message}`);
  process.exitCode = 1;
} finally {
  browser?.close();
  if (workspaceId) await admin.from("workspaces").delete().eq("id", workspaceId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("\nCompte de test supprime.");

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} verifications passees.`);
  if (failed.length) process.exitCode = 1;
}
