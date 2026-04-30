/**
 * Patch Kernel prototype with i18n-related methods.
 *
 * Adds:
 *   - kernel.i18n  : I18n instance
 *   - _createI18n() : init step
 *   - _bootstrapI18n() : warmup step (loads default + fallback locales)
 */

import { I18n } from '../i18n/I18n'
import type { I18nOptions } from '../i18n/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Self = any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyI18nMethods(KernelClass: { prototype: any }): void {
  const proto = KernelClass.prototype as Self

  proto._createI18n = function (this: Self): void {
    const opts = (this.options.i18n as I18nOptions | undefined) ?? {}
    this.i18nInstance = new I18n(opts, { signals: this.signals })
  }

  proto._bootstrapI18n = function (this: Self): Promise<void> {
    if (!this.i18nInstance) return Promise.resolve()
    return this.i18nInstance.bootstrap()
  }
}
