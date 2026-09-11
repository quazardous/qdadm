# Changelog

## 1.3.0

### Minor Changes

- d031db8: The MCP tab's chat can send the agent an annotated screenshot (#2309).
  - A 📷 button takes a picture of the page without the debug bar, then opens an overlay: a pen in six colours, Undo, Clear, an optional note, Cancel and Send (Escape cancels, Ctrl+Z undoes).
  - Send posts the picture with the strokes as a chat message. The chat shows it as a thumbnail that opens full size.
  - The overlay and the zoom are part of the debug bar, so no screenshot or page tool ever sees them.
  - `RelayCollector` gains `canShoot`, `shoot()` and `sendChat(text, image?)`. A connector older than this offers no button.

- ffe9cd0: A 📷 among the debug bar's own buttons, and a prompt for real screenshots (#2318).
  - **📷 Screenshot** sits between Pause and Clear all, whatever tab is open, when an MCP connector can take pictures. Circle what you mean, add a note, Send: the picture goes to the agent's chat, and the bar opens on MCP → Chat. The 📷 in the chat input row is gone.
  - **Without a real capture, it asks first.** Allow real screenshots opens the browser's share prompt, and the prompt stays open until the tab is shared: a refused share says so. Continue without takes a picture rendered from the page, and is remembered for the browser tab.
  - **When an agent's screenshot is rendered from the page,** the same offer shows in a corner. It blocks nothing, goes away after 10 s, and comes back at most once a minute.

- 8324553: The MCP tab now counts what is new (#2285).
  - **The tab icon** shows the agent messages and agent requests the tab has not shown yet. It still asks for attention while a pairing code waits or something failed.
  - **Sub-tabs:**
    - Chat counts the unseen agent messages;
    - History counts the unseen requests, instead of showing the total;
    - Status shows a dot while the relay is offline, something failed, or a code waits.
  - Opening a sub-tab marks what it shows as seen. The marks are kept for the browser tab, so a reload does not bring old messages back as new, and what the tab held before this version is not counted.
  - `RelayCollector` exposes `unseenChat`, `unseenHistory`, `statusAlert`, `markChatSeen()` and `markHistorySeen()`. Its snapshot carries `unseen: { chat, history }`.

- 61ca221: `screenshot`, on the relay (#2247): a picture of the tab that the agent receives as an MCP image. It covers the viewport by default, one element with `ref`, or the whole page with `fullPage`.
  - By default the picture is rendered from the page's DOM by snapdom, loaded on the first screenshot. It needs no permission, and the debug bar is left out.
  - For the real pixels, the user clicks **Allow real screenshots** in the MCP tab of the debug bar. The browser asks them to share the tab, and screenshots use that capture until they click **Stop sharing**.
  - `source` forces either kind (`dom` or `tab`); `format` and `quality` set the encoding.
  - Pictures are kept to 1600 px on their longest edge.

- 557fc86: The debug bar gets an **MCP** tab (#2231), after i18n, where the app installed `@quazardous/qdadm-mcp/connector`. No connector, no tab.

  It shows how this browser tab reaches the relay:
  - **Dev page:** connected, with its instance id and the relay; or offline and retrying.
  - **Other pages:** **Pair**, then the code to give the agent, then **Unpair**. It also says when no relay answered, or when the browser holds the connection back: on a public https origin, Chrome waits for the user to allow local network access.

  The tab's **instance id** sits at the top of the panel: click it to copy it, and give it to your agent when several tabs are open. Three sub-tabs sit under it:
  - **Status**: the connection;
  - **Chat**: with the agent, badged while its messages are unread;
  - **History**: every MCP request the tab served, with tool, detail, success or error, and duration. Its badge lights while a code waits or on an error.

  `RelayCollector` and `RelayPanel` are exported from qddebug. The collector redacts the code from `snapshot()` and its actions: the debug bridge is readable over HTTP and MCP, and a code must reach the agent through a human. `debugBar({ relayCollector: false })` hides the tab.

## 1.2.0

### Minor Changes

- d2688d5: The debug bar suspends itself on a render loop, and no longer measures its own content

  **Circuit breaker.** Past 60 updates in one second the bar freezes and replaces
  itself with a plain notice saying why. A render loop throws nothing, so qdadm's
  error boundary cannot see it — the app simply stops responding. A consumer
  lived through exactly that, and their only exit was to rebuild without the bar.
  The window logic is a plain object holding no reactive state, so the counting
  can never itself schedule a render.

  **Never measure your own content.** The `ResizeObserver` used to watch the bar
  header — the very element whose contents it drives, since the measured width
  decides how the header's tabs render. It now watches the panel, whose width
  comes from the display mode and never from the tabs inside it, so the reading
  cannot feed itself. This was _not_ the cause of the loop reported earlier —
  that deduction was wrong and the consumer's measurement disproved it — and it
  is fixed here as hygiene.

  The compact-tab thresholds now see the panel's width rather than the header's,
  wider by the header's padding; they are heuristics at 400 and 600 pixels.

## 1.1.0

### Minor Changes

- 5588600: Fix a runaway reactivity loop that could kill a page in dev (#1896, BookShepherd report). A snapshot resolved i18n labels; resolving a _missing_ key emits `i18n:missing`; that signal was recorded by two collectors, each notified, and each notification bumped the tick the snapshot pusher watches — one tick produced fourteen, and a consumer measured ~8000 ticks/s until the page died. Three changes, in increasing order of generality. `i18n:missing` is now announced **once per key and locale** rather than on every resolution — a missing key is a fact, and one signal carries its whole diagnostic value (the cap resets when the locale changes or a bundle loads, since the fact may no longer hold). The debug bridge treats `describe()` and `dump()` as reads: a collector that notifies while being observed no longer bumps the tick, which closes the class rather than this instance. And `notify()` now coalesces to at most one tick per frame, so any loop that still gets through costs a measurable slowdown instead of a dead page — `notifySync()` keeps the immediate path for callers that need it.

## 1.0.0

### Major Changes

- Promote to 1.0.0 — stability contract (#1026). No API change: the 0.2.x
  label was versioning debt on a de-facto frozen API (the qdadm debug bridge
  and its agents exercise it in production). From 1.0, strict semver: breaking
  changes only in a major. Versioning stays independent from qdadm — qddebug
  is shared with qdcms and follows its own cadence.

### Patch Changes

- Updated dependencies
  - @quazardous/qdcore@1.0.0

All notable changes to `@quazardous/qddebug` will be documented in this file.

## [0.2.1] - 2026-05-07

### Changed — first npm publication

- Same code as the unpublished `0.2.0` reference inside the qdadm-monorepo. Metadata completed (`repository.directory`, `homepage`, `bugs`); internal `@quazardous/qdcore` dep pinned to `^0.2.1` instead of `"*"` so external consumers can resolve everything from npm. From this version onwards, qddebug resolves directly from the npm registry.

For the history of unpublished `0.1.x` and `0.2.0` (extraction from qdadm, DebugBar/ObjectTree, collectors), see the qdadm root [CHANGELOG.md](../../CHANGELOG.md) — qddebug versions tracked qdadm releases before this first standalone publish.
