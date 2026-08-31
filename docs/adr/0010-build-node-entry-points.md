# 0010 — Build the entry points Node loads; keep shipping the rest as source

**Status:** Accepted (2026-08-31) — refines, and does not reverse,
[ADR 0003](0003-ship-raw-sources.md).

## Context

[ADR 0003](0003-ship-raw-sources.md) ships raw TypeScript and `.vue` sources.
The reasoning holds for everything a consumer's bundler compiles: exact native
types, overridable SCSS, readable stack traces.

It does not hold for the entry points **Node** loads directly. Node refuses to
strip types under `node_modules`, so

```
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'
```

inside a `vite.config.js` fails with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`
from any real npm install. Both `npm run dev` and `npm run build` die, on an
error that never names qdadm.

Every consumer following the README was blocked, on published releases,
and we did not know:

- our own examples consume through a **workspace symlink**, whose realpath
  escapes `node_modules` — so Node strips types happily and the failure cannot
  occur here;
- the consumer-smoke gate installs the real packed tarball but only ran
  `vue-tsc`. It proved the package **compiles**. It never proved Node can
  **load** it.

`@quazardous/qdadm/gen` was even listed as *stable* in
[`../API_STABILITY.md`](../API_STABILITY.md) on the grounds that the fixture
exercises it. The fixture typechecked it. It did not import.

Reported by a consumer (#1895), not by us.

## Decision

**Entry points loaded by Node are compiled; everything else stays source.**

`src/vite/qdadmPlugin.ts`, `src/vite/qdadmDebugPlugin.ts` and
`src/gen/vite-plugin.ts` build to `dist/node/` (`.js` + `.d.ts`) via
`tsconfig.node.json`, and `exports` points `./vite`, `./vite-plugin-debug` and
`./gen/vite-plugin` there. A `prepack` script builds it, so the artifact exists
however the package is packed or published.

The dividing line is **who loads the module**, not what it contains: build
tooling that Node imports gets compiled; anything the application bundles keeps
its sources.

The gate is corrected to match: consumer-smoke now imports every Node entry
point for real and asks vite to resolve a config that uses the plugins. Both
steps fail on the pre-fix package — verified by reverting the export and
watching the gate go red on the reported error.

## Consequences

- A consumer can follow the README from a clean install. That was not true for
  the releases before this one.
- The build is only three modules and their build-time dependencies. It
  deliberately excludes `createManagers`, which instantiates an
  `EntityManager`: compiling it would drag the framework into `dist/node` and
  ship **two** copies of the class, so `instanceof` would fail across the two
  import paths.
- Because of that exclusion, `./gen` still points at source and remains
  unloadable from Node. It mixes build-time codegen with a runtime factory, and
  separating them changes a published entry point — left open deliberately
  rather than settled as a side effect of a bug fix.
- "Stable" now means the fixture typechecks **and** loads it. The previous
  definition was weaker than [ADR 0006](0006-consumer-smoke-as-stability-contract.md)
  claimed, and this is the correction: a gate that only compiles cannot speak
  for what runs.
- One more artifact to keep in step. The `prepack` hook makes forgetting it a
  build error rather than a silent regression.
