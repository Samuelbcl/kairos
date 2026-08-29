/**
 * Contenu de la visite guidée — partagé serveur et client.
 *
 * Parti pris : beaucoup d'étapes courtes plutôt que peu d'étapes denses.
 * Une bulle qu'on lit en cinq secondes se lit ; un paragraphe se saute.
 * Chaque bulle nomme un geste précis à faire, pas une fonctionnalité à
 * comprendre.
 *
 * Chaque étape vise un élément réel par son attribut `data-tour`. Une étape
 * dont la cible est absente est sautée : la visite ne se bloque jamais sur un
 * écran étroit où la barre latérale est masquée.
 */

export type TourStep = {
  id: string;
  /** Valeur de l'attribut data-tour à mettre en avant. Absent = étape centrée. */
  target?: string;
  title: string;
  body: string;
  /** Le geste exact à faire, affiché en évidence sous le texte. */
  action?: string;
  /** Page à ouvrir avant d'afficher l'étape. */
  route?: string;
  /** Côté préféré pour la bulle. */
  side?: "top" | "bottom" | "left" | "right";
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Deux minutes, et tu sais tout",
    body: "Kairos sert à une chose : ne jamais rater une relance. On va voir chaque écran, et surtout ce que tu peux cliquer.",
    action: "Flèches ← → pour naviguer, Échap pour sortir",
  },

  // --- Se repérer -----------------------------------------------------------
  {
    id: "sidebar",
    target: "nav-dashboard",
    route: "/",
    side: "right",
    title: "La barre de gauche",
    body: "Tes six écrans. On les passe un par un.",
  },
  {
    id: "dashboard-stats",
    target: "dashboard-stats",
    route: "/",
    side: "bottom",
    title: "Tes chiffres du jour",
    body: "Relances à faire, faites cette semaine, valeur du pipeline, taux de réussite.",
    action: "Clique une carte pour aller à l'écran correspondant",
  },
  {
    id: "onboarding",
    target: "onboarding",
    route: "/",
    side: "bottom",
    title: "Tes trois premiers pas",
    body: "Ce bloc disparaît une fois les trois faits.",
    action: "Importer, connecter l'agenda, activer la relance auto",
  },

  // --- Le cœur : les relances ----------------------------------------------
  {
    id: "today",
    target: "nav-today",
    route: "/today",
    side: "right",
    title: "Aujourd'hui",
    body: "L'écran à ouvrir chaque matin. En retard, aujourd'hui, à venir.",
  },
  {
    id: "today-done",
    target: "task-complete",
    route: "/today",
    side: "right",
    title: "Terminer une relance",
    body: "Le rond à gauche de chaque ligne.",
    action: "Un clic : c'est fait, et l'événement quitte ton agenda",
  },
  {
    id: "today-more",
    target: "task-menu",
    route: "/today",
    side: "left",
    title: "Reporter ou supprimer",
    body: "Les trois points ouvrent le menu.",
    action: "Reporter à demain, dans 3 jours, dans 1 semaine",
  },

  // --- Le calendrier --------------------------------------------------------
  {
    id: "calendar",
    target: "nav-calendar",
    route: "/calendar",
    side: "right",
    title: "Le calendrier",
    body: "Les mêmes relances, vues mois par mois.",
    action: "Attrape une carte et dépose-la sur un autre jour",
  },

  // --- Le pipeline ----------------------------------------------------------
  {
    id: "pipeline",
    target: "nav-pipeline",
    route: "/pipeline",
    side: "right",
    title: "Le pipeline",
    body: "Tes opportunités, colonne par colonne.",
    action: "Fais glisser une carte pour la faire avancer",
  },
  {
    id: "pipeline-rename",
    target: "stage-name",
    route: "/pipeline",
    side: "bottom",
    title: "Renommer une colonne",
    body: "Les étapes sont les tiennes, pas les miennes.",
    action: "Clique sur le nom pour le changer, sur la pastille pour la couleur",
  },
  {
    id: "pipeline-new",
    target: "action-new-deal",
    route: "/pipeline",
    side: "bottom",
    title: "Ajouter une opportunité",
    body: "Titre, entreprise, montant, étape de départ.",
  },

  // --- Les contacts ---------------------------------------------------------
  {
    id: "contacts",
    target: "nav-contacts",
    route: "/contacts",
    side: "right",
    title: "Contacts",
    body: "Tes entreprises d'un côté, les personnes de l'autre.",
    action: "Les deux onglets, juste au-dessus de la liste",
  },
  {
    id: "contacts-select",
    target: "select-all",
    route: "/contacts",
    side: "bottom",
    title: "Agir sur plusieurs fiches",
    body: "Coche des lignes : une barre d'actions apparaît en bas.",
    action: "Taguer, créer des opportunités, supprimer — d'un coup",
  },
  {
    id: "contacts-import",
    target: "action-import",
    route: "/contacts",
    side: "bottom",
    title: "Reprendre ton tableur",
    body: "Excel ou CSV. Les colonnes sont reconnues toutes seules.",
    action: "Dépose ton fichier, vérifie, importe",
  },
  {
    id: "fiche",
    route: "/contacts",
    title: "Modifier une fiche",
    body: "Ouvre une entreprise en cliquant son nom. Sur sa fiche, presque tout se modifie au clic — y compris le grand titre.",
    action: "Un petit crayon signale ce qui est modifiable",
  },

  // --- Le geste à prendre ---------------------------------------------------
  {
    id: "search",
    target: "quick-add",
    side: "bottom",
    title: "⌘K — le raccourci à retenir",
    body: "Depuis n'importe où : chercher, ou créer en tapant un nom.",
    action: "Essaie maintenant : ⌘K, ou Ctrl+K sous Windows",
  },

  // --- Automatiser ----------------------------------------------------------
  {
    id: "automations",
    target: "nav-automations",
    route: "/automations",
    side: "right",
    title: "Les automatisations",
    body: "« Quand un prospect passe en Contacté, crée une relance à J+5. »",
  },
  {
    id: "recipes",
    target: "recipes",
    route: "/automations",
    side: "top",
    title: "Quatre recettes toutes faites",
    body: "Rien à configurer. La première est la plus utile.",
    action: "Clique « Activer » sur la relance systématique",
  },

  // --- Personnaliser --------------------------------------------------------
  {
    id: "settings",
    target: "nav-settings",
    route: "/settings/workspace",
    side: "right",
    title: "Les réglages",
    body: "Sept onglets : espace, membres, e-mails, intégrations, API, corbeille.",
  },
  {
    id: "branding",
    target: "branding",
    route: "/settings/workspace",
    side: "bottom",
    title: "Tes couleurs, ton logo",
    body: "Change la couleur d'accent : toute l'interface suit.",
    action: "L'aperçu se met à jour pendant que tu choisis",
  },
  {
    id: "integrations",
    target: "nav-settings",
    route: "/settings/integrations",
    side: "right",
    title: "Connecter ton agenda",
    body: "C'est ce qui transforme une relance en vrai rappel.",
    action: "Onglet Intégrations → Connecter Google Agenda",
  },
  {
    id: "trash",
    route: "/settings/trash",
    title: "Rien n'est jamais perdu",
    body: "Tout ce que tu supprimes reste trente jours dans la corbeille.",
    action: "Réglages → Corbeille → Restaurer",
  },

  {
    id: "done",
    title: "À toi de jouer",
    body: "Commence par importer ton fichier. Pour revoir cette visite : Réglages → Espace, tout en bas.",
  },
];
