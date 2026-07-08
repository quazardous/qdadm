# Changelog

## 1.0.0

### Major Changes

- Promote to 1.0.0 — stability contract (#1026). No API change: the 0.2.x
  label was versioning debt on a de-facto frozen API (qdadm 2.x has depended
  on it in production through its whole line). From 1.0, strict semver:
  breaking changes only in a major. Versioning stays independent from qdadm —
  qdcore is shared with qdcms and follows its own cadence.

All notable changes to `@quazardous/qdcore` will be documented in this file.

## [0.2.1] - 2026-05-07

### Changed — first npm publication

- Same code as the unpublished `0.2.0` reference inside the qdadm-monorepo. Metadata completed (`repository.directory`, `homepage`, `bugs`) so the package can ship under the `@quazardous` scope. From this version onwards, qdcore resolves directly from the npm registry — consumers no longer need a workspace link or local `npm pack`.

For the history of unpublished `0.1.x` and `0.2.0` (extraction from qdadm, plugin/migration/entity move to `@quazardous/qdcms-core`, i18n primitives extraction), see the qdadm root [CHANGELOG.md](../../CHANGELOG.md) entries — qdcore versions tracked qdadm releases before this first standalone publish.
