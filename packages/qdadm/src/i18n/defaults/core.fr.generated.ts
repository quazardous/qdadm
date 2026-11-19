/* GENERATED from core.fr.yml — DO NOT EDIT.
 * Run `npm run gen:i18n-defaults -w packages/qdadm` to regenerate. */
export default `core:
  # A filter's "all" choice (#4692)
  filters:
    all: "Tous : {field}"
  # The table's own column headers (#4686)
  table:
    actions: Actions
  # Boolean values (#4686)
  values:
    "yes": Oui
    "no": Non
  actions:
    save: Enregistrer
    cancel: Annuler
    delete: Supprimer
    edit: Modifier
    create: Créer
    createEntity: "Créer : {entity}"
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
    confirmBulkDelete: "Supprimer {count} {entities} ?"
    confirmBulkDeleteTitle: Confirmer la suppression groupée
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
    follow: Suivre
    notRun: Pas encore lancée
    readError: "Lecture de la tâche impossible ({error}), nouvel essai"
    start: Lancer
    dontStart: Ne pas lancer
    typeToConfirm: "Taper {value} pour confirmer"
    tray: "{count} tâche en cours | {count} tâches en cours"
    trayDone: Tâches récentes
    clear: Effacer les terminées
    # The phases frieze (#4655)
    phase:
      pending: À venir
      running: En cours
      done: Faite
      failed: En échec
      cancelled: Annulée
      skipped: Sautée
      subs: "{count} sous-phase | {count} sous-phases"
      filter: "Phase : {name}"
      showAll: Voir tout le journal
    # Tasks chained in one window (#4934)
    sequence:
      progress: "{done}/{total}"
      step: "Étape {n}"
      pending: En attente
      skipped: Non lancée
      why:
        error: Une étape précédente a échoué
        cancelled: La suite a été arrêtée
        reload: La page a été rechargée
      back: Retour à la liste
      details: Voir cette étape
      cancel: Arrêter la suite
  # Waiting states (#4665)
  pending:
    reading: Lecture…
    unavailable: Indisponible
    failed: "Lecture impossible : {error}"
    retry: Réessayer
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
    # Le catalogue, les cartes à paramètres, les tailles, les sections (#5348)
    addCard: Ajouter une carte
    catalogue: Ajouter une carte
    catalogueEmpty: Toutes les cartes sont déjà sur le tableau
    hiddenNow: "Cachée : elle revient à sa place"
    add: Ajouter
    addOne: "Ajouter {title}"
    added: "{title} ajoutée"
    remove: "Retirer {title}"
    removed: "{title} retirée"
    cardTitle: Titre
    choose: Choisir…
    inSection: Dans la section
    paramRequired: À remplir
    paramInvalid: "Valeur invalide : {problem}"
    size: "Taille de {title}"
    sizeS: Petite
    sizeM: Moyenne
    sizeL: Grande
    resized: "{title} : {size}"
    addSection: Ajouter une section
    firstSection: Principal
    newSection: Nouvelle section
    sectionName: Nom de la section
    sectionAdded: "Section {title} ajoutée"
    removeSection: "Supprimer la section {title}"
    sectionRemoved: "Section {title} supprimée, ses cartes vont dans la première"
    section: "Section de {title}"
    movedToSection: "{title} déplacée dans {section}"
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
  # formatBytes in qdadm's own components (#4384)
  units:
    bytes:
      b: o
      kb: ko
      mb: Mo
      gb: Go
      tb: To
  # VanillaYamlEditor and YamlConfigEditor (#4303)
  yamlEditor:
    text: Texte
    tree: Arbre
    form: Formulaire
    modes: Vue
    syntaxBlocked: "Corrigez les erreurs de syntaxe avant de passer à l'arbre ou au formulaire"
    syntaxErrors: "{count} erreur de syntaxe | {count} erreurs de syntaxe"
    warnings: "{count} avertissement | {count} avertissements"
    colonKey: 'La clé est « {key} » : vouliez-vous dire « {suggestion}: » ?'
    spacedKey: 'La clé « {key} » commence ou finit par une espace'
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
    changedKeys: "Modifié :"
    theyChanged: "Modifié par l'autre :"
    moreKeys: "+{count} autres"
    takeTheirs: Charger sa version
    keepMine: Garder la mienne et l'enregistrer par-dessus
  # Cards (#5339): the envelope's words and the generic cards'
  cards:
    status:
      critical: Critique
      watch: À surveiller
      good: Bon
      info: Info
    loading: Lecture…
    unreachable: Source injoignable
    galleryUnreachable: "La source n'a pas répondu (délai de 10 s dépassé)"
    empty: Rien à signaler
    invalid: Données invalides
    moreProblems: "et {count} de plus"
    overdue: en retard
    ageUnit:
      min: min
      h: h
      d: j
    goal:
      of: "sur {target}"
      reached: "{share} de l'objectif"
      pace: "le {date}, le rythme attendu est {share}"
      ahead: en avance
      behind: en retard
    bullet:
      target: "cible {target}"
      aria: "{value} : {range}"
      poor: Mauvais
      fair: Juste
      good: Bon
  # PermissionEditor (#5333)
  permissionEditor:
    placeholder: Saisir un droit…
    help: 'Saisissez un droit (ex. « entity:books:read »), Tab pour compléter'
    noMatch: Aucun droit correspondant
    noPermissions: Aucun droit à proposer
    all: Tous les droits
    actionEverywhere: "{action}, partout"
    anActionEverywhere: Une action, partout
    allUnder: "Tout ce qui est sous {prefix}"
    directUnder: "Tous les droits de {prefix}, un niveau"
    actionUnder: "{action} sous {prefix}"
    subItems: "{count} sous-élément | {count} sous-éléments"
  # StructuredField: a structured face and a raw JSON / YAML one (#5333)
  structuredField:
    structured: Structuré
    invalid: "{format} invalide : corrigez-le avant de changer de vue"
  # Values a create reveals once: a key's token (QdRevealOnce, #5319)
  revealOnce:
    title: "{entity} : création réussie"
    warning: Copiez-la maintenant. Elle n'est montrée que cette fois et ne pourra plus être relue.
    copy: Copier
    copied: Copié
    copyFailed: "Échec de la copie : {error}"
    confirm: J'ai copié
  # La barre de parcours : traiter des éléments l'un après l'autre (QdRunBar, useRun, #5343)
  run:
    bar: Parcours
    position: "{position} sur {total}"
    order: "triés par {order}"
    filter: "filtre : {filter}"
    doneSince: "{count} traité depuis l'ouverture | {count} traités depuis l'ouverture"
    prev: Précédent
    next: Suivant
    saveAndNext: Enregistrer et passer au suivant
    finished: "L'élément est traité | Les {count} éléments sont traités"
    state:
      current: en cours
      done: traité
      urgent: urgent
      todo: à traiter
  # Favoris et récents : l'étoile, « Enregistrer cette recherche », les deux cartes (#5349)
  favorites:
    add: "Ajouter {label} aux favoris"
    remove: "Retirer {label} des favoris"
    saveSearch: Enregistrer cette recherche
    searchSaved: Recherche enregistrée
    searchName: Nom de la recherche
    save: Enregistrer
    title: Favoris
    none: "Aucun favori : l'étoile à côté du titre d'une page en ajoute un"
    recentTitle: Récents
    noneRecent: Rien d'ouvert pour l'instant
    noEntity: Aucune entité de favoris n'est déclarée
    noRecentsEntity: Aucune entité de récents n'est déclarée
    kind:
      item: Fiches
      list: Listes
      search: Recherches
      board: Tableaux
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
