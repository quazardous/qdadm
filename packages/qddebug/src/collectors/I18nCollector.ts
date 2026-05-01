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
  type CollectorManifest,
  type CollectorOptions,
  type CollectorSnapshot,
} from '../bridge/Collector'

interface I18nLike {
  locale?: { value?: string }
  fallbackLocale?: { value?: string }
  availableLocales?: () => string[] | Promise<string[]>
  t?: (key: string, params?: Record<string, unknown>) => string
  resolve?: (key: string, params?: Record<string, unknown>) => unknown
  dump?: (locale: string) => unknown
  changeLocale?: (locale: string) => Promise<unknown> | unknown
}

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

  private _i18n(): I18nLike | null {
    const ctx = this._ctx as (CollectorContext & { kernel?: { i18n?: I18nLike }; i18n?: I18nLike }) | null
    return ctx?.i18n ?? ctx?.kernel?.i18n ?? null
  }

  override describe(): CollectorManifest {
    return {
      name: this.name,
      records: true,
      summary:
        'Tracks missing i18n keys (deduplicated) and locale switches. Exposes resolution and skeleton-export helpers for agents.',
      entryShape: {
        key: 'string (dotted i18n key)',
        locale: 'string',
        count: 'number',
        firstSeen: 'number',
        lastSeen: 'number',
      },
      stateShape: {
        locale: 'string?',
        fallbackLocale: 'string?',
        localeHistory: 'LocaleChange[]',
      },
      actions: [
        ...this._builtinActionManifests(),
        {
          name: 'resolve',
          summary: 'Resolve a key against the live i18n instance and return the trace.',
          args: { key: 'string', params: 'json?' },
        },
        {
          name: 'translate',
          summary: 'Resolve and return the final string (alias of i18n.t).',
          args: { key: 'string', params: 'json?' },
        },
        {
          name: 'dumpBundle',
          summary: 'Return the merged messages bundle for a locale.',
          args: { locale: 'string' },
        },
        {
          name: 'changeLocale',
          summary: 'Switch the active locale.',
          args: { locale: 'string' },
          mutates: true,
        },
        {
          name: 'asJsonSkeleton',
          summary: 'Build a nested-object skeleton of every missing key, ready for ctx.messages().',
          args: { placeholder: 'string?' },
        },
        {
          name: 'byNamespace',
          summary: 'Group missing keys by their first dotted segment.',
        },
        {
          name: 'getLocaleHistory',
          summary: 'Return the recent locale-switch history.',
        },
        {
          name: 'availableLocales',
          summary: 'Return the union of locales discovered across providers (async).',
        },
      ],
    }
  }

  override snapshot(): CollectorSnapshot {
    // Note: availableLocales() is async — surfaced via the callable action
    // instead of state, so the snapshot stays sync and JSON-clean.
    const i18n = this._i18n()
    return {
      name: this.name,
      entries: this.entries.map((e) => ({ ...e })),
      count: this.entries.length,
      unseen: this.getUnseenCount(),
      state: {
        locale: i18n?.locale?.value ?? null,
        fallbackLocale: i18n?.fallbackLocale?.value ?? null,
        localeHistory: this.getLocaleHistory(),
      },
    }
  }

  override async call(actionName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const i18n = this._i18n()
    if (actionName === 'resolve') {
      if (!i18n?.resolve) throw new Error('[i18n] resolve is unavailable (no i18n instance)')
      return i18n.resolve(String(args.key ?? ''), args.params as Record<string, unknown>)
    }
    if (actionName === 'translate') {
      if (!i18n?.t) throw new Error('[i18n] t is unavailable (no i18n instance)')
      return i18n.t(String(args.key ?? ''), args.params as Record<string, unknown>)
    }
    if (actionName === 'dumpBundle') {
      if (!i18n?.dump) throw new Error('[i18n] dump is unavailable (no i18n instance)')
      return i18n.dump(String(args.locale ?? ''))
    }
    if (actionName === 'changeLocale') {
      if (!i18n?.changeLocale) throw new Error('[i18n] changeLocale is unavailable')
      await i18n.changeLocale(String(args.locale ?? ''))
      return { ok: true, locale: args.locale }
    }
    if (actionName === 'asJsonSkeleton') {
      return this.asJsonSkeleton(args.placeholder ? String(args.placeholder) : undefined)
    }
    if (actionName === 'byNamespace') {
      return this.byNamespace()
    }
    if (actionName === 'getLocaleHistory') {
      return this.getLocaleHistory()
    }
    if (actionName === 'availableLocales') {
      if (!i18n?.availableLocales) throw new Error('[i18n] availableLocales unavailable')
      return await i18n.availableLocales()
    }
    return super.call(actionName, args)
  }
}
