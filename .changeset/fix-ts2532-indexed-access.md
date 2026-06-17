---
"@quazardous/qdadm": patch
---

Fix two `TS2532: Object is possibly 'undefined'` errors that leaked to consumers via the source-only distribution. Under `noUncheckedIndexedAccess`, indexed access returns `T | undefined`, and neither a `.length === 1` check nor a bounded `for` loop narrows the element type for the compiler:

- `useOptionsLookup.ts` — `filtered[0].toLowerCase()` guarded only by `filtered.length === 1`; now binds the sole element to a local that the `!== undefined` check narrows.
- `EntityManager.cache.ts` — `entries[i][0]` inside the eviction loop; now iterates `entries.slice(0, toRemove)` and destructures the key, dropping the unchecked index entirely.

No runtime behavior change — `vue-tsc --noEmit` against the package source is now clean. Reported in qdadm #1019.
