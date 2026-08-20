---
"@quazardous/qdadm": patch
---

Declare which parts of the API are stable and which are still moving (#1029). New `docs/API_STABILITY.md` defines three tiers operationally — **stable** is what the CI-enforced consumer-smoke fixture and the tutorial exercise, **supported** is documented and demo-exercised, **experimental** is marked in the source — and says what breaking each one costs. Five module entry points now carry `@experimental` JSDoc, visible in editor tooltips: `chain/`, `deferred/`, `query/` (the executor classes only — the query object syntax is stable), `kernel/SSEBridge`, and `gen/vite-plugin`. Annotations and docs only; no API change.
