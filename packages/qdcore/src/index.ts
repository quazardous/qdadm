/**
 * @quazardous/qdcore
 *
 * Generic primitives shared by qdadm and qdcms. Framework-agnostic
 * (no Vue, no router, no CRUD).
 */

export * from './signal/index'
export * from './hook/index'
export * from './event/index'
export * from './sse/index'
export * from './stack/index'
export * from './i18n/index'
export * from './entity/index'
export * from './plugin/index'

// NOTE: `./migration` is intentionally NOT re-exported here. It is
// Node-only (uses `node:crypto` and is meant for backend pipelines), so
// pulling it via the root barrel would force browser bundles to ship
// crypto polyfills they don't need. Backend consumers import explicitly:
//   import { hashSchema, composeFullSchema } from '@quazardous/qdcore/migration'
