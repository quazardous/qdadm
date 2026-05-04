/**
 * IncrementalDomainProvider - declares one loader per top-level translation
 * domain (`core`, `shop`, `legal`, …) and only fetches each (locale, domain)
 * pair when it's first needed.
 *
 * Unlike `LazyTranslationProvider`, which loads its full bundle on
 * `load(locale)`, this provider keeps its `load(locale)` minimal: it only
 * eagerly resolves domains listed in `eagerDomains` (typically `['core']`).
 * The rest stay dormant until `loadDomain(locale, domain)` is called — which
 * `I18n.t()` triggers automatically on a miss whose top-level segment is a
 * known-but-not-yet-loaded domain.
 *
 * Bundles returned by domain loaders are wrapped under their domain key so
 * the registry merges them at the right place:
 *   loader('shop')(locale) → { cart: {...} } → merged as { shop: { cart: {...} } }
 */

import type { MessagesBundle, MessagesNode, TranslationProvider } from '@quazardous/qdcore'

export type DomainLoader = (locale: string) => Promise<MessagesNode | null>

export interface IncrementalDomainProviderOptions {
  /** Provider name (for debugging / introspection). */
  name?: string
  /** Loader per top-level domain. Key is the domain (e.g. `core`, `shop`). */
  domains: Record<string, DomainLoader>
  /**
   * Domains to load eagerly during `load(locale)` (i.e. on bootstrap or
   * locale change). Default: empty — every domain is purely lazy.
   */
  eagerDomains?: string[]
  /** Locales advertised through `availableLocales()`. */
  locales?: string[]
}

export class IncrementalDomainProvider implements TranslationProvider {
  readonly name: string
  private readonly _domains: Record<string, DomainLoader>
  private readonly _eagerDomains: string[]
  private readonly _locales: string[] | undefined
  private readonly _inflight: Map<string, Promise<MessagesBundle | null>> = new Map()

  constructor(options: IncrementalDomainProviderOptions) {
    this.name = options.name ?? 'incremental-domain'
    this._domains = { ...options.domains }
    this._eagerDomains = options.eagerDomains ? [...options.eagerDomains] : []
    this._locales = options.locales ? [...options.locales] : undefined
  }

  /**
   * Eagerly load only the domains listed in `eagerDomains`. Other domains
   * are loaded on demand via `loadDomain`.
   */
  async load(locale: string): Promise<MessagesBundle> {
    if (this._eagerDomains.length === 0) return {}
    const merged: MessagesBundle = {}
    await Promise.all(
      this._eagerDomains.map(async (domain) => {
        const partial = await this._loadDomain(locale, domain)
        if (partial) Object.assign(merged, partial)
      })
    )
    return merged
  }

  /**
   * Returns whether this provider has a loader registered for `domain`.
   * Used by `I18n.t()` to decide whether a miss can be recovered by a lazy
   * load.
   */
  knowsDomain(domain: string): boolean {
    return Object.prototype.hasOwnProperty.call(this._domains, domain)
  }

  /**
   * Lazy-load a single domain. Concurrent calls for the same (locale, domain)
   * pair share one in-flight promise. Returns the wrapped bundle (i.e.
   * `{ [domain]: <node> }`) or `null` if the domain is unknown / loader
   * returns nothing.
   */
  loadDomain(locale: string, domain: string): Promise<MessagesBundle | null> {
    if (!this.knowsDomain(domain)) return Promise.resolve(null)
    const cacheKey = `${locale}::${domain}`
    const existing = this._inflight.get(cacheKey)
    if (existing) return existing
    const promise = this._loadDomain(locale, domain)
    this._inflight.set(cacheKey, promise)
    // Keep the inflight cache populated until the promise settles so a second
    // concurrent caller dedupes; once settled, drop the entry — successive
    // calls go through the loader again only if the I18n caller has lost
    // track. In practice I18n keeps its own loaded set and won't re-call.
    void promise.finally(() => {
      this._inflight.delete(cacheKey)
    })
    return promise
  }

  availableLocales(): string[] {
    return this._locales ? [...this._locales] : []
  }

  private async _loadDomain(
    locale: string,
    domain: string
  ): Promise<MessagesBundle | null> {
    const loader = this._domains[domain]
    if (!loader) return null
    const node = await loader(locale)
    if (node === null || node === undefined) return null
    return { [domain]: node }
  }
}

/**
 * Type guard: detects a provider that supports per-domain lazy loading.
 * Used by I18n.t() to recover from a domain-miss without coupling I18n to
 * the IncrementalDomainProvider class.
 */
export function isDomainAwareProvider(
  p: TranslationProvider
): p is TranslationProvider & {
  loadDomain(locale: string, domain: string): Promise<MessagesBundle | null>
  knowsDomain(domain: string): boolean
} {
  return (
    typeof (p as { loadDomain?: unknown }).loadDomain === 'function' &&
    typeof (p as { knowsDomain?: unknown }).knowsDomain === 'function'
  )
}
