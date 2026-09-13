---
"@quazardous/qdadm": minor
---

A detail page keeps its active tab when the record reloads (#2435).

`ShowPage` replaced its content with a spinner on every load, so a reload — an action calling `show.reload()`, or a live update of the record — unmounted everything inside: `FieldGroups` came back on the first tab, and open panels, scroll and local state were lost with it.

- `ShowPage` now shows the loading slot on the **first** load only. A reload of a record already on screen keeps it mounted, with a thin progress bar and `aria-busy`.
- `FieldGroups` accepts `v-model:active` for `tabs` (a group name) and `accordion` (names), for an app that wants to own the active group. Without it, the component keeps the user's choice itself.

Edit pages are unchanged: a form only reloads when the app asks for it.
