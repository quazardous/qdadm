---
"@quazardous/qdadm": patch
---

qdadm's default translations now include `breadcrumb.view` / `breadcrumb.edit` (en: View / Edit, fr: Voir / Modifier), the labels of the breadcrumb's View↔Edit toggle (#2270). Every app with `breadcrumbModeToggle` used to report both keys as missing on item pages, and a French UI showed the English fallbacks. An app that defines these keys itself keeps its own translation.
