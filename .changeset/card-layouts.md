---
"@quazardous/qdadm": minor
---

Card layouts, a base shared by the dashboards and the domain bars (#5526): the layout core is generic (`reconcileLayout`, `shownItems`, `moveItem`, `setShown`, `setParams`, profiles `DASHBOARD_PROFILE` / `BAR_PROFILE`), with building blocks an app assembles into its own editor: `QdLayoutOrder` (order, hide, remove, parameters, max), `QdLayoutCatalogue` (add with parameters, show), `CardParamsForm` (now with `initial`), `useLayoutReorder` (pointer and keyboard). CardsDashboard's edit mode runs on them. A domain bar takes its layout from the app, `features.domainBar.layout(domain)` (sync, promise or null) or a `layout` prop (a preview): its indicators may be `repeatable` with `params` given to their functions, `label` names them in an editor, at most `maxCards` shown; `reloadDomainBar(name)` after a save. Docs: layouts.md.
