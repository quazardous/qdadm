/* GENERATED from core.fr.yml — DO NOT EDIT.
 * Run `npm run gen:i18n-defaults -w packages/qdadm` to regenerate. */
export default `core:
  actions:
    save: Enregistrer
    cancel: Annuler
    delete: Supprimer
    edit: Modifier
    create: Créer
    update: Mettre à jour
    createAndClose: Créer et fermer
    updateAndClose: Mettre à jour et fermer
    add: Ajouter
    remove: Retirer
    submit: Valider
    reset: Réinitialiser
    back: Retour
    view: Voir
    next: Suivant
    previous: Précédent
    close: Fermer
    confirm: Confirmer
    search: Rechercher
    filter: Filtrer
    clear: Effacer
    refresh: Actualiser
    export: Exporter
    import: Importer
    logout: Se déconnecter
    profile: Mon profil
  tooltips:
    saveAndContinue: Enregistrer et continuer la modification
    saveAndReturn: Enregistrer et revenir à la liste
    unsavedChanges: Modifications non enregistrées
  placeholders:
    search: Rechercher…
    noSelection: Cliquez pour sélectionner…
  fields:
    id: Identifiant
    created_at: Créé le
    updated_at: Modifié le
    created_by: Créé par
    updated_by: Modifié par
  messages:
    empty: Aucun élément
    loading: Chargement…
    noResults: Aucun résultat
    noMatching: Aucune correspondance
    saved: Enregistré
    deleted: Supprimé
    created: Créé
    updated: Modifié
    confirmDelete: Êtes-vous sûr de vouloir supprimer cet élément ?
    confirmDeleteTitle: Confirmer la suppression
    confirmDeleteItem: "Supprimer {entity} « {label} » ?"
    confirmDeleteThis: "Êtes-vous sûr de vouloir supprimer cet élément ({entity}) ?"
  errors:
    required: Requis
    tooShort: Trop court (min {min})
    tooLong: Trop long (max {max})
    invalid: Valeur invalide
    notFound: Introuvable
    unknown: Une erreur inconnue est survenue
  # RoleGrantsEditor (#2313)
  roles:
    inherits: Hérite de
    inheritsHint: Un rôle reçoit toutes les permissions des rôles dont il hérite.
    noRoles: Aucun autre rôle dont hériter
    brings: "apporte {count}"
    entities: Entités
    entity: Entité
    all: Tout
    ownRecords: ses propres enregistrements
    others: Autres permissions
    othersHint: Jokers et clés que le registre ne connaît pas
    covers: "couvre {count}"
    notRegistered: non enregistrée
    remove: Retirer
    via: "via {origin}"
  # LogStream (#4110)
  log:
    streaming: En cours
    done: Terminé
    stopped: Arrêté
    failed: "Échec : {error}"
    lines: "{count} ligne | {count} lignes"
    search: Chercher dans le log
    previous: Occurrence précédente
    next: Occurrence suivante
    onlyMatches: Seulement les lignes trouvées
    errors: "{count} erreur | {count} erreurs"
    firstError: Aller à la ligne d'erreur suivante
    wrap: Couper les lignes longues
    follow: Suivre la fin du log
    download: Télécharger le log
    newLines: "{count} nouvelle ligne, reprendre | {count} nouvelles lignes, reprendre"
    empty: Rien pour l'instant
  # EntityTimeline (#4111)
  timeline:
    actors: Filtrer par acteur
    loading: Chargement…
    empty: Rien ne s'est encore passé
    newEvents: "{count} nouvel événement | {count} nouveaux événements"
    oldestFirst: Plus anciens d'abord
    newestFirst: Plus récents d'abord
  # PayloadViewer / PayloadDiff (#4112)
  payload:
    headers: "En-têtes ({count})"
    headerRow: La première ligne est un en-tête
    copy: Copier
    copied: Copié dans le presse-papiers
    copyFailed: Copie impossible
    download: Télécharger
    showAll: "Afficher {count} ligne | Afficher les {count} lignes"
    binary: "Contenu binaire, {size}. Premiers octets :"
    malformed: "{format} invalide ({error}), affiché comme texte"
    expected: Attendu
    captured: Capturé
    identical: Identiques
    unchanged: "{count} ligne inchangée | {count} lignes inchangées"
    showSame: "Afficher {count} ligne inchangée | Afficher les {count} lignes inchangées"
    inline: En ligne
    split: Côte à côte
  # EmailPreview (#4113)
  email:
    from: De
    to: À
    cc: Cc
    replyTo: Répondre à
    date: Date
    noSubject: (sans objet)
    allHeaders: "Tous les en-têtes ({count})"
    noParser: "Un message brut demande un parser : passer parseMime de @quazardous/qdadm/email. La source est affichée."
    tab:
      html: HTML
      text: Texte
      source: Source
    imagesBlocked: "{count} image distante bloquée | {count} images distantes bloquées"
    loadImages: Charger les images
    blockImages: Bloquer les images
    empty: Ce mail n'a pas de contenu
    unnamed: (sans nom)
    inline: intégrée
    download: Télécharger
  # TaskRunner (#4114)
  task:
    status:
      starting: Démarrage
      queued: En attente
      running: En cours
      succeeded: Terminée
      failed: Échouée
      cancelled: Annulée
    cancel: Annuler la tâche
    close: Fermer
    background: Continuer en arrière-plan
    open: Ouvrir la tâche
    readError: "Lecture de la tâche impossible ({error}), nouvel essai"
    start: Lancer
    dontStart: Ne pas lancer
    typeToConfirm: "Taper {value} pour confirmer"
    tray: "{count} tâche en cours | {count} tâches en cours"
    trayDone: Tâches récentes
    clear: Effacer les terminées
  # NotFoundPage
  notFound:
    title: Page introuvable
    message: La page demandée n'existe pas ou a été déplacée.
    home: Retour à l'accueil
# The breadcrumb (useBreadcrumb, useNavContext, PageNav).
breadcrumb:
  home: Accueil
  dashboard: Tableau de bord
  details: Détails
  view: Voir
  edit: Modifier
`
