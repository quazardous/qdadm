---
"@quazardous/qdadm": patch
---

Cancel on a dirty form opens one "Unsaved Changes" dialog, not two (#2267).

`AppLayout` and `BaseLayout` render the guard dialog a form registers, and `FormPage` rendered its own from the same `guardDialog` prop, so both opened at once. `FormPage` now renders it only when no qdadm layout above it does; an app with its own layout keeps FormPage's dialog.
