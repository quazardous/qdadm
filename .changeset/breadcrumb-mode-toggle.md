---
"@quazardous/qdadm": minor
---

Declarative View↔Edit navigation on entity pages (#1332): `useNavContext` exposes a `modeToggle` computed (twin-mode route resolved from the semantic breadcrumb terminal, `router.hasRoute`-checked, `canUpdate`-gated on the Edit side, locale-reactive labels via `breadcrumb.view` / `breadcrumb.edit` keys), and `DefaultBreadcrumb` renders it as a toggle next to the terminal crumb — opt-in via `qdadmFeatures.breadcrumbModeToggle: true`. Edit→show navigation stays covered by the form page's own unsaved-changes guard.
