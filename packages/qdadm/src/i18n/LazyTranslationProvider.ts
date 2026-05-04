/**
 * LazyTranslationProvider - generic, format-agnostic provider that resolves
 * locale bundles via a cascade of lazy loaders.
 *
 * Each loader is a `(locale) => Promise<MessagesBundle | null>` function. On
 * `load(locale)`, the provider runs **all** loaders in order and deep-merges
 * the partial bundles they return (later loaders override earlier ones —
 * "last-merge-wins" semantics, same as the rest of the i18n stack).
 *
 * This lets consumers split bundles across multiple files — e.g. one loader
 * for `core.*`, one for `entities.*`, one for `nav.*` — each backed by its
 * own source (YAML file, JSON, fetch, etc.) without the provider knowing
 * about any of those formats.
 *
 * ## When to use this vs `IncrementalDomainProvider`
 *
 * Use **`LazyTranslationProvider`** when you want one bundle per locale and
 * don't care about loading domains independently:
 *   - All loaders run on `_loadLocale(locale)` (i.e. bootstrap or locale
 *     change). No partial state — once `bootstrap()` resolves, every key in
 *     every domain is in the registry for that locale.
 *   - Best for small/medium apps where the full bundle for a locale is
 *     reasonable to fetch up-front.
 *   - Domains are still split across files (the "cascade" lets you organise
 *     translations by topic), they're just resolved together.
 *
 * Use **`IncrementalDomainProvider`** when domains should be loaded only on
 * demand — `t('shop.cart.title')` for an unloaded `shop` domain triggers an
 * async load in the background and emits `i18n:domain-loaded` once merged.
 * Best for large apps with rarely-used sections (admin, legal, marketing
 * landing pages, …) where shipping every domain on bootstrap would be
 * wasteful. See `IncrementalDomainProvider.ts`.
 */

import type { MessagesBundle, MessagesNode, TranslationProvider } from '@quazardous/qdcore'

export type LazyLoader = (locale: string) => Promise<MessagesBundle | null>

export interface LazyTranslationProviderOptions {
  /** Provider name (for debugging / introspection). */
  name?: string
  /** Cascade of loaders. Earlier loaders are overridden by later ones. */
  loaders: LazyLoader[]
  /**
   * Locales advertised through `availableLocales()`. If omitted, the provider
   * doesn't advertise any (callers should still be able to ask `load(locale)`
   * — loaders that don't have the locale return null and are skipped).
   */
  locales?: string[]
}

export class LazyTranslationProvider implements TranslationProvider {
  readonly name: string
  private readonly _loaders: LazyLoader[]
  private readonly _locales: string[] | undefined

  constructor(options: LazyTranslationProviderOptions) {
    this.name = options.name ?? 'lazy'
    this._loaders = [...options.loaders]
    this._locales = options.locales ? [...options.locales] : undefined
  }

  async load(locale: string): Promise<MessagesBundle> {
    let merged: MessagesBundle = {}
    for (const loader of this._loaders) {
      const partial = await loader(locale)
      if (partial && Object.keys(partial).length > 0) {
        merged = deepMerge(merged, partial)
      }
    }
    return merged
  }

  availableLocales(): string[] {
    return this._locales ? [...this._locales] : []
  }
}

/**
 * Recursive merge of two MessagesBundle (or any plain-object MessagesNode):
 * objects merge recursively, leaf values from `b` override leaf values from
 * `a`. Arrays are replaced wholesale (we don't expect arrays in bundles, but
 * be safe). Returns a new object — does not mutate inputs.
 */
function deepMerge(a: MessagesBundle, b: MessagesBundle): MessagesBundle
function deepMerge(a: MessagesNode, b: MessagesNode): MessagesNode
function deepMerge(a: MessagesNode, b: MessagesNode): MessagesNode {
  if (!isPlainObject(a) || !isPlainObject(b)) return b
  const out: Record<string, MessagesNode> = { ...(a as Record<string, MessagesNode>) }
  for (const [key, bv] of Object.entries(b as Record<string, MessagesNode>)) {
    const av = out[key]
    out[key] =
      isPlainObject(av) && isPlainObject(bv) ? (deepMerge(av, bv) as MessagesNode) : bv
  }
  return out as MessagesNode
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
