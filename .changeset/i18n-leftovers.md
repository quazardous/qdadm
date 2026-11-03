---
'@quazardous/qdadm': minor
---

i18n left over after the first blind audit (#4692). A filter without a placeholder shows its field's label from the catalogue, and its empty choice reads "All <field>" (`core.filters.all`), both following the locale; static options now get that empty choice too (not when they hold a `null` option, nor with `allLabel: false`). Show and form actions take `label: () => string`, read at each render. A run's `label` may be a function, read each time it shows (tray, dialog, end toast). Docs: a child crud's tab reads the child's `labelPlural` unless `label` pins it.
