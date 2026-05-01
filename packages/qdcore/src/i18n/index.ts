/**
 * @quazardous/qdcore/i18n
 *
 * Generic i18n primitives shared by qdadm and qdcms.
 *
 * - **Types** (`types.ts`) — `MessagesBundle`, `MessagesNode`, `EntityMessages`,
 *   `NavMessages`, `CoreMessages`, `AliasPattern`, `TranslationProvider`,
 *   `TranslateParams`, `ResolveTrace`/`ResolveStep`, `KeyStrategy`/`KeyStrategyName`,
 *   `BaseI18nOptions`.
 * - **`MessagesRegistry`** — in-memory merged bundles per locale, deep-merge.
 * - **`Resolver`** — convention-based key resolution with fallback chain,
 *   value-level `@key` aliases, wildcard pattern aliases, snake-case fallback.
 * - **`InlineTranslationProvider`** — minimal in-memory `TranslationProvider`.
 * - **`strategies`** — built-in key strategies (`global`/`module`/`entity`).
 * - **`I18N_SIGNALS`** — signal name constants for cross-engine bridging.
 *
 * No Vue dependency, no admin or CMS specifics. Concrete orchestrators
 * (qdadm's `I18n`, a vue-i18n adapter, etc.) layer on top.
 */

export * from './types'
export { MessagesRegistry } from './MessagesRegistry'
export { Resolver, snakeCaseToTitle } from './Resolver'
export { InlineTranslationProvider } from './InlineTranslationProvider'
export { STRATEGIES, resolveStrategy, defineStrategy } from './strategies'
export { I18N_SIGNALS, type I18nSignal } from './signals'
