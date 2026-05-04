/**
 * @quazardous/qdcore
 *
 * Generic primitives shared by qdadm and qdcms. Framework-agnostic
 * (no Vue, no router, no CRUD).
 *
 * Plugin / migration / entity primitives moved to `@quazardous/qdcms-core`
 * (lives in qdcms repo) — they are qdcms-centric in practice. qdcore
 * stays focused on truly cross-app primitives that both qdadm and qdcms
 * use today (signals, hooks, events, SSE, navigation stack, i18n).
 */

export * from './signal/index'
export * from './hook/index'
export * from './event/index'
export * from './sse/index'
export * from './stack/index'
export * from './i18n/index'
