/**
 * I18n - Top-level orchestrator (exposed as `kernel.i18n`).
 *
 * Owns:
 *   - the active locale (reactive ref)
 *   - the MessagesRegistry
 *   - registered TranslationProviders
 *   - the active strategy's pattern aliases
 *   - the Resolver
 *
 * Public API:
 *   - t(key, params?)
 *   - locale (ref)
 *   - availableLocales
 *   - resolve(key)         (debug trace)
 *   - dump(locale)         (export merged bundle)
 *   - changeLocale(locale) (programmatic; the public way is signals.emit('locale:change', loc))
 *   - addProvider(p)
 *   - addMessages(locale, bundle)
 *   - addAliases(patterns)
 *   - registerEntityModule(entity, module) (for the 'module' strategy)
 */

import { ref, type Ref } from 'vue'

import {
  MessagesRegistry,
  Resolver,
  InlineTranslationProvider,
  resolveStrategy,
} from '@quazardous/qdcore'
import type {
  AliasPattern,
  MessagesBundle,
  ResolveTrace,
  TranslateParams,
  TranslationProvider,
} from '@quazardous/qdcore'
import { coreEn } from './defaults/core.en'
import type { I18nOptions } from './types'

export interface I18nDeps {
  /** SignalBus instance for emitting locale:changed and i18n:missing. */
  signals?: {
    emit: (signal: string, payload?: unknown) => void | Promise<void>
    on: (signal: string, handler: (e: { data: unknown }) => void) => () => void
  } | null
}

export class I18n {
  readonly inline: InlineTranslationProvider
  readonly locale: Ref<string>

  private _registry: MessagesRegistry
  private _resolver: Resolver
  private _providers: TranslationProvider[]
  private _strategyName: string | string[]
  private _appAliases: AliasPattern[]
  private _entityToModule: Map<string, string> = new Map()
  private _signals: I18nDeps['signals']
  private _defaultLocale: string
  private _fallbackLocale: string
  private _loadedLocales: Set<string> = new Set()

  constructor(options: I18nOptions = {}, deps: I18nDeps = {}) {
    this._defaultLocale = options.defaultLocale ?? 'en'
    this._fallbackLocale = options.fallbackLocale ?? this._defaultLocale
    this._strategyName = options.keyStrategy ?? 'global'
    this._appAliases = options.aliases ? [...options.aliases] : []
    this._signals = deps.signals ?? null

    this._registry = new MessagesRegistry()
    this.inline = new InlineTranslationProvider()
    this._providers = [this.inline, ...(options.providers ?? [])]

    this.locale = ref(this._defaultLocale)

    this._resolver = new Resolver(this._registry, {
      defaultLocale: this._defaultLocale,
      fallbackLocale: this._fallbackLocale,
      globalAliases: this._currentStrategyAliases(),
      onMissing: (key, locale) => {
        this._signals?.emit('i18n:missing', { key, locale })
      },
    })

    // Default core bundle (overridable by app/module messages declared later).
    if (!options.disableDefaultCoreBundle) {
      this.inline.push(this._defaultLocale, coreEn)
    }

    // App-level messages from kernel options.
    if (options.messages) {
      for (const [loc, bundle] of Object.entries(options.messages)) {
        this.inline.push(loc, bundle)
      }
    }

    // Listen for locale:change requests on the bus, if present.
    if (this._signals) {
      this._signals.on('locale:change', (event) => {
        const loc = typeof event.data === 'string' ? event.data : null
        if (loc) void this.changeLocale(loc)
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Translate a convention-derived key.
   */
  t(key: string, params?: TranslateParams): string {
    return this._resolver.translate(key, this.locale.value, params)
  }

  /**
   * Return the resolution trace (for debugging).
   */
  resolve(key: string, params?: TranslateParams): ResolveTrace {
    return this._resolver.resolve(key, this.locale.value, params)
  }

  /**
   * Union of available locales across registered providers.
   */
  async availableLocales(): Promise<string[]> {
    const set = new Set<string>()
    for (const p of this._providers) {
      if (typeof p.availableLocales === 'function') {
        const locs = await p.availableLocales()
        for (const l of locs) set.add(l)
      }
    }
    return Array.from(set)
  }

  /**
   * Switch to a new locale. Loads bundles from providers if not yet cached.
   * Public callers should prefer `signals.emit('locale:change', loc)`.
   */
  async changeLocale(locale: string): Promise<void> {
    if (this.locale.value === locale && this._loadedLocales.has(locale)) return
    await this._loadLocale(locale)
    this.locale.value = locale
    this._signals?.emit('locale:changed', locale)
  }

  /**
   * Initial bootstrap: load default + fallback locales from providers.
   * Called by the kernel during warmup.
   */
  async bootstrap(): Promise<void> {
    const targets = new Set<string>([this._defaultLocale, this._fallbackLocale])
    for (const loc of targets) {
      await this._loadLocale(loc)
    }
  }

  /**
   * Register an additional provider after construction.
   */
  addProvider(provider: TranslationProvider): void {
    this._providers.push(provider)
  }

  /**
   * Push messages into the inline provider (used by ctx.messages()).
   * Bundles merge into the registry on next load. If the locale is already
   * loaded, the bundle is also merged immediately for hot updates.
   */
  addMessages(locale: string, bundle: MessagesBundle): void {
    this.inline.push(locale, bundle)
    if (this._loadedLocales.has(locale)) {
      this._registry.merge(locale, bundle)
    }
  }

  /**
   * Append app/module-level pattern aliases to the active strategy.
   */
  addAliases(patterns: AliasPattern[]): void {
    this._appAliases.push(...patterns)
    this._resolver.setOptions({ globalAliases: this._currentStrategyAliases() })
  }

  /**
   * Track which module owns which entity. Used to materialize the 'module'
   * key strategy at runtime (entities.<entity>.* → modules.<module>.*).
   */
  registerEntityModule(entity: string, module: string): void {
    this._entityToModule.set(entity, module)
    if (this._strategyIncludes('module')) {
      this._resolver.setOptions({ globalAliases: this._currentStrategyAliases() })
    }
  }

  /**
   * Export the currently merged bundle for a locale (for translator workflows).
   */
  dump(locale: string): MessagesBundle {
    return this.inline.load(locale)
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async _loadLocale(locale: string): Promise<void> {
    for (const p of this._providers) {
      const bundle = await p.load(locale)
      if (bundle && Object.keys(bundle).length > 0) {
        this._registry.merge(locale, bundle)
      }
    }
    this._loadedLocales.add(locale)
  }

  private _currentStrategyAliases(): AliasPattern[] {
    const fromStrategy = resolveStrategy(this._strategyName)
    const fromModuleStrategy = this._strategyIncludes('module')
      ? this._materializeModuleAliases()
      : []
    return [...fromStrategy, ...fromModuleStrategy, ...this._appAliases]
  }

  private _strategyIncludes(name: string): boolean {
    if (this._strategyName === name) return true
    if (Array.isArray(this._strategyName)) return this._strategyName.includes(name)
    return false
  }

  /**
   * For each known entity → module mapping, emit two pattern aliases:
   *   entities.<entity>.actions.* → modules.<module>.actions.$1
   *   entities.<entity>.errors.*  → modules.<module>.errors.$1
   * (plus a more specific actions/errors per-module fallback to core.*.)
   */
  private _materializeModuleAliases(): AliasPattern[] {
    const out: AliasPattern[] = []
    for (const [entity, module] of this._entityToModule) {
      out.push(
        { pattern: `entities.${entity}.actions.*`, target: `modules.${module}.actions.$1` },
        { pattern: `entities.${entity}.errors.*`, target: `modules.${module}.errors.$1` }
      )
    }
    // Module-level fallbacks to core.
    out.push(
      { pattern: 'modules.*.actions.*', target: 'core.actions.$2' },
      { pattern: 'modules.*.errors.*', target: 'core.errors.$2' }
    )
    return out
  }
}
