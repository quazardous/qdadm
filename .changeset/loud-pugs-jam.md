---
'@quazardous/qdadm': patch
---

`debugBar: { enabled: false }` now actually disables the debug bar

The flag was inert in both halves of the path: the bar component was
registered whatever `enabled` said, and passing `debugBar` at all forced
`options.debug = true`, which `DebugModule.enabled()` reads as "turn on". A
consumer who wrote `enabled: false` to switch the bar off shipped it to
**production**; the only working workaround was to omit the key entirely.

`enabled` is now effective in **both directions**, which cuts both ways: an app
that passed `enabled: false` believing the key inert — including one that left
it there to keep the bar visible, since it changed nothing — will now see the
bar disappear. Both readings were possible precisely because the flag did
nothing. Remove the key (or set `enabled: true`) to keep the bar.

Disabling the bar no longer forces debug mode on, and an explicit
`debug: true` alongside a disabled bar is left alone.
