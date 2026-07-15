---
"@quazardous/qdadm": patch
---

Sidebar select overlays no longer get painted over by the next sidebar box (#1352): every `.sidebar-box` is its own stacking context (`z-index: 1`), so an open overlay (`appendTo="self"`, z 1001) was trapped inside its box's context and later sibling boxes painted over it — the "transparent dropdown" symptom. `.sidebar-box:focus-within` now raises the whole box (`z-index: 20`) while its control is open.
