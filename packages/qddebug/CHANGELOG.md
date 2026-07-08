# Changelog

## 1.0.0

### Major Changes

- Promote to 1.0.0 — stability contract (#1026). No API change: the 0.2.x
  label was versioning debt on a de-facto frozen API (the qdadm debug bridge
  and its agents exercise it in production). From 1.0, strict semver: breaking
  changes only in a major. Versioning stays independent from qdadm — qddebug
  is shared with qdcms and follows its own cadence.

### Patch Changes

- Updated dependencies
  - @quazardous/qdcore@1.0.0

All notable changes to `@quazardous/qddebug` will be documented in this file.

## [0.2.1] - 2026-05-07

### Changed — first npm publication

- Same code as the unpublished `0.2.0` reference inside the qdadm-monorepo. Metadata completed (`repository.directory`, `homepage`, `bugs`); internal `@quazardous/qdcore` dep pinned to `^0.2.1` instead of `"*"` so external consumers can resolve everything from npm. From this version onwards, qddebug resolves directly from the npm registry.

For the history of unpublished `0.1.x` and `0.2.0` (extraction from qdadm, DebugBar/ObjectTree, collectors), see the qdadm root [CHANGELOG.md](../../CHANGELOG.md) — qddebug versions tracked qdadm releases before this first standalone publish.
