---
"@quazardous/qdadm": minor
---

The page on screen says what it is doing, for the debug tools and the MCP (#2363).

- `useListPage`, `useEntityItemFormPage` and `useEntityItemShowPage` register their state while their page lives, as counts and names only, never row contents:
  - list: rows shown, total, page, page size, sort, search, active filters, selection;
  - form: mode, dirty fields, errors, saving;
  - show: loaded, loading, error.
- In debug mode, `window.__qdadm.pageState.current()` returns the innermost page's state. A list inside a show page answers first, and the show page answers again once the list is gone.
