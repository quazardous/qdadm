/**
 * qdadm i18n types.
 *
 * Generic types come from `@quazardous/qdcore/i18n`; this module adds the
 * admin-specific `I18nOptions` (kernel constructor option that toggles the
 * default core admin bundles shipped via DefaultCoreProvider).
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
  /** Disable shipping qdadm's default core.* bundles (EN + FR). Default: false. */
  disableDefaultCoreBundle?: boolean
  /**
   * Emit the `i18n:missing` debug signal when a key cannot be resolved.
   * Default: `true`. Set to `false` to silence the missing-key stream (e.g. an
   * untranslated app where every key would otherwise fire it) — the debug
   * panel's "Missing" section then stays empty. No functional impact: nothing
   * but the debug collector consumes this signal.
   */
  emitMissing?: boolean
}
