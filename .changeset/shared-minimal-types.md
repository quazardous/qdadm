---
"@quazardous/qdadm": patch
---

Shared minimal structural types (#1191, KPI-4). `EntityManager.interface.ts` now exports assignment-safe `EntityManagerLike` / `OrchestratorLike<M>` / `ToastLike` views (method-syntax members, so the canonical generic classes satisfy them structurally — compile-time asserted in `Orchestrator.ts`). The 24 drifting local `interface EntityManager/Orchestrator` redeclarations across composables, security and components are migrated onto them; only the two deliberate internal `EntityManagerInstance` ducks remain (KPI-9 scope). New `ButtonSeverity` union export replaces `severity: string` + `as any` casts in ShowPage/PageHeader. Types only — no runtime change.
