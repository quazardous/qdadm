# Changelog

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
