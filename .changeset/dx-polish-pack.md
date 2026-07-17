---
'@quazardous/qdadm': patch
---

DX polish pack from the onboarding audit (#1388)

- SecurityChecker warns (once per role) when a user's role matches no
  configured role — the "role: admin instead of ROLE_ADMIN → silently zero
  permissions" trap is now debuggable.
- Kernel warns at boot when `security` is configured without
  `entityAuthAdapter` (permission checks silently permissive).
- No-auth apps no longer log `injection "authAdapter" not found` on every
  page (inject defaults in useAuth).
- Number fields accept `useGrouping: false` to disable locale digit
  grouping in show displays (years render as 1965, not "1 965").
- Sidebar user zone prettifies unmapped ROLE_* constants
  (ROLE_SUPER_USER → "Super User").
- `examples/hello-world` rewritten on the canonical Kernel bootstrap
  (drops the legacy createQdadm path, toast stub and stale
  @primevue/themes import; dogfoods qdadmVitePlugin).
- Sibling navlinks only forward the route params their target declares —
  silences vue-router's "Discarded invalid param(s)" warning on child
  item pages.
