# 0006 — The consumer-smoke fixture *is* the stability contract

**Status:** Accepted (backfilled 2026-08-20)

## Context

Shipping raw sources ([ADR 0003](0003-ship-raw-sources.md)) means a type error
in qdadm is a type error in every consumer's build. Vite strips types without
checking them, so nothing in normal development — running the demo, running the
tests — makes that class of breakage visible. It surfaced the way it always
does: a published version that would not compile downstream.

Unit tests don't catch it (they run on the workspace, not the package),
`vue-tsc` on the repo doesn't catch it either (it typechecks internal code, not
the packaged `exports` map), and a written "public API" list would drift from
reality within a release or two.

## Decision

The stable API is defined **operationally**, by a fixture that CI compiles:

`tools/consumer-smoke/run.sh` packs the publishable train (`npm pack` on
qdcore, qddebug, qdadm — the exact artifacts a release would push), installs the
tarballs into a pristine strict-TS fixture app, and runs `vue-tsc` against it.

The fixture is not a toy. It contains, without casts:

- `smoke.ts` — the patterns real consumer apps use: manager subclassing,
  registry augmentation, structural views, storage-resolution overrides,
  codegen entry, utils, subpath imports.
- `tutorial-patterns.ts` / `TutorialPatterns.vue` — the exact patterns the
  tutorial and the README publish, so documentation and shipped types cannot
  diverge silently.

**If a documented pattern stops compiling, the types are wrong, not the docs.**

## Consequences

- "Stable API" stops being a claim and becomes a build artifact. See
  [`../API_STABILITY.md`](../API_STABILITY.md) for how the tiers are drawn from
  this.
- Installing a tarball rather than linking the workspace also validates the
  `exports` map and the `files` whitelist, catching the
  forgot-to-ship-a-file breakage no symlink can reproduce.
- Extending the stable surface is a deliberate act: you add the pattern to the
  fixture. Nothing becomes stable by accident.
- The gate is slow — it packs, installs and typechecks a real app. It runs on
  push to `main` ahead of publish, and locally via `npm run smoke:consumer`.
- The fixture must keep pace with the docs. A newly documented pattern that
  isn't in the fixture is an unenforced promise.
