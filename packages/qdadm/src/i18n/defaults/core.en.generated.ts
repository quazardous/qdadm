/* GENERATED from core.en.yml — DO NOT EDIT.
 * Run `npm run gen:i18n-defaults -w packages/qdadm` to regenerate. */
export default `core:
  actions:
    save: Save
    cancel: Cancel
    delete: Delete
    edit: Edit
    create: Create
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
    readError: "Could not read the task ({error}), still trying"
    start: Start
    dontStart: Do not start
    typeToConfirm: "Type {value} to confirm"
    tray: "{count} running task | {count} running tasks"
    trayDone: Recent tasks
    clear: Clear finished
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
  # VanillaYamlEditor and YamlConfigEditor (#4303)
  yamlEditor:
    text: Text
    tree: Form
    modes: View
    syntaxBlocked: Fix the syntax errors before switching to the form
    syntaxErrors: "{count} syntax error | {count} syntax errors"
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
    takeTheirs: Load their version
    keepMine: Keep mine and save over it
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
