/**
 * InlineTranslationProvider - The default provider, backing `ctx.messages()`.
 *
 * Modules and the kernel push bundles in synchronously; `load(locale)` returns
 * the merged accumulation for that locale. No I/O.
 */

import type { MessagesBundle, TranslationProvider } from './types'

export class InlineTranslationProvider implements TranslationProvider {
  readonly name = 'inline'

  private _bundles: Map<string, MessagesBundle[]> = new Map()

  /**
   * Push a bundle for a locale. Multiple pushes for the same locale are
   * concatenated and merged at `load()` time (in declaration order).
   */
  push(locale: string, bundle: MessagesBundle): void {
    const list = this._bundles.get(locale)
    if (list) {
      list.push(bundle)
    } else {
      this._bundles.set(locale, [bundle])
    }
  }

  /**
   * Returns a merged bundle for a locale (deep merge of all pushed bundles).
   */
  load(locale: string): MessagesBundle {
    const bundles = this._bundles.get(locale)
    if (!bundles || bundles.length === 0) return {}
    const merged: MessagesBundle = {}
    for (const b of bundles) {
      mergeInto(merged as Record<string, unknown>, b as Record<string, unknown>)
    }
    return merged
  }

  availableLocales(): string[] {
    return Array.from(this._bundles.keys())
  }
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue
    if (key === 'aliases' && Array.isArray(value)) {
      const existing = target.aliases
      target.aliases = Array.isArray(existing)
        ? [...(existing as unknown[]), ...value]
        : [...value]
      continue
    }
    const current = target[key]
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      mergeInto(current as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      target[key] = value
    }
  }
}
