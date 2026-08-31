---
"@quazardous/qddebug": minor
"@quazardous/qdadm": minor
---

Fix a runaway reactivity loop that could kill a page in dev (#1896, BookShepherd report). A snapshot resolved i18n labels; resolving a *missing* key emits `i18n:missing`; that signal was recorded by two collectors, each notified, and each notification bumped the tick the snapshot pusher watches — one tick produced fourteen, and a consumer measured ~8000 ticks/s until the page died. Three changes, in increasing order of generality. `i18n:missing` is now announced **once per key and locale** rather than on every resolution — a missing key is a fact, and one signal carries its whole diagnostic value (the cap resets when the locale changes or a bundle loads, since the fact may no longer hold). The debug bridge treats `describe()` and `dump()` as reads: a collector that notifies while being observed no longer bumps the tick, which closes the class rather than this instance. And `notify()` now coalesces to at most one tick per frame, so any loop that still gets through costs a measurable slowdown instead of a dead page — `notifySync()` keeps the immediate path for callers that need it.
