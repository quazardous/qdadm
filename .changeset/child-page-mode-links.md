---
"@quazardous/qdadm": minor
---

Mode links on child-list pages (#1353): `useNavContext` gains `modeLinks` — the uniform list the breadcrumb components render at the end of the navlinks group. Item pages keep the single opposite-mode entry (unchanged behavior, `modeToggle` preserved for compatibility); child pages (routes with `meta.parent`) now surface the PARENT item's `View | Edit` pair, each under the same route-existence/`canUpdate`/i18n rules.
