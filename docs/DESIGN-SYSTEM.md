# docs/DESIGN-SYSTEM.md — Design system

## Le brief en une phrase

**Pro, rapide, moderne — agréable au point qu'on ait envie d'y aller.** Le « ludique » ne passe PAS par des emojis ou des couleurs criardes : il passe par la fluidité, la vitesse, des micro-interactions satisfaisantes et une interface qui respire. On vise le niveau de finition d'Attio, Folk et Linear.

## Références (ce qu'on emprunte à chacune)

- **Linear** — vitesse ressentie, raccourcis clavier partout, transitions courtes et nettes, densité maîtrisée.
- **Attio** — tables élégantes, données lisibles, sobriété premium.
- **Folk** — chaleur, rondeur, côté « humain » d'un CRM relationnel. Fiches contact agréables.
- **Pipedrive** — clarté du kanban : on comprend son pipeline en un coup d'œil.
- **Notion** — édition en ligne fluide, tout se modifie là où on le lit.

## Direction

Interface **claire par défaut** (mode sombre disponible), beaucoup de blanc, une **seule couleur d'accent** forte (personnalisable par espace), typographie soignée, coins arrondis, ombres douces et discrètes. Le mouvement est bref et fonctionnel (120–200 ms), jamais décoratif. La « joie » vient de : un drag de carte qui suit le doigt, un ⌘K instantané, un toast propre, un état vide qui donne envie de cliquer.

**Le geste signature :** le **⌘K QuickAdd**. Où qu'on soit, une frappe ouvre une barre de commande pour tout créer (entreprise, contact, deal, relance) en quelques secondes. C'est ça, « l'encodage hyper facile ».

## Tokens (thème par défaut — surchargés par `workspace.branding`)

```css
:root {
  /* Neutres (zinc/slate) */
  --background: #FFFFFF;
  --surface:    #FAFAFA;
  --card:       #FFFFFF;
  --border:     #E7E7EA;
  --muted:      #6B7280;
  --foreground: #18181B;

  /* Accent — personnalisable par espace (défaut indigo) */
  --accent:      #4F46E5;
  --accent-fg:   #FFFFFF;
  --accent-soft: #EEF0FF;

  /* Sémantique */
  --success: #16A34A;
  --warning: #D97706;
  --danger:  #DC2626;
  --info:    #2563EB;

  /* Forme & mouvement */
  --radius:  0.75rem;         /* personnalisable */
  --shadow:  0 1px 2px rgba(16,24,40,.04), 0 4px 12px rgba(16,24,40,.06);
  --ease:    cubic-bezier(.22,1,.36,1);
  --dur:     160ms;
}
:root[data-theme="dark"] {
  --background:#0B0B0F; --surface:#111114; --card:#16161B; --border:#26262C;
  --muted:#9A9AA5; --foreground:#F4F4F5; --accent-soft:#1B1B44;
}
```

### Personnalisation par espace (white-label)

`workspaces.branding` (jsonb) → injecté en CSS variables dans le `ThemeProvider` :

```ts
// components/shell/ThemeProvider.tsx (esquisse)
const { accent, radius, mode, logo_url, brand_name } = workspace.branding;
style = { ['--accent']: accent, ['--radius']: radius };
document.documentElement.dataset.theme = mode; // 'light' | 'dark'
```

L'écran **Réglages → Apparence** permet de choisir : couleur d'accent (palette + hex libre), arrondi (net / doux / rond), mode clair/sombre, logo, nom affiché. Les **couleurs des boutons** suivent l'accent ; les **couleurs d'étapes** du pipeline sont éditables une par une (champ `stages.color`). Aperçu live avant enregistrement.

## Typographie

- **Interface & corps** : `Inter` (ou `Geist Sans`) — neutre, lisible, moderne.
- **Titres / chiffres clés (dashboard)** : `Geist` en poids 600–700, ou `Inter` tight. Option : une display plus caractérielle (`General Sans`) réservée aux gros chiffres du dashboard.
- **Données / montants** : variante tabulaire (`font-variant-numeric: tabular-nums`) pour aligner les colonnes.
- Échelle : 12 / 13 / 14 (base UI) / 16 / 20 / 24 / 32 (chiffres dashboard). Interlignage généreux.

## Iconographie

**lucide-react uniquement. Zéro emoji dans l'UI.** Icônes à 1.5px de trait, taille 16–18px dans les contrôles, alignées au texte. Toujours un `aria-label` quand l'icône est seule.

Correspondances utiles : `Building2` (entreprise), `User` (contact), `Handshake`/`Target` (deal), `CalendarClock` (relance), `Bell` (rappel), `Plug`/`Zap` (intégrations & automations), `Search`, `Command` (⌘K), `Filter`, `MoreHorizontal`, `Check`, `TrendingUp` (dashboard).

## Composants clés (au-dessus de shadcn/ui)

- **Sidebar** : navigation (Dashboard, Pipeline, Contacts, Aujourd'hui, Automations, Réglages) + sélecteur d'espace + logo du branding.
- **Topbar** : recherche globale, bouton ⌘K, avatar/menu.
- **KanbanBoard** : colonnes = étapes (couleur = `stage.color`), cartes deals draggables (@dnd-kit), compteur + total valeur par colonne, drag fluide avec placeholder.
- **DealCard** : nom du compte, montant (tabular), pastille priorité, badge relance en retard (point coloré, pas d'emoji), pastilles de tags.
- **ContactSheet / fiche** : en-tête + timeline verticale (activities), édition en ligne (clic = champ éditable, Enter = save), bloc « Relances » latéral.
- **QuickAdd (⌘K)** : cmdk, recherche + création rapide, actions contextuelles.
- **TaskRow** (vue Aujourd'hui) : échéance relative (« il y a 2 j »), rattachement, boutons « Terminer » / « Reporter » / « Relancer ».
- **EmptyState** : icône fine + une phrase claire + un bouton d'action (jamais une page vide).

## Mouvement (discipline)

Transitions 120–200 ms, `--ease`. On anime : ouverture de sheet/dialog (fade+scale léger), drag de carte, apparition de toast, changement d'étape (petit « settle »). On **n'anime pas** : les chargements de liste (préférer des squelettes), les hovers de texte, tout ce qui se répète beaucoup. `prefers-reduced-motion` respecté.

## Écriture (la copy fait 50 % du « pro »)

- **Français, ton clair et direct**, jamais infantilisant, jamais d'emoji.
- Les **boutons disent l'action** : « Ajouter un contact », « Programmer la relance », « Connecter Google Agenda » — pas « Valider »/« Soumettre ».
- Le mot d'une action reste le même partout : bouton « Envoyer » → toast « Envoyé ».
- **États vides = invitations** : « Aucune relance en retard. Tu es à jour. » / « Ajoute ton premier prospect avec ⌘K. »
- **Erreurs = solutions** : « Impossible de créer l'événement : reconnecte Google Agenda dans Réglages → Intégrations. » Jamais « une erreur est survenue ».
- Nombres et dates à la belge/FR : `1 250 €`, `mar. 3 juin`, échéances relatives (« dans 5 jours », « il y a 2 jours »).

## Le « ludique », proprement dosé (optionnel, désactivable)

Pour garder l'énergie sans tomber dans le gadget, une couche *momentum* discrète, présentée comme une métrique pro (pas comme un jeu) :
- Un petit indicateur **« Relances cette semaine »** avec une barre de progression vers un objectif que l'utilisateur fixe.
- Une **série de jours actifs** affichée sobrement dans le dashboard (icône `Flame` fine, un chiffre — pas de confettis, pas de badge coloré).
- Micro-satisfaction : quand on termine la dernière relance du jour, la vue « Aujourd'hui » affiche un état vide valorisant (« Tout est à jour »), pas une animation tape-à-l'œil.

Tout ça est **désactivable** par espace (certains clients notaires n'en voudront pas). C'est un réglage, pas le cœur.
