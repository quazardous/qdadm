/**
 * MessagesRegistry - In-memory store of merged message bundles per locale.
 *
 * Bundles are merged deeply on insertion. The pattern aliases of all bundles
 * for a given locale are concatenated into a single ordered list (so a
 * declared alias can override a default).
 */

import type { AliasPattern, MessagesBundle } from './types'

interface LocaleEntry {
  data: Record<string, unknown>
  aliases: AliasPattern[]
}

export class MessagesRegistry {
  private _locales: Map<string, LocaleEntry> = new Map()

  /**
   * Merge a bundle into the locale's data. Pattern aliases declared in the
   * bundle (`bundle.aliases`) are appended to the locale's alias list.
   */
  merge(locale: string, bundle: MessagesBundle): void {
    const entry = this._locales.get(locale) ?? { data: {}, aliases: [] }
    const { aliases, ...rest } = bundle
    deepMerge(entry.data, rest as Record<string, unknown>)
    if (aliases && aliases.length) {
      entry.aliases.push(...aliases)
    }
    this._locales.set(locale, entry)
  }

  /**
   * Replace the entire bundle for a locale (used by provider live-reload).
   */
  replace(locale: string, bundle: MessagesBundle): void {
    const { aliases, ...rest } = bundle
    this._locales.set(locale, {
      data: { ...(rest as Record<string, unknown>) },
      aliases: aliases ? [...aliases] : [],
    })
  }

  /**
   * Drop a locale entirely.
   */
  drop(locale: string): void {
    this._locales.delete(locale)
  }

  /**
   * List loaded locales.
   */
  locales(): string[] {
    return Array.from(this._locales.keys())
  }

  /**
   * Look up a dotted key in the locale data.
   * Returns `undefined` if any segment is missing.
   * If the resolved leaf is an object with a `_label`, returns that.
   */
  lookup(locale: string, key: string): string | undefined {
    const entry = this._locales.get(locale)
    if (!entry) return undefined
    const segments = key.split('.')
    let cursor: unknown = entry.data
    for (const seg of segments) {
      if (cursor === null || typeof cursor !== 'object') return undefined
      cursor = (cursor as Record<string, unknown>)[seg]
      if (cursor === undefined) return undefined
    }
    if (typeof cursor === 'string') return cursor
    if (cursor && typeof cursor === 'object' && '_label' in cursor) {
      const label = (cursor as { _label?: unknown })._label
      if (typeof label === 'string') return label
    }
    return undefined
  }

  /**
   * Return the alias patterns declared for a locale (for the resolver to
   * try after lookup misses). Patterns from later merges come last.
   */
  aliases(locale: string): AliasPattern[] {
    return this._locales.get(locale)?.aliases ?? []
  }
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue
    const current = target[key]
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      deepMerge(current as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      target[key] = value
    }
  }
}
