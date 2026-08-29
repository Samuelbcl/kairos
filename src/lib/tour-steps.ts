/**
 * Contenu de la visite guidée — partagé serveur et client.
 *
 * Chaque étape vise un élément réel de l'interface par son attribut
 * `data-tour`. Une étape dont la cible est absente de la page courante est
 * sautée automatiquement : la visite ne se bloque jamais sur un écran étroit
 * où la barre latérale est masquée.
 */

export type TourStep = {
  id: string;
  /** Valeur de l'attribut data-tour à mettre en avant. Absent = étape centrée. */
  target?: string;
  title: string;
  body: string;
  /** Page à ouvrir avant d'afficher l'étape. */
  route?: string;
  /** Côté préféré pour la bulle. */
  side?: "top" | "bottom" | "left" | "right";
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Bienvenue dans ton CRM",
    body: "Deux minutes pour faire le tour. Kairos sert à une chose avant tout : ne jamais rater une relance. Tout le reste est là pour servir ça. Tu peux quitter à tout moment et reprendre depuis les réglages.",
  },
  {
    id: "dashboard",
    target: "nav-dashboard",
    route: "/",
    side: "right",
    title: "Le tableau de bord",
    body: "Ton point de départ chaque matin : combien de relances t'attendent, combien tu en as faites cette semaine, ce que vaut ton pipeline, et ton taux de réussite.",
  },
  {
    id: "today",
    target: "nav-today",
    route: "/today",
    side: "right",
    title: "Aujourd'hui — l'écran le plus important",
    body: "Tes relances en retard, celles du jour, celles des sept prochains jours. Coche le rond vert pour en terminer une, ou reporte-la d'un clic. En bas, les opportunités qui dorment depuis plus de deux semaines.",
  },
  {
    id: "calendar",
    target: "nav-calendar",
    route: "/calendar",
    side: "right",
    title: "Le calendrier",
    body: "Les mêmes relances, vues mois par mois. Attrape une carte et dépose-la sur un autre jour pour la reporter : l'heure est conservée, et si ton agenda Google est connecté, l'événement suit tout seul.",
  },
  {
    id: "pipeline",
    target: "nav-pipeline",
    route: "/pipeline",
    side: "right",
    title: "Le pipeline",
    body: "Tes opportunités, colonne par colonne. Fais glisser une carte pour la faire avancer. Clique sur le nom d'une colonne pour la renommer, sur la pastille de couleur pour la changer — c'est ton pipeline, pas le mien.",
  },
  {
    id: "contacts",
    target: "nav-contacts",
    route: "/contacts",
    side: "right",
    title: "Contacts",
    body: "Tes entreprises d'un côté, les personnes de l'autre. Coche plusieurs lignes pour agir en masse : ajouter un tag, créer des opportunités, supprimer. Rien n'est perdu, tout part à la corbeille pour trente jours.",
  },
  {
    id: "import",
    target: "action-import",
    route: "/contacts",
    side: "bottom",
    title: "Reprendre ton tableur",
    body: "Dépose ton fichier Excel ou CSV : les colonnes sont reconnues toutes seules, les doublons écartés. Tu peux même créer une opportunité par ligne pour retrouver tout ton fichier dans le pipeline.",
  },
  {
    id: "search",
    target: "quick-add",
    side: "bottom",
    title: "La barre de recherche — ⌘K",
    body: "Le raccourci le plus utile. Appuie sur ⌘K (ou Ctrl+K) depuis n'importe où : tu cherches une entreprise, un contact, une opportunité, ou tu en crées une en tapant son nom. C'est le geste à prendre.",
  },
  {
    id: "automations",
    target: "nav-automations",
    route: "/automations",
    side: "right",
    title: "Les automatisations",
    body: "« Quand un prospect passe en Contacté, crée une relance à J+5 et pose-la dans mon agenda. » Quatre recettes s'activent en un clic, et tu peux composer les tiennes en langage courant, sans écrire une ligne.",
  },
  {
    id: "settings",
    target: "nav-settings",
    route: "/settings/workspace",
    side: "right",
    title: "Les réglages",
    body: "Tes couleurs et ton logo, les étapes du pipeline, les tags, les champs sur mesure, tes modèles d'e-mail, la connexion à ton agenda, les clés API, et la corbeille. Tout se personnalise ici.",
  },
  {
    id: "done",
    title: "C'est à toi",
    body: "Commence par importer ton fichier, connecte ton agenda, puis active la relance automatique — les trois cartes du tableau de bord t'y emmènent. Pour revoir cette visite : Réglages → Espace, tout en bas.",
  },
];
