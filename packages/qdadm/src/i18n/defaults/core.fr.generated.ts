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
    copy: Copier tout le log
    copied: "Copié ({count} ligne) | Copié ({count} lignes)"
    copyFailed: "Échec de la copie : {error}"
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
  # LoginPage (#4168)
  login:
    username: Identifiant
    password: Mot de passe
    submit: Se connecter
    or: ou
    welcome: Bienvenue
    loggedInAs: "Connecté en tant que {name}"
    failed: Échec de la connexion
    invalidCredentials: Identifiants invalides
    configError: Erreur de configuration
    noAuthAdapter: Aucun adaptateur d'authentification configuré
    # Identity provider first (#4321)
    sso: Se connecter
    providerHome: Mon compte
    localFallback: Login alternatif
    localSection: Login alternatif
    noSso: Aucun parcours de connexion configuré pour ce bouton
  # CardsDashboard (#4320)
  cardsDashboard:
    saveFailed: La disposition n'a pas pu être enregistrée
    saveFailedDetail: Elle reste telle qu'affichée ; réessayez.
    customise: Personnaliser
    done: Terminé
    reset: Réinitialiser
    resetDone: Disposition par défaut rétablie
    hidden: Cartes masquées
    noneHidden: Aucune
    move: "Déplacer {title}"
    moved: "{title} : carte {position} sur {total}"
    help: Les flèches déplacent la carte, Début et Fin vers le début ou la fin
    dragCancelled: Déplacement annulé
    pin: "Épingler {title} en haut"
    unpin: "Désépingler {title}"
    pinnedOne: "{title} épinglée en haut"
    unpinnedOne: "{title} désépinglée"
    hide: "Masquer {title}"
    hiddenOne: "{title} masquée"
    restore: "Afficher {title}"
    restoredOne: "{title} affichée"
    show: Afficher
    trayView: Afficher les cartes masquées en
    viewCards: Cartes
    viewCompact: Compact
  # SessionsModule (#4336)
  sessions:
    title: Sessions
    banner: "Aussi connecté : {list}"
    bannerOne: "{name} (depuis {since})"
    present: Connectés maintenant
    refresh: Rafraîchir
    nobody: Personne n'est connecté.
    who: Qui
    via: Via
    since: Depuis
    seen: Vu
    tabs: Onglets
    origin: Origine
    mine: vous
    close: Fermer
    closeTitle: "Fermer la session de {name}"
    reasonPrompt: Pourquoi ? Le motif va dans l'historique.
    cancel: Annuler
    history: Historique
    noHistory: Pas encore d'historique.
    when: Quand
    event:
      login: Connexion
      logout: Déconnexion
      refused: Refus
      closed: Fermeture
      expired: Expiration
    by: Par
    reason: Motif
    source: Source
    newer: Plus récent
    older: Plus ancien
  # NotificationPanel and NotificationBadge (#4171)
  notifications:
    title: Notifications
    unread: "Notifications, {count} non lue | Notifications, {count} non lues"
    loading: Chargement
    markAllRead: Tout marquer comme lu
    clearAll: Tout effacer
    close: Fermer
    dismiss: Retirer
    empty: Aucune notification
    justNow: à l'instant
    minutesAgo: "il y a {count} min"
    hoursAgo: "il y a {count} h"
  # AppBanner (#4200)
  banner:
    label: Bandeau d'information
    previous: Message précédent
    next: Message suivant
    position: "{index} sur {count}"
    close: Fermer ce message
  # VanillaYamlEditor and YamlConfigEditor (#4303)
  yamlEditor:
    text: Texte
    tree: Formulaire
    modes: Vue
    syntaxBlocked: Corrigez les erreurs de syntaxe avant de passer au formulaire
    syntaxErrors: "{count} erreur de syntaxe | {count} erreurs de syntaxe"
    addItem: Ajouter un élément
    addKey: Ajouter
    newKey: nouvelle clé
    remove: Retirer
    rename: Nom de la clé
    empty: (vide)
    alias: Un alias, à modifier dans la vue texte
    count: "{count} entrée | {count} entrées"
    loading: Chargement
    loadError: "Chargement impossible : {message}"
    readOnly: Lecture seule
    unsaved: Modifications non enregistrées
    upToDate: À jour
    check: Vérifier
    checkOk: Aucun problème trouvé
    problems: "{count} problème | {count} problèmes"
    save: Enregistrer…
    review: Relire la modification
    noChange: Rien n'a changé
    reason: Motif
    reasonPlaceholder: Pourquoi ce changement ? Il figure dans l'historique.
    confirmSave: Enregistrer
    saved: Enregistré
    saveError: "Enregistrement impossible : {message}"
    cancel: Annuler
    revert: Abandonner les modifications
    before: Avant
    after: Après
    history: Historique
    historyEmpty: Pas encore d'historique
    restore: Charger cette version
    restored: "Version {revision} chargée : relisez-la et enregistrez-la pour la restaurer"
    conflictTitle: Modifié entre-temps
    conflictText: Quelqu'un a enregistré ce document après votre ouverture. Sa version est à gauche, la vôtre à droite.
    takeTheirs: Charger sa version
    keepMine: Garder la mienne et l'enregistrer par-dessus
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
