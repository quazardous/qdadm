/**
 * qdadm i18n - public exports.
 *
 * See docs/todo-i18n.md for the design rationale.
 */

export { I18n } from './I18n'
export type { I18nDeps } from './I18n'
export { MessagesRegistry } from './MessagesRegistry'
export { Resolver, snakeCaseToTitle } from './Resolver'
export { InlineTranslationProvider } from './InlineTranslationProvider'
export { defineStrategy, resolveStrategy, STRATEGIES } from './strategies'
export { coreEn } from './defaults/core.en'
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
