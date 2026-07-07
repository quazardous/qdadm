/**
 * Patch KernelContext prototype with i18n declarative methods:
 *   - messages(locale, bundle)              — declare translations
 *   - aliases(patterns)                     — declare pattern aliases
 *   - messagesProvider(provider)            — register a TranslationProvider
 */

import type { AliasPattern, MessagesBundle, TranslationProvider } from '../i18n/types'
import type { KernelContext } from './KernelContext'

// #1196 Phase B — this-typing against the real KernelContext shape (was Self = any)
type Self = KernelContext

export function applyI18nMethods(KernelContextClass: { prototype: KernelContext }): void {
  const proto = KernelContextClass.prototype

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
