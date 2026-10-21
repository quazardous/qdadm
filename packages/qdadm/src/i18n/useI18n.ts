/**
 * useI18n - Vue composable for accessing the kernel I18n instance.
 *
 * Falls back to a no-op shim if no I18n has been provided to the app — useful
 * for components rendered outside a kernel (tests, isolated examples).
 */

import { computed, inject, type Ref, type ComputedRef } from 'vue'
import type { I18n } from './I18n'
import { interpolate } from '@quazardous/qdcore'
import type { TranslateParams } from './types'

export const I18N_INJECTION_KEY = Symbol('qdadm.i18n')

export interface UseI18nResult {
  t: (key: string, params?: TranslateParams) => string
  /**
   * The catalog's text for `key`, or `fallback` (interpolated) when the key
   * is missing or there is no I18n: for labels that read as English text,
   * not as a key, outside a kernel.
   */
  tOr: (key: string, fallback: string, params?: TranslateParams) => string
  locale: ComputedRef<string> | Ref<string>
  i18n: I18n | null
}

export function useI18n(): UseI18nResult {
  const i18n = inject<I18n | null>(I18N_INJECTION_KEY, null)
  if (!i18n) {
    return {
      t: (key: string) => key,
      tOr: (_key, fallback, params) => interpolate(fallback, params),
      locale: computed(() => 'en'),
      i18n: null,
    }
  }
  return {
    t: (key, params) => i18n.t(key, params),
    tOr: (key, fallback, params) => {
      const trace = i18n.resolve(key, params)
      return trace.hit ? trace.result : interpolate(fallback, params, i18n.locale.value)
    },
    locale: i18n.locale,
    i18n,
  }
}
