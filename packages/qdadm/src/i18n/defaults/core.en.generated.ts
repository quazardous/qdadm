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
    lines: "{count} lines"
    search: Search the log
    previous: Previous match
    next: Next match
    onlyMatches: Only matching lines
    errors: "{count} errors"
    firstError: Go to the next error line
    wrap: Wrap long lines
    follow: Follow the end of the log
    download: Download the log
    newLines: "{count} new lines, resume"
    empty: No output yet
  # EntityTimeline (#4111)
  timeline:
    actors: Filter by actor
    loading: Loading…
    empty: Nothing happened yet
    newEvents: "{count} new events"
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
    showAll: "Show all {count} rows"
    binary: "Binary content, {size}. First bytes:"
    malformed: "Not valid {format} ({error}), shown as text"
    expected: Expected
    captured: Captured
    identical: Identical
    unchanged: "{count} unchanged lines"
    showSame: "Show {count} unchanged rows"
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
    imagesBlocked: "{count} remote images blocked"
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
    tray: "{count} running tasks"
    trayDone: Recent tasks
    clear: Clear finished
# The breadcrumb's View↔Edit toggle (useNavContext).
breadcrumb:
  view: View
  edit: Edit
`
