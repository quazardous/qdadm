---
"@quazardous/qdadm": minor
---

Structural views tightened + exported (#1253 phase 2). `query`,
`invalidateCache`, `getFieldConfig` and `canRead` are now REQUIRED on the
`EntityManagerRead` / `EntityManagerPermissions` views — they are
unconditionally implemented on `EntityManager` and called unguarded by list
pages; the `?` was a #1191 unification leftover that forced consumer-side
casts on base methods (`.manager.invalidateCache()` no longer needs one).
The badge/severity capability (`getEntityBadges`, `hasSeverityMap`,
`getSeverity`, `getSeverityDescriptor`) stays optional by design, documented
as such. Optionality contract documented in the interface header: required
iff qdadm composables call it unguarded, plus capability coherence.

The views are now exported from the main barrel (`EntityManagerBase`,
`EntityManagerPermissions`, `EntityManagerRead`, `EntityManagerCrud`,
`EntityManagerLike`, `OrchestratorLike`) so consumers can type manager-likes
and test doubles against the same contract.

Type-only tightening: hand-rolled manager-likes missing the flipped members
stop compiling (they were one call away from a runtime crash inside list
pages). No runtime change.
