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

## Status

Pre-alpha. Lives inside the qdadm monorepo for now; designed to be promoted to its own repository without breaking changes.
