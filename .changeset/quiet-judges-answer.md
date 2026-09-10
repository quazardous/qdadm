---
"@quazardous/qdadm": minor
---

Let the application provide the permission judgement (#2225).

- `security.grant: { isGranted(attribute, subject, user), install?(ctx) }` is consulted before the role matrix, for roles and permissions alike. `true`/`false` is the verdict; anything else falls through to `role_hierarchy`/`role_permissions`, which stay the default. A judge that throws denies. A `grant` without `isGranted` fails at boot instead of being skipped.
- `install(ctx)` — for both `security.grant` and a `rolesProvider` — now receives `permissionRegistry`, so the app can pre-warm every registered key in one request. Read `getKeys()` at fetch time: modules register their entities after `install` runs.
- New signal `security:changed` (`SIGNALS.SECURITY_CHANGED`): emit it when your answers change and the app remounts, as on `auth:login`. Emit only on an actual change — a remount discards unsaved form state.
- The debug bar's auth panel shows the delegated verdicts for every registered permission.

See docs/security.md, "Delegating the judgement to your backend".
