# 0003 — Ship raw sources, with a Vite plugin as the consumption contract

**Status:** Accepted (backfilled 2026-08-20)

## Context

A Vue library normally publishes a build: bundled ESM plus emitted `.d.ts`.
That costs a build step, a bundler config, and a permanent gap between the code
you debug and the code you wrote. It also freezes theming — SCSS compiled at
publish time can't be re-themed by the consumer.

qdadm's audience builds admin apps with Vite, and its differentiators
(theming through SCSS variables, readable stack traces, agent introspection)
all get worse when the shipped artifact is a bundle.

## Decision

Publish **raw TypeScript and `.vue` sources**. `main` is `src/index.ts`, the
`exports` map points at source files, and `files` ships `src/`. There is no
`dist/` in the package.

Because that shifts compilation to the consumer, the consumption contract is
made explicit and installable: `qdadmVitePlugin` (`@quazardous/qdadm/vite`)
applies the config qdadm needs in one line — `resolve.dedupe` and
`optimizeDeps.exclude` so the host app and qdadm's raw sources resolve the
*same* copy of PrimeVue, plus `server.fs.allow` handling when qdadm is consumed
through a symlink.

## Consequences

- Types are native and always exact — no `.d.ts` generation step to drift.
- Consumers can override SCSS variables and read real source in the debugger.
- **Every type error in qdadm reaches the consumer's `vue-tsc` directly.** Vite
  strips types without checking them, so a broken type is invisible in dev here
  and fatal there. This is the single largest risk the decision creates, and it
  is why [ADR 0006](0006-consumer-smoke-as-stability-contract.md) exists: the
  release gates compile the sources, emit declarations, and typecheck the
  packed tarball from a strict consumer fixture.
- Duplicate-peer bugs (two PrimeVue instances, mismatched injection symbols,
  `No PrimeVue Toast provided!` at boot) become a supported failure mode rather
  than an accident. The plugin is not optional; skipping it is a broken app.
- The `exports` map and the `files` whitelist become load-bearing: a file left
  out of `files` is a runtime `ERR_MODULE_NOT_FOUND` for consumers, invisible in
  the workspace. The smoke test installs a packed tarball precisely to catch it.
- CJS transitive dependencies are not acceptable — they force
  `optimizeDeps.include` gymnastics that break under `file:` links. Such deps
  are vendored as ESM instead.
