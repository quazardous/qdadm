# @quazardous/qddebug

Symfony-style debug panel shared by [qdadm](https://github.com/quazardous/qdadm) and [qdcms](https://github.com/quazardous/qdcms).

Provides:

- **`bridge/`** — `DebugBridge` aggregator and `Collector` base class
- **`collectors/`** — generic collectors: `SignalCollector`, `ErrorCollector`, `ToastCollector`, `I18nCollector`
- **`components/`** — `DebugBar` floating toolbar (panel-pluggable), `ObjectTree`, generic panels

The bar is intentionally panel-agnostic: pass a `panels` prop mapping collector
names to Vue components to plug in admin-specific or CMS-specific panels
(e.g. qdadm provides `AuthPanel`, `EntitiesPanel`, `RouterPanel`, `ZonesPanel`).

Built on `@quazardous/qdcore` (SignalBus). Vue 3 + PrimeVue peer deps.

## Status & stability contract

**Stable (1.0).** The public API follows strict semver:

- **Breaking changes only in a major** — the `DebugBridge`/`Collector`
  contract, the generic collectors, and the `DebugBar` panel-plugging
  interface are frozen within a major line.
- **Independent versioning** — qddebug is consumed by more than one product
  (qdadm back-office, qdcms public CMS) and versions at its own cadence; its
  version number carries no relation to qdadm's.
- Lives inside the qdadm monorepo for now; a promotion to its own repository
  stays possible without breaking changes (same package name, same API).

The de-facto freeze predates the label: the qdadm debug bridge (and the
agents driving it) has exercised this API in production through qdadm's
whole 2.x line.
