---
"@quazardous/qdadm": patch
---

AppLayout's inline breadcrumb now renders the View↔Edit mode toggle (#1341): the `breadcrumbModeToggle` flag shipped in 2.7.0 was wired only in DefaultBreadcrumb, leaving it inert for AppLayout consumers — the default layout now honors the same opt-in contract.
