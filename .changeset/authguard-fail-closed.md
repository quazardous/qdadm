---
"@quazardous/qdadm": patch
---

The router auth guard's entity access check now fails **closed** (#1190). Previously a blanket `catch {}` — intended for "entity not registered" — swallowed every error from the access check (e.g. a throwing `canRead()`), silently ALLOWING navigation. Registration is now checked explicitly (`orchestrator.isRegistered`, the only allowed pass-through); an unexpected failure in the access check logs a `console.error` and denies navigation.
