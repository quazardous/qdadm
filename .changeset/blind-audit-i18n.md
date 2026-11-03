---
'@quazardous/qdadm': minor
---

The i18n that docs/i18n.md promised, done (#4686). Entity labels come from `entities.<entity>.label` / `labelPlural` (titles, breadcrumbs, menus), select options from `entities.<entity>.fields.<field>.options.<value>` (forms, show pages, list cells, static filters), booleans from `core.values.yes` / `no`. The default action labels (list create button and row tooltips, show page Edit / Delete / Back, form Save / Delete / Cancel), ListPage's "Actions" header and the search placeholder follow a locale change without a remount. The chosen locale is kept across reloads, per app (`i18n.rememberLocale: false` turns it off). The form's default save label now follows the mode: "Create & Close" / "Update & Close".
