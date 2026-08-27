# docs/INTEGRATIONS.md — Connectivité

Kairos est un CRM **connecté**. Trois niveaux, du plus natif au plus ouvert :

1. **Natif** : Google (Calendar, Gmail) et Microsoft (Outlook/Graph) via OAuth.
2. **Moteur** : automatisations internes (voir `docs/AUTOMATIONS.md`).
3. **Ouvert à tout** : webhooks sortants + API REST → Make, Zapier, n8n, ou le logiciel métier d'un client.

---

## 1. Principe de la sync calendrier (le remplaçant de ton bouton Excel)

Aujourd'hui, dans ton tableur : tu mets un prospect en « à relancer », tu cliques un bouton, ça crée un événement Google Calendar. Dans Kairos, c'est le même geste — mais natif, fiable et réplicable pour tes clients.

**La règle d'or : une tâche (relance) ⇄ un événement agenda, liés par `external_event_id`.**
Cette idempotence évite le bug classique des doublons.

```
Tâche créée avec due_at  ─┐
Tâche déplacée (due_at)   ├─►  calendar.upsertEvent(task)  ─►  Google/MS event
Tâche terminée/supprimée ─┘                                     (créé | mis à jour | supprimé)
```

- **Créer** une tâche avec `due_at` → `createEvent` → on stocke `external_event_id`, `calendar_provider`, `calendar_synced_at`.
- **Modifier** `due_at`/titre → `updateEvent(external_event_id)`.
- **Terminer / supprimer** → `deleteEvent(external_event_id)` puis on vide les champs de sync.
- Rappel : on passe `remind_at` en `reminders.overrides` de l'événement.
- **MVP = one-way** (Kairos → Agenda). Le two-way (agenda → Kairos) est en V2, plus délicat (fuseaux, boucles).

### Esquisse `lib/integrations/calendar.ts`

```ts
// Provider-agnostic : route vers Google ou Microsoft selon l'intégration.
export async function upsertTaskEvent(task: Task, integ: Integration) {
  const payload = toEventPayload(task, integ.timezone); // 'Europe/Brussels'
  if (integ.provider === 'google') return googleUpsert(task, integ, payload);
  return microsoftUpsert(task, integ, payload);
}

function toEventPayload(task: Task, tz: string) {
  const start = task.due_at;                       // ISO
  const end   = addMinutes(new Date(start), 30);
  const remindMin = task.remind_at
    ? differenceInMinutes(new Date(start), new Date(task.remind_at))
    : 30;
  return {
    summary: task.title,                            // ex: « Relancer Boucha Group »
    description: `Relance Kairos · ${appUrl}/contacts/${task.company_id}`,
    start: { dateTime: start, timeZone: tz },
    end:   { dateTime: end.toISOString(), timeZone: tz },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: remindMin }] },
  };
}
```

---

## 2. OAuth — flux et sécurité

**Scopes minimaux** (principe du moindre privilège) :
- Google : `https://www.googleapis.com/auth/calendar.events` (+ `gmail.send` seulement si envoi via Gmail activé).
- Microsoft : `Calendars.ReadWrite`, `offline_access` (+ `Mail.Send` si besoin).

**Flux** (`/api/integrations/google` → Google → `/api/integrations/google/callback`) :
1. On génère un `state` signé (contient `workspace_id` + `user_id`) et on redirige vers l'écran de consentement.
2. Au retour, on échange le `code` contre `access_token` + `refresh_token`.
3. On **chiffre** les tokens (`lib/crypto.ts`, AES-256-GCM, clé `TOKEN_ENCRYPTION_KEY`) et on upsert dans `integrations`.
4. La table `integrations` n'est **jamais** lue côté client. Seul le serveur (service_role, cron, actions) la touche.

**Refresh** : Vercel Cron `/api/cron/refresh-tokens` (toutes les 6 h) rafraîchit les tokens qui expirent bientôt. On ne logge **jamais** un token, même tronqué.

### Esquisse `lib/crypto.ts`

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'base64'); // 32 octets

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
export function decrypt(payload: string) {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), enc = buf.subarray(28);
  const d = createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
```

---

## 3. Emails (Resend)

- **Transactionnels** (invitations, rappels) : Resend, from `no-reply@ton-domaine`.
- **Relances commerciales** : deux options —
  - *Resend* avec templates (simple, mais l'email ne s'affiche pas dans la boîte « Envoyés » du user).
  - *Gmail/Outlook connecté* (scope `*.send`) : l'email part de la vraie adresse du user, traçable côté fiche. Recommandé pour la relance.
- Chaque envoi crée une activité `email` sur la fiche.

---

## 4. Ouvert à tout — webhooks & API

**Webhooks sortants** (`webhooks`) : à chaque événement clé, POST signé HMAC vers l'URL configurée.

```
Événements : contact.created · company.created · deal.created · deal.stage_changed
             deal.won · deal.lost · task.created · task.completed
Header      : X-Kairos-Signature: sha256=<hmac(secret, body)>
```

**API REST** (clés dans `api_keys`, hashées) : `GET/POST /api/v1/contacts`, `/deals`, `/tasks`…
→ permet de brancher **Make / Zapier / n8n** et donc, indirectement, *n'importe quelle app* : Slack, WhatsApp Business, un logiciel notarial, un formulaire de site, etc.

**Entrant** (optionnel) : `/api/webhooks/[id]` pour recevoir un lead depuis un formulaire externe et créer une company/contact.

---

## 5. Checklist sécurité des intégrations

- [ ] Tokens chiffrés au repos, jamais loggés, jamais renvoyés au client.
- [ ] `state` OAuth signé et vérifié (anti-CSRF).
- [ ] Scopes minimaux, révocables depuis Réglages → Intégrations.
- [ ] Webhooks signés (HMAC) ; clés API hashées + préfixe affiché seulement.
- [ ] Refresh géré par cron protégé par `CRON_SECRET`.
- [ ] Suppression d'une intégration → nettoyage des `external_event_id` liés.
