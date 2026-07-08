# @quazardous/qdcore

Generic primitives shared by [qdadm](https://github.com/quazardous/qdadm) (back-office) and [qdcms](https://github.com/quazardous/qdcms) (public-facing CMS).

Currently exposes:

- **`signal/`** — `SignalBus` event dispatcher (wraps `@quazardous/quarkernel`)
- **`stack/`** — generic navigation/content stack: `ContentStackLevel`, `Stack<L>`, `StackBuilder<L>`, `Hydrator<L>`

This package is intentionally framework-agnostic (no Vue, no router, no CRUD). Vue/router integrations live in the consuming packages.

## Status & stability contract

**Stable (1.0).** The public API follows strict semver:

- **Breaking changes only in a major** — signatures, exports, and observable
  behavior of `signal/` and `stack/` are frozen within a major line.
- **Independent versioning** — qdcore is consumed by more than one product
  (qdadm back-office, qdcms public CMS) and versions at its own cadence; its
  version number carries no relation to qdadm's.
- Lives inside the qdadm monorepo for now; a promotion to its own repository
  stays possible without breaking changes (same package name, same API).

The de-facto freeze predates the label: qdadm 2.x has depended on this API in
production through its whole 2.x line.
