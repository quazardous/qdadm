# @quazardous/qdcore

Generic primitives shared by [qdadm](https://github.com/quazardous/qdadm) (back-office) and [qdcms](https://github.com/quazardous/qdcms) (public-facing CMS).

Currently exposes:

- **`signal/`** — `SignalBus` event dispatcher (wraps `@quazardous/quarkernel`)
- **`stack/`** — generic navigation/content stack: `ContentStackLevel`, `Stack<L>`, `StackBuilder<L>`, `Hydrator<L>`

This package is intentionally framework-agnostic (no Vue, no router, no CRUD). Vue/router integrations live in the consuming packages.

## Status

Pre-alpha. Lives inside the qdadm monorepo for now; designed to be promoted to its own repository without breaking changes.
