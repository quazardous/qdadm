/**
 * Patch KernelContext prototype with i18n declarative methods:
 *   - messages(locale, bundle)              — declare translations
 *   - aliases(patterns)                     — declare pattern aliases
 *   - messagesProvider(provider)            — register a TranslationProvider
 */

import type { AliasPattern, MessagesBundle, TranslationProvider } from '../i18n/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Self = any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyI18nMethods(KernelContextClass: { prototype: any }): void {
  const proto = KernelContextClass.prototype as Self

  proto.messages = function (this: Self, locale: string, bundle: MessagesBundle): Self {
    if (this._kernel.i18nInstance) {
      this._kernel.i18nInstance.addMessages(locale, bundle)
    }
    return this
  }

  proto.aliases = function (this: Self, patterns: AliasPattern[]): Self {
    if (this._kernel.i18nInstance) {
      this._kernel.i18nInstance.addAliases(patterns)
    }
    return this
  }

  proto.messagesProvider = function (this: Self, provider: TranslationProvider): Self {
    if (this._kernel.i18nInstance) {
      this._kernel.i18nInstance.addProvider(provider)
    }
    return this
  }
}
