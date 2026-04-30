/**
 * I18nCollector - Debug collector for i18n misses and locale changes.
 *
 * Listens to:
 * - `i18n:missing` → tracks unique (key, locale) pairs with hit counts and
 *   first/last seen timestamps. Acts as a deduplicating record buffer rather
 *   than a raw event log.
 * - `locale:changed` → keeps a small history of locale switches (display only).
 *
 * Exposes a JSON-skeleton builder so the panel can hand the dev a paste-ready
 * `ctx.messages()` stub for the missing keys.
 */

import {
  Collector,
  type CollectorContext,
  type CollectorEntry,
  type CollectorOptions,
} from './Collector'

export interface MissingKeyEntry extends CollectorEntry {
  key: string
  locale: string
  count: number
  firstSeen: number
  lastSeen: number
}

export interface LocaleChange {
  locale: string
  at: number
}

export interface I18nCollectorOptions extends CollectorOptions {
  /** How many recent locale changes to remember. Default 20. */
  localeHistorySize?: number
}

interface SignalEvent {
  data: unknown
}

interface SignalsBus {
  on(signal: string, handler: (event: SignalEvent) => void): () => void
}

export class I18nCollector extends Collector<MissingKeyEntry> {
  static override collectorName = 'i18n'
  static override records = true

  private _unsubscribes: Array<() => void> = []
  private _localeHistory: LocaleChange[] = []
  private _localeHistorySize: number

  constructor(options: I18nCollectorOptions = {}) {
    super(options)
    this._localeHistorySize = options.localeHistorySize ?? 20
  }

  protected override _doInstall(ctx: CollectorContext): void {
    const signals = ctx.signals as SignalsBus | null | undefined
    if (!signals) {
      console.warn('[I18nCollector] No signals bus found in context')
      return
    }

    this._unsubscribes.push(
      signals.on('i18n:missing', (event) => {
        const data = event.data as { key?: unknown; locale?: unknown } | undefined
        if (!data || typeof data.key !== 'string' || typeof data.locale !== 'string') {
          return
        }
        this._recordMissing(data.key, data.locale)
      })
    )

    this._unsubscribes.push(
      signals.on('locale:changed', (event) => {
        const locale = typeof event.data === 'string' ? event.data : null
        if (!locale) return
        this._recordLocaleChange(locale)
      })
    )
  }

  protected override _doUninstall(): void {
    for (const off of this._unsubscribes) {
      try {
        off()
      } catch {
        // ignore
      }
    }
    this._unsubscribes = []
  }

  /**
   * Record a missing key. If we've seen this (key, locale) combo before, bump
   * the counter and refresh `lastSeen`; otherwise push a new entry.
   */
  private _recordMissing(key: string, locale: string): void {
    const existing = this.entries.find((e) => e.key === key && e.locale === locale)
    const now = Date.now()
    if (existing) {
      existing.count++
      existing.lastSeen = now
      existing._isNew = true
      this.notifyChange()
      return
    }
    this.record({
      key,
      locale,
      count: 1,
      firstSeen: now,
      lastSeen: now,
    })
  }

  private _recordLocaleChange(locale: string): void {
    this._localeHistory.push({ locale, at: Date.now() })
    if (this._localeHistory.length > this._localeHistorySize) {
      this._localeHistory.shift()
    }
    this.notifyChange()
  }

  /**
   * Recent locale switches (oldest first).
   */
  getLocaleHistory(): LocaleChange[] {
    return [...this._localeHistory]
  }

  /**
   * Group missing keys by their first dotted segment (entities, core, nav, …).
   */
  byNamespace(): Record<string, MissingKeyEntry[]> {
    const out: Record<string, MissingKeyEntry[]> = {}
    for (const e of this.entries) {
      const ns = e.key.split('.')[0] ?? '_other'
      if (!out[ns]) out[ns] = []
      out[ns].push(e)
    }
    return out
  }

  /**
   * Build a nested-object skeleton matching the missing keys, suitable for
   * pasting into a `ctx.messages(locale, …)` call. One bundle per locale.
   *
   * @example
   *   collector.asJsonSkeleton()
   *   // {
   *   //   en: { entities: { books: { fields: { title: '…' } } } },
   *   //   fr: { entities: { books: { fields: { title: '…' } } } }
   *   // }
   */
  asJsonSkeleton(placeholder: string = '…'): Record<string, unknown> {
    const byLocale: Record<string, Record<string, unknown>> = {}
    for (const entry of this.entries) {
      if (!byLocale[entry.locale]) byLocale[entry.locale] = {}
      const target = byLocale[entry.locale]!
      const segments = entry.key.split('.')
      let cursor: Record<string, unknown> = target
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]!
        if (i === segments.length - 1) {
          cursor[seg] = placeholder
        } else {
          if (
            cursor[seg] === undefined ||
            cursor[seg] === null ||
            typeof cursor[seg] !== 'object'
          ) {
            cursor[seg] = {}
          }
          cursor = cursor[seg] as Record<string, unknown>
        }
      }
    }
    return byLocale
  }

  override clear(): void {
    super.clear()
    this._localeHistory = []
  }
}
