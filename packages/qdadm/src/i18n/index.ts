/**
 * qdadm i18n - public exports.
 *
 * ## Two providers to choose from
 *
 *   - **`LazyTranslationProvider`** — full bundle on `load(locale)`, split
 *     across multiple loaders (one per file/domain) deep-merged on resolve.
 *     Use when the locale bundle is reasonable to fetch up-front.
 *
 *   - **`IncrementalDomainProvider`** — one loader per top-level domain,
 *     fetched on demand. `t()` on an unloaded domain returns the raw key
 *     synchronously and emits `i18n:domain-loaded` once merged. Use for
 *     large apps with rarely-used sections.
 *
 * Both support `createYamlLoader({ <locale>: () => import('./xx.yml?raw') })`
 * for the typical "split YAML files in a directory" setup.
 *
 * See docs/todo-i18n.md for the broader design rationale.
 */

export { I18n } from './I18n'
export type { I18nDeps } from './I18n'
export { MessagesRegistry } from './MessagesRegistry'
export { Resolver, snakeCaseToTitle } from './Resolver'
export { InlineTranslationProvider } from './InlineTranslationProvider'
export { defineStrategy, resolveStrategy, STRATEGIES } from './strategies'
export { LazyTranslationProvider } from './LazyTranslationProvider'
export type { LazyLoader, LazyTranslationProviderOptions } from './LazyTranslationProvider'
export {
  IncrementalDomainProvider,
  isDomainAwareProvider,
} from './IncrementalDomainProvider'
export type {
  DomainLoader,
  IncrementalDomainProviderOptions,
} from './IncrementalDomainProvider'
export { createYamlLoader } from './loaders/yaml'
export type { YamlTextImport } from './loaders/yaml'
export { createDefaultCoreProvider } from './defaults/DefaultCoreProvider'
export { useI18n, I18N_INJECTION_KEY } from './useI18n'
export type {
  AliasPattern,
  CoreMessages,
  EntityMessages,
  I18nOptions,
  KeyStrategy,
  KeyStrategyName,
  MessagesBundle,
  MessagesNode,
  NavMessages,
  ResolveStep,
  ResolveTrace,
  TranslateParams,
  TranslationProvider,
} from './types'
