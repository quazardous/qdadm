/* GENERATED from core.en.yml — DO NOT EDIT.
 * Run `npm run gen:i18n-defaults -w packages/qdadm` to regenerate. */
export default `core:
  # A filter's "all" choice (#4692)
  filters:
    all: "All {field}"
  # The table's own column headers (#4686)
  table:
    actions: Actions
  # Boolean values (#4686)
  values:
    "yes": "Yes"
    "no": "No"
  actions:
    save: Save
    cancel: Cancel
    delete: Delete
    edit: Edit
    create: Create
    createEntity: "Create {entity}"
    update: Update
    createAndClose: Create & Close
    updateAndClose: Update & Close
    add: Add
    remove: Remove
    submit: Submit
    reset: Reset
    back: Back
    view: View
    next: Next
    previous: Previous
    close: Close
    confirm: Confirm
    search: Search
    filter: Filter
    clear: Clear
    refresh: Refresh
    export: Export
    import: Import
    logout: Logout
    profile: My profile
  tooltips:
    saveAndContinue: Save and continue editing
    saveAndReturn: Save and return to list
    unsavedChanges: Unsaved changes
  placeholders:
    search: Search…
    noSelection: Click to select…
  fields:
    id: ID
    created_at: Created at
    updated_at: Updated at
    created_by: Created by
    updated_by: Updated by
  messages:
    empty: No items available
    loading: Loading…
    noResults: No results
    noMatching: No matching items
    saved: Saved
    deleted: Deleted
    created: Created
    updated: Updated
    confirmDelete: Are you sure you want to delete this item?
    confirmDeleteTitle: Confirm Delete
    confirmDeleteItem: 'Delete {entity} "{label}"?'
    confirmDeleteThis: Are you sure you want to delete this {entity}?
    confirmBulkDelete: "Delete {count} {entities}?"
    confirmBulkDeleteTitle: Confirm Bulk Delete
  errors:
    required: Required
    tooShort: Too short (min {min})
    tooLong: Too long (max {max})
    invalid: Invalid value
    notFound: Not found
    unknown: An unknown error occurred
  # RoleGrantsEditor (#2313)
  roles:
    inherits: Inherits from
    inheritsHint: A role gets every grant of the roles it inherits from.
    noRoles: No other role to inherit from
    brings: "brings {count}"
    entities: Entities
    entity: Entity
    all: All
    ownRecords: own records
    others: Other grants
    othersHint: Wildcards and keys the registry does not know
    covers: "covers {count}"
    notRegistered: not registered
    remove: Remove
    via: "via {origin}"
  # LogStream (#4110)
  log:
    streaming: Streaming
    done: Complete
    stopped: Stopped
    failed: "Failed: {error}"
    lines: "{count} line | {count} lines"
    search: Search the log
    previous: Previous match
    next: Next match
    onlyMatches: Only matching lines
    errors: "{count} error | {count} errors"
    firstError: Go to the next error line
    wrap: Wrap long lines
    follow: Follow the end of the log
    download: Download the log
    copy: Copy the whole log
    copied: "Copied ({count} line) | Copied ({count} lines)"
    copyFailed: "Copy failed: {error}"
    newLines: "{count} new line, resume | {count} new lines, resume"
    empty: No output yet
  # EntityTimeline (#4111)
  timeline:
    actors: Filter by actor
    loading: Loading…
    empty: Nothing happened yet
    newEvents: "{count} new event | {count} new events"
    oldestFirst: Oldest first
    newestFirst: Newest first
  # PayloadViewer / PayloadDiff (#4112)
  payload:
    headers: "Headers ({count})"
    headerRow: First row is a header
    copy: Copy
    copied: Copied to the clipboard
    copyFailed: Could not copy
    download: Download
    showAll: "Show {count} row | Show all {count} rows"
    binary: "Binary content, {size}. First bytes:"
    malformed: "Not valid {format} ({error}), shown as text"
    expected: Expected
    captured: Captured
    identical: Identical
    unchanged: "{count} unchanged line | {count} unchanged lines"
    showSame: "Show {count} unchanged row | Show {count} unchanged rows"
    inline: Inline
    split: Side by side
  # EmailPreview (#4113)
  email:
    from: From
    to: To
    cc: Cc
    replyTo: Reply to
    date: Date
    noSubject: (no subject)
    allHeaders: "All headers ({count})"
    noParser: "A raw message needs a parser: pass parseMime from @quazardous/qdadm/email. Showing the source."
    tab:
      html: HTML
      text: Text
      source: Source
    imagesBlocked: "{count} remote image blocked | {count} remote images blocked"
    loadImages: Load images
    blockImages: Block images
    empty: This email has no body
    unnamed: (unnamed)
    inline: inline
    download: Download
  # TaskRunner (#4114)
  task:
    status:
      starting: Starting
      queued: Queued
      running: Running
      succeeded: Done
      failed: Failed
      cancelled: Cancelled
    cancel: Cancel the task
    close: Close
    background: Run in the background
    open: Open the task
    follow: Follow
    notRun: Not run yet
    readError: "Could not read the task ({error}), still trying"
    start: Start
    dontStart: Do not start
    typeToConfirm: "Type {value} to confirm"
    tray: "{count} running task | {count} running tasks"
    trayDone: Recent tasks
    clear: Clear finished
    # The phases frieze (#4655)
    phase:
      pending: To do
      running: Running
      done: Done
      failed: Failed
      cancelled: Cancelled
      skipped: Skipped
      subs: "{count} sub-phase | {count} sub-phases"
      filter: "Phase: {name}"
      showAll: Show the whole log
    # Tasks chained in one window (#4934)
    sequence:
      progress: "{done}/{total}"
      step: "Step {n}"
      pending: Waiting
      skipped: Not run
      why:
        error: An earlier step failed
        cancelled: The sequence was stopped
        reload: The page was reloaded
      back: Back to the list
      details: Show this step
      cancel: Stop the sequence
  # Waiting states (#4665)
  pending:
    reading: Reading…
    unavailable: Unavailable
    failed: "Could not read: {error}"
    retry: Retry
  # LoginPage (#4168)
  login:
    username: Username
    password: Password
    submit: Sign In
    or: or
    welcome: Welcome
    loggedInAs: "Logged in as {name}"
    failed: Login Failed
    invalidCredentials: Invalid credentials
    configError: Configuration Error
    noAuthAdapter: No auth adapter configured
    # Identity provider first (#4321)
    sso: Sign in
    providerHome: My account
    localFallback: Alternative login
    localSection: Alternative login
    noSso: No sign-in flow configured for this button
  # CardsDashboard (#4320)
  cardsDashboard:
    saveFailed: Could not save the arrangement
    saveFailedDetail: It stays as shown; try again.
    customise: Customise
    done: Done
    reset: Reset
    resetDone: Default arrangement restored
    hidden: Hidden cards
    noneHidden: None
    move: "Move {title}"
    moved: "{title}: card {position} of {total}"
    help: Arrow keys move the card, Home and End to the start or the end
    dragCancelled: Move cancelled
    pin: "Pin {title} at the top"
    unpin: "Unpin {title}"
    pinnedOne: "{title} pinned at the top"
    unpinnedOne: "{title} unpinned"
    hide: "Hide {title}"
    hiddenOne: "{title} hidden"
    restore: "Show {title}"
    restoredOne: "{title} shown"
    show: Show
    trayView: Show hidden cards as
    viewCards: Cards
    viewCompact: Compact
    # The catalogue, cards with parameters, sizes, sections (#5348)
    addCard: Add a card
    catalogue: Add a card
    catalogueEmpty: Every card is already on the board
    hiddenNow: "Hidden: it comes back where it was"
    add: Add
    addOne: "Add {title}"
    added: "{title} added"
    remove: "Remove {title}"
    removed: "{title} removed"
    cardTitle: Title
    choose: Choose…
    inSection: In the section
    paramRequired: Fill this in
    paramInvalid: "Not a valid value: {problem}"
    size: "Size of {title}"
    sizeS: Small
    sizeM: Medium
    sizeL: Large
    resized: "{title}: {size}"
    addSection: Add a section
    firstSection: Main
    newSection: New section
    sectionName: Name of the section
    sectionAdded: "Section {title} added"
    removeSection: "Remove the section {title}"
    sectionRemoved: "Section {title} removed, its cards moved to the first one"
    section: "Section of {title}"
    movedToSection: "{title} moved to {section}"
  # SessionsModule (#4336)
  sessions:
    title: Sessions
    banner: "Also signed in: {list}"
    bannerOne: "{name} (since {since})"
    present: Signed in now
    refresh: Refresh
    nobody: Nobody is signed in.
    who: Who
    via: Via
    since: Since
    seen: Last seen
    tabs: Tabs
    origin: Origin
    mine: you
    close: Close
    closeTitle: "Close the session of {name}"
    reasonPrompt: Why? It goes into the history.
    cancel: Cancel
    history: History
    noHistory: No history yet.
    when: When
    event:
      login: Signed in
      logout: Signed out
      refused: Refused
      closed: Closed
      expired: Expired
    by: By
    reason: Reason
    source: Source
    newer: Newer
    older: Older
  # NotificationPanel and NotificationBadge (#4171)
  notifications:
    title: Notifications
    unread: "Notifications, {count} unread"
    loading: Loading
    markAllRead: Mark all read
    clearAll: Clear all
    close: Close
    dismiss: Dismiss
    empty: No notifications
    justNow: just now
    minutesAgo: "{count}m ago"
    hoursAgo: "{count}h ago"
  # AppBanner (#4200)
  banner:
    label: Environment notice
    previous: Previous message
    next: Next message
    position: "{index} of {count}"
    close: Close this message
  # formatBytes in qdadm's own components (#4384)
  units:
    bytes:
      b: B
      kb: KB
      mb: MB
      gb: GB
      tb: TB
  # VanillaYamlEditor and YamlConfigEditor (#4303)
  yamlEditor:
    text: Text
    tree: Tree
    form: Form
    modes: View
    syntaxBlocked: "Fix the syntax errors before switching to the tree or the form"
    syntaxErrors: "{count} syntax error | {count} syntax errors"
    warnings: "{count} warning | {count} warnings"
    colonKey: 'The key is "{key}": did you mean "{suggestion}:"?'
    spacedKey: 'The key "{key}" starts or ends with a space'
    addItem: Add item
    addKey: Add
    newKey: new key
    remove: Remove
    rename: Key name
    empty: (empty)
    alias: An alias, edit it in the text view
    count: "{count} entry | {count} entries"
    loading: Loading
    loadError: "Could not load: {message}"
    readOnly: Read only
    unsaved: Unsaved changes
    upToDate: Up to date
    check: Check
    checkOk: No problem found
    problems: "{count} problem | {count} problems"
    save: Save…
    review: Review the change
    noChange: Nothing changed
    reason: Reason
    reasonPlaceholder: Why this change? It goes into the history.
    confirmSave: Save
    saved: Saved
    saveError: "Could not save: {message}"
    cancel: Cancel
    revert: Discard changes
    before: Before
    after: After
    history: History
    historyEmpty: No history yet
    restore: Load this version
    restored: "Version {revision} loaded: review and save it to restore it"
    conflictTitle: Changed meanwhile
    conflictText: Someone saved this document after you opened it. Their version is on the left, yours on the right.
    changedKeys: "Changed:"
    theyChanged: "They changed:"
    moreKeys: "+{count} more"
    takeTheirs: Load their version
    keepMine: Keep mine and save over it
  # Cards (#5339): the envelope's words and the generic cards'
  cards:
    status:
      critical: Critical
      watch: To watch
      good: Good
      info: Info
    loading: Loading…
    unreachable: Source unreachable
    galleryUnreachable: "The source did not answer (timeout after 10 s)"
    empty: Nothing to report
    invalid: Invalid data
    moreProblems: "and {count} more"
    overdue: overdue
    ageUnit:
      min: min
      h: h
      d: d
    goal:
      of: "of {target}"
      reached: "{share} of the target"
      pace: "expected on {date}: {share}"
      ahead: ahead
      behind: behind
    bullet:
      target: "target {target}"
      aria: "{value}: {range}"
      poor: Poor
      fair: Fair
      good: Good
  # PermissionEditor (#5333)
  permissionEditor:
    placeholder: Type a permission…
    help: 'Type a permission (e.g. "entity:books:read"), Tab to complete'
    noMatch: No matching permission
    noPermissions: No permission to suggest
    all: All permissions
    actionEverywhere: "{action}, everywhere"
    anActionEverywhere: One action, everywhere
    allUnder: "Everything under {prefix}"
    directUnder: "Every {prefix} permission, one level"
    actionUnder: "{action} under {prefix}"
    subItems: "{count} sub-item | {count} sub-items"
  # StructuredField: a structured face and a raw JSON / YAML one (#5333)
  structuredField:
    structured: Structured
    invalid: "Invalid {format}: fix it before switching views"
  # Values a create reveals once: a key's token (QdRevealOnce, #5319)
  revealOnce:
    title: "{entity} created"
    warning: Copy it now. It is shown only this once and cannot be read again.
    copy: Copy
    copied: Copied
    copyFailed: "Copy failed: {error}"
    confirm: I have copied it
  # The run bar: walking a set of items one after the other (QdRunBar, useRun, #5343)
  run:
    bar: Run
    position: "{position} of {total}"
    order: "sorted by {order}"
    filter: "filter: {filter}"
    doneSince: "{count} done since it started | {count} done since it started"
    prev: Previous
    next: Next
    saveAndNext: Save and go to the next
    finished: "The item is done | The {count} items are done"
    state:
      current: current
      done: done
      urgent: urgent
      todo: to do
  # Favourites and recents: the star, "Save this search", the two cards (#5349)
  favorites:
    add: "Add {label} to favourites"
    remove: "Remove {label} from favourites"
    saveSearch: Save this search
    searchSaved: Search saved
    searchName: Name of the search
    save: Save
    title: Favourites
    none: "No favourites yet: the star beside a page title adds one"
    recentTitle: Recent
    noneRecent: Nothing opened yet
    noEntity: No favorites entity is declared
    noRecentsEntity: No recents entity is declared
    kind:
      item: Records
      list: Lists
      search: Searches
      board: Boards
  # A domain's board (QdDomainBoard, #5352)
  board:
    source: "Source: {source}"
    readAt: "read {when}"
    openSource: "open {source}"
    retry: Try again
    change: "{change} on the period before"
    same: Same as the period before
    timelineBars: "Volume from {from} to {to}"
  # NotFoundPage
  notFound:
    title: Page not found
    message: The page you're looking for doesn't exist or has been moved.
    home: Back to Home
# The breadcrumb (useBreadcrumb, useNavContext, PageNav).
breadcrumb:
  home: Home
  dashboard: Dashboard
  details: Details
  view: View
  edit: Edit
`
