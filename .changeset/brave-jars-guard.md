---
'@quazardous/qdadm': minor
---

The debug bar can be switched off without a deploy, and can no longer take the app down

**`?qddebug=off`** removes the bar for this browser and remembers it across
reloads and redirects; `?qddebug=on` brings it back. It overrides even an
explicit `enabled: true`. This is the piece a consumer most needed and did not
have: when their bar took the admin down, the only way to stop it was to
rebuild and redeploy.

**An error boundary** now wraps whatever component `debugBar.component`
provides. A bar that throws during render is dropped and the application keeps
running, with the reason logged once. Until now the error propagated to the
root and killed the app — a diagnostic tool failing precisely when someone
needed it.

The boundary catches thrown errors only; a runaway render loop throws nothing
and is handled by the bar's own circuit breaker in `@quazardous/qddebug`, which
ships in lockstep.
