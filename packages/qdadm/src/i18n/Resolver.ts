/**
 * Resolver - Translation lookup with the qdadm fallback chain.
 *
 * Order:
 *   1. lookup(currentLocale, key)
 *   2. lookup(fallbackLocale, key)
 *   3. value-level @-alias resolution (recursive, with cycle detection)
 *   4. pattern-alias rewrites (global → locale-specific, longest match wins)
 *   5. snakeCaseToTitle for entities.*.fields.{field} keys only
 *   6. miss → emit i18n:missing, return raw key
 *
 * Pattern aliases trigger a re-entry into step 1 with the rewritten key.
 * Value-level aliases resolve immediately.
 */

import type { MessagesRegistry } from './MessagesRegistry'
import type {
  AliasPattern,
  ResolveStep,
  ResolveTrace,
  TranslateParams,
} from './types'

const MAX_ALIAS_DEPTH = 8
const FIELD_KEY_REGEX = /^entities\.[^.]+\.fields\.([^.]+)$/

export interface ResolverOptions {
  defaultLocale: string
  fallbackLocale: string
  /** Built-in/global pattern aliases (active strategy). Concatenated with per-locale aliases. */
  globalAliases?: AliasPattern[]
  /** Optional dev-mode emitter for missing keys. */
  onMissing?: (key: string, locale: string) => void
}

export class Resolver {
  private _registry: MessagesRegistry
  private _options: ResolverOptions

  constructor(registry: MessagesRegistry, options: ResolverOptions) {
    this._registry = registry
    this._options = options
  }

  setOptions(options: Partial<ResolverOptions>): void {
    this._options = { ...this._options, ...options }
  }

  /**
   * Translate a key with optional `{placeholder}` parameters.
   */
  translate(key: string, locale: string, params?: TranslateParams): string {
    const { result } = this._resolve(key, locale, params, false)
    return result
  }

  /**
   * Resolve a key and return the full trace (for debugging).
   */
  resolve(key: string, locale: string, params?: TranslateParams): ResolveTrace {
    const { result, hit, steps } = this._resolve(key, locale, params, true)
    return { key, locale, steps, result, hit }
  }

  // ---------------------------------------------------------------------------

  private _resolve(
    initialKey: string,
    locale: string,
    params: TranslateParams | undefined,
    trace: boolean
  ): { result: string; hit: boolean; steps: ResolveStep[] } {
    const steps: ResolveStep[] = []
    const fallbackLocale = this._options.fallbackLocale

    // Set of keys we've already rewritten through pattern aliases — prevents
    // infinite ping-pong if patterns are misconfigured.
    const visitedRewrites = new Set<string>()

    let currentKey = initialKey
    let depth = 0

    // Outer loop: pattern alias may rewrite the key and we re-attempt lookup.
    while (depth++ < MAX_ALIAS_DEPTH) {
      // Step 1: lookup in current locale
      let raw = this._registry.lookup(locale, currentKey)
      if (trace) {
        steps.push({ kind: 'lookup', locale, key: currentKey, found: raw !== undefined })
      }

      // Step 2: lookup in fallback locale
      if (raw === undefined && fallbackLocale && fallbackLocale !== locale) {
        raw = this._registry.lookup(fallbackLocale, currentKey)
        if (trace) {
          steps.push({
            kind: 'lookup',
            locale: fallbackLocale,
            key: currentKey,
            found: raw !== undefined,
          })
        }
      }

      // Step 3: value-level @-alias resolution
      if (raw !== undefined) {
        const resolved = this._resolveValueAlias(raw, locale, steps, trace)
        if (resolved !== undefined) {
          return { result: interpolate(resolved, params), hit: true, steps }
        }
        // value alias chain ended in a miss — fall through to pattern aliases
      }

      // Step 4: pattern alias rewrite
      const rewritten = this._applyPatternAlias(currentKey, locale, steps, trace)
      if (rewritten !== null && rewritten !== currentKey && !visitedRewrites.has(rewritten)) {
        visitedRewrites.add(currentKey)
        currentKey = rewritten
        continue
      }

      // No more rewrites possible — drop out to final fallbacks.
      break
    }

    // Step 5: snakeCaseToTitle for field keys
    const fieldMatch = FIELD_KEY_REGEX.exec(initialKey)
    if (fieldMatch && fieldMatch[1]) {
      const fieldName = fieldMatch[1]
      const result = snakeCaseToTitle(fieldName)
      if (trace) {
        steps.push({ kind: 'snake-case-fallback', field: fieldName, result })
      }
      this._options.onMissing?.(initialKey, locale)
      return { result: interpolate(result, params), hit: false, steps }
    }

    // Step 6: miss
    if (trace) {
      steps.push({ kind: 'miss', key: initialKey })
    }
    this._options.onMissing?.(initialKey, locale)
    return { result: initialKey, hit: false, steps }
  }

  /**
   * Recursively follow value-level @-aliases. Returns the final resolved
   * string, or `undefined` if the chain ends in a missing key.
   */
  private _resolveValueAlias(
    value: string,
    locale: string,
    steps: ResolveStep[],
    trace: boolean
  ): string | undefined {
    const seen = new Set<string>()
    let current = value
    for (let depth = 0; depth < MAX_ALIAS_DEPTH; depth++) {
      // Escape: '@@' at start = literal '@'
      if (current.startsWith('@@')) {
        return '@' + current.slice(2)
      }
      if (!current.startsWith('@')) {
        return current
      }
      const target = current.slice(1)
      if (seen.has(target)) {
        if (trace) steps.push({ kind: 'cycle-broken', at: target })
        return undefined
      }
      seen.add(target)
      const next =
        this._registry.lookup(locale, target) ??
        (this._options.fallbackLocale && this._options.fallbackLocale !== locale
          ? this._registry.lookup(this._options.fallbackLocale, target)
          : undefined)
      if (trace) {
        steps.push({ kind: 'alias-value', from: current, to: target })
      }
      if (next === undefined) return undefined
      current = next
    }
    if (trace) steps.push({ kind: 'cycle-broken', at: current })
    return undefined
  }

  /**
   * Try pattern aliases. Combines:
   *   - `globalAliases` from the active strategy
   *   - per-locale aliases declared in bundles
   * Longest pattern (most non-wildcard segments) wins.
   * Returns the rewritten key, or `null` if no pattern matched.
   */
  private _applyPatternAlias(
    key: string,
    locale: string,
    steps: ResolveStep[],
    trace: boolean
  ): string | null {
    const all: AliasPattern[] = [
      ...(this._options.globalAliases ?? []),
      ...this._registry.aliases(locale),
    ]
    if (this._options.fallbackLocale && this._options.fallbackLocale !== locale) {
      all.push(...this._registry.aliases(this._options.fallbackLocale))
    }
    if (all.length === 0) return null

    let best: { pattern: AliasPattern; captures: string[]; specificity: number } | null =
      null
    for (const pattern of all) {
      const match = matchPattern(pattern.pattern, key)
      if (!match) continue
      const specificity = countSpecific(pattern.pattern)
      if (!best || specificity > best.specificity) {
        best = { pattern, captures: match, specificity }
      }
    }
    if (!best) return null
    const target = applyCaptures(best.pattern.target, best.captures)
    if (trace) {
      steps.push({ kind: 'alias-pattern', pattern: best.pattern.pattern, from: key, to: target })
    }
    return target
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Match a key against a pattern with `*` wildcards (one segment each).
 * Returns the captured wildcards in order, or `null` if no match.
 */
function matchPattern(pattern: string, key: string): string[] | null {
  const pSegs = pattern.split('.')
  const kSegs = key.split('.')
  if (pSegs.length !== kSegs.length) return null
  const captures: string[] = []
  for (let i = 0; i < pSegs.length; i++) {
    const p = pSegs[i]
    const k = kSegs[i] ?? ''
    if (p === '*') {
      captures.push(k)
    } else if (p !== k) {
      return null
    }
  }
  return captures
}

/** Count non-wildcard segments — higher = more specific. */
function countSpecific(pattern: string): number {
  return pattern.split('.').filter((s) => s !== '*').length
}

/** Apply $1, $2, ... captures to a target template. */
function applyCaptures(target: string, captures: string[]): string {
  return target.replace(/\$(\d+)/g, (_, idx) => {
    const i = parseInt(idx, 10) - 1
    return captures[i] ?? ''
  })
}

/** Replace `{name}` placeholders with params. Missing params stay as-is. */
function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (full, name) => {
    const v = params[name]
    return v === undefined || v === null ? full : String(v)
  })
}

/**
 * Convert snake_case / camelCase / kebab-case to Title Case.
 * Exported separately because it's also useful outside the resolver.
 */
export function snakeCaseToTitle(input: string): string {
  return input
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
