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
import type { Kernel } from './Kernel'

// #1196 Phase B — this-typing against the real Kernel shape (was Self = any)
type Self = Kernel

/** Where the user's language is kept: one key per app (#4686) */
function localeKey(kernel: Self): string {
  const name = ((kernel.options.app as { name?: string } | undefined)?.name ?? 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `qdadm.locale.${name}`
}

function readLocale(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeLocale(key: string, locale: string): void {
  try {
    globalThis.localStorage?.setItem(key, locale)
  } catch {
    // No storage: the language lasts the page
  }
}

export function applyI18nMethods(KernelClass: { prototype: Kernel }): void {
  const proto = KernelClass.prototype

  proto._createI18n = function (this: Self): void {
    const opts = (this.options.i18n as I18nOptions | undefined) ?? {}
    this.i18nInstance = new I18n(opts, { signals: this.signals })
    // The user's language survives a reload (#4686), per app
    if (opts.rememberLocale !== false) {
      this.signals.on('locale:changed', (event) => {
        if (typeof event.data === 'string') writeLocale(localeKey(this), event.data)
      })
    }
  }

  proto._bootstrapI18n = async function (this: Self): Promise<void> {
    const i18n = this.i18nInstance
    if (!i18n) return
    await i18n.bootstrap()
    const opts = (this.options.i18n as I18nOptions | undefined) ?? {}
    if (opts.rememberLocale === false) return
    const saved = readLocale(localeKey(this))
    if (saved && saved !== i18n.locale.value) await i18n.changeLocale(saved)
  }
}
