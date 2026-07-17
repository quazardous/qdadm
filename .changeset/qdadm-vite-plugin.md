---
'@quazardous/qdadm': minor
---

New `qdadmVitePlugin()` export at `@quazardous/qdadm/vite` (#1385)

One line in the consumer's `vite.config.ts` replaces the hand-written
`resolve.dedupe` + `optimizeDeps` block that npm-installed qdadm needed to
avoid the dual-PrimeVue instance split (`Error: No PrimeVue Toast provided!`
blank page in dev). Covers both the npm-install and `file:`/workspace-link
scenarios. The package README's misleading claim that npm installs were
unaffected is corrected.
