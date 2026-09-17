---
"@quazardous/qdadm": minor
---

The notification badge flashes the moment a live update reaches the record on screen (#2679).

- `useNotifications().flash()` and `isFlashing`: a short halo on the sidebar logo. Never delayed, unlike the activity ring's 400 ms; a flash already running absorbs further calls, so a burst flashes once. `prefers-reduced-motion` gets a static highlight.
- A detail page flashes it itself when its record is updated elsewhere — at the event, before the reload is coalesced or loaded. No app code.
- `useLiveEntity` takes `onEvent`, called at once for every event about the screen, before coalescing.
- `tools/visual-capture/live-reload.mjs` records what moves on a page during a live reload (transitions, animations, focus, DOM changes, what paints in a region), from headless Chromium — see docs/testing.md.
