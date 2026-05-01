/**
 * qdadm i18n types.
 *
 * Generic types come from `@quazardous/qdcore/i18n`; this module adds the
 * admin-specific `I18nOptions` (kernel constructor option that toggles the
 * default `core.en` admin bundle).
 */

import type { BaseI18nOptions } from '@quazardous/qdcore'

export type {
  AliasPattern,
  BaseI18nOptions,
  CoreMessages,
  EntityMessages,
  KeyStrategy,
  KeyStrategyName,
  MessagesBundle,
  MessagesNode,
  NavMessages,
  ResolveStep,
  ResolveTrace,
  TranslateParams,
  TranslationProvider,
} from '@quazardous/qdcore'

/**
 * Kernel-level i18n options for qdadm. Extends the generic shared shape with
 * admin-only knobs.
 */
export interface I18nOptions extends BaseI18nOptions {
  /** Disable shipping qdadm's default EN core.* bundle. Default: false. */
  disableDefaultCoreBundle?: boolean
}
