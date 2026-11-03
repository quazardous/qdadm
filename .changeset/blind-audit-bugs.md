---
'@quazardous/qdadm': minor
---

Fixes from a blind-agent audit (#4685).
- With the debug bar on, a hook or signal payload holding a cycle (a manager that keeps its I18n) no longer makes every save fail: qdadm no longer turns on the event kernel's own tracing, which JSON-stringified each payload.
- Declared columns are shown: `ListPage` renders `addColumn` / `generateColumns()` columns when the page gives no `#columns` slot, cells by field type, with a `#column-<field>` slot per cell. `generateColumns({ exclude, only })` is new.
- A record's breadcrumb crumb, and a child page's Details link, open its show page when there is one, rather than its form.
- Docs: task readers (`step`, `result`, `error`), the child form's parent key (disabled, not hidden), `defaultSortOrder` (-1), permissions as grants and `isOwn` instead of role tests, zones in `Module` classes, the demo README.
