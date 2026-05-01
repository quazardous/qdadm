/**
 * i18n signal name constants.
 *
 * Shared across qdadm and qdcms (and any other consumer) so that orchestrators
 * built on different translation engines (qdadm's resolver, vue-i18n, ...) can
 * still cross-talk via the SignalBus:
 *
 * - `LOCALE_CHANGE`   — request a locale switch (consumer of orchestrator emits)
 * - `LOCALE_CHANGED`  — locale switch completed (orchestrator emits)
 * - `I18N_MISSING`    — a key was looked up and not found (orchestrator emits)
 *
 * Listeners that bridge two i18n systems just `signals.on(LOCALE_CHANGED, ...)`
 * and call their own change-locale function.
 */

export const I18N_SIGNALS = {
  LOCALE_CHANGE: 'locale:change',
  LOCALE_CHANGED: 'locale:changed',
  I18N_MISSING: 'i18n:missing',
} as const

export type I18nSignal = (typeof I18N_SIGNALS)[keyof typeof I18N_SIGNALS]
