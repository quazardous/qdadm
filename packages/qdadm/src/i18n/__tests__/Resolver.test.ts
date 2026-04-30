import { describe, it, expect } from 'vitest'

import { MessagesRegistry } from '../MessagesRegistry'
import { Resolver, snakeCaseToTitle } from '../Resolver'
import type { AliasPattern } from '../types'

function makeResolver(opts: {
  bundles?: Record<string, Parameters<MessagesRegistry['merge']>[1]>
  globalAliases?: AliasPattern[]
  defaultLocale?: string
  fallbackLocale?: string
  onMissing?: (key: string, locale: string) => void
}) {
  const reg = new MessagesRegistry()
  for (const [locale, bundle] of Object.entries(opts.bundles ?? {})) {
    reg.merge(locale, bundle)
  }
  const resolver = new Resolver(reg, {
    defaultLocale: opts.defaultLocale ?? 'en',
    fallbackLocale: opts.fallbackLocale ?? 'en',
    globalAliases: opts.globalAliases,
    onMissing: opts.onMissing,
  })
  return { reg, resolver }
}

describe('snakeCaseToTitle', () => {
  it('handles snake_case', () => {
    expect(snakeCaseToTitle('first_name')).toBe('First Name')
  })
  it('handles camelCase', () => {
    expect(snakeCaseToTitle('firstName')).toBe('First Name')
  })
  it('handles kebab-case', () => {
    expect(snakeCaseToTitle('first-name')).toBe('First Name')
  })
  it('handles single word', () => {
    expect(snakeCaseToTitle('title')).toBe('Title')
  })
})

describe('Resolver — convention lookup', () => {
  it('returns the matching value from the active locale', () => {
    const { resolver } = makeResolver({
      bundles: { en: { entities: { books: { fields: { title: 'Title' } } } } },
    })
    expect(resolver.translate('entities.books.fields.title', 'en')).toBe('Title')
  })

  it('falls back to fallbackLocale on miss', () => {
    const { resolver } = makeResolver({
      bundles: { en: { entities: { books: { fields: { title: 'Title' } } } } },
      defaultLocale: 'fr',
      fallbackLocale: 'en',
    })
    // No 'fr' bundle — falls back to 'en'
    expect(resolver.translate('entities.books.fields.title', 'fr')).toBe('Title')
  })

  it('reads _label from object node', () => {
    const { resolver } = makeResolver({
      bundles: {
        en: {
          entities: {
            books: {
              fields: {
                genre: { _label: 'Genre', options: { fiction: 'Fiction' } },
              },
            },
          },
        },
      },
    })
    expect(resolver.translate('entities.books.fields.genre', 'en')).toBe('Genre')
    expect(
      resolver.translate('entities.books.fields.genre.options.fiction', 'en')
    ).toBe('Fiction')
  })
})

describe('Resolver — interpolation', () => {
  it('replaces {placeholder} params', () => {
    const { resolver } = makeResolver({
      bundles: { en: { core: { errors: { tooShort: 'Too short (min {min})' } } } },
    })
    expect(resolver.translate('core.errors.tooShort', 'en', { min: 3 })).toBe(
      'Too short (min 3)'
    )
  })

  it('leaves unknown placeholders untouched', () => {
    const { resolver } = makeResolver({
      bundles: { en: { foo: 'Hello {name}' } },
    })
    expect(resolver.translate('foo', 'en')).toBe('Hello {name}')
  })
})

describe('Resolver — value-level @-aliases', () => {
  it('follows a single @-alias', () => {
    const { resolver } = makeResolver({
      bundles: {
        en: {
          entities: { books: { actions: { save: '@core.actions.save' } } },
          core: { actions: { save: 'Save' } },
        },
      },
    })
    expect(resolver.translate('entities.books.actions.save', 'en')).toBe('Save')
  })

  it('follows a chain of @-aliases', () => {
    const { resolver } = makeResolver({
      bundles: {
        en: {
          a: '@b',
          b: '@c',
          c: 'Bottom',
        },
      },
    })
    expect(resolver.translate('a', 'en')).toBe('Bottom')
  })

  it('detects cycles and falls through', () => {
    const onMissing = vitestFn()
    const { resolver } = makeResolver({
      bundles: { en: { a: '@b', b: '@a' } },
      onMissing,
    })
    // No final string → ends up as miss → returns raw key
    expect(resolver.translate('a', 'en')).toBe('a')
    expect(onMissing.calls.length).toBeGreaterThan(0)
  })

  it('escapes literal @ via @@ prefix', () => {
    const { resolver } = makeResolver({
      bundles: { en: { ping: '@@home' } },
    })
    expect(resolver.translate('ping', 'en')).toBe('@home')
  })
})

describe('Resolver — pattern aliases', () => {
  const globalAliases: AliasPattern[] = [
    { pattern: 'entities.*.actions.*', target: 'core.actions.$2' },
    { pattern: 'entities.*.fields.created_at', target: 'core.fields.created_at' },
  ]

  it('rewrites via wildcard pattern with $2 capture', () => {
    const { resolver } = makeResolver({
      bundles: { en: { core: { actions: { save: 'Save' } } } },
      globalAliases,
    })
    expect(resolver.translate('entities.books.actions.save', 'en')).toBe('Save')
  })

  it('rewrites a specific exact pattern', () => {
    const { resolver } = makeResolver({
      bundles: { en: { core: { fields: { created_at: 'Created at' } } } },
      globalAliases,
    })
    expect(resolver.translate('entities.books.fields.created_at', 'en')).toBe('Created at')
  })

  it('longest-match wins when multiple patterns match', () => {
    const aliases: AliasPattern[] = [
      { pattern: 'entities.*.actions.*', target: 'core.actions.$2' },
      // More specific, should win
      { pattern: 'entities.books.actions.delete', target: 'books.specialDelete' },
    ]
    const { resolver } = makeResolver({
      bundles: {
        en: {
          core: { actions: { delete: 'Delete' } },
          books: { specialDelete: 'Discard' },
        },
      },
      globalAliases: aliases,
    })
    expect(resolver.translate('entities.books.actions.delete', 'en')).toBe('Discard')
    // Other entities still go through the wildcard
    expect(resolver.translate('entities.users.actions.delete', 'en')).toBe('Delete')
  })

  it('does not loop forever when patterns ping-pong', () => {
    const aliases: AliasPattern[] = [
      { pattern: 'a.*', target: 'b.$1' },
      { pattern: 'b.*', target: 'a.$1' },
    ]
    const { resolver } = makeResolver({
      bundles: { en: {} },
      globalAliases: aliases,
    })
    // Should bail out — no actual value found anywhere
    expect(resolver.translate('a.foo', 'en')).toBe('a.foo')
  })
})

describe('Resolver — final fallbacks', () => {
  it('humanizes field key via snakeCaseToTitle on miss', () => {
    const { resolver } = makeResolver({ bundles: { en: {} } })
    expect(resolver.translate('entities.books.fields.first_name', 'en')).toBe('First Name')
  })

  it('does NOT humanize non-field keys', () => {
    const { resolver } = makeResolver({ bundles: { en: {} } })
    expect(resolver.translate('core.actions.save', 'en')).toBe('core.actions.save')
  })

  it('emits onMissing on every miss', () => {
    const onMissing = vitestFn<[string, string]>()
    const { resolver } = makeResolver({ bundles: { en: {} }, onMissing })
    resolver.translate('core.actions.save', 'en')
    resolver.translate('entities.books.fields.title', 'en') // miss but humanized
    expect(onMissing.calls.length).toBe(2)
    expect(onMissing.calls[0]).toEqual(['core.actions.save', 'en'])
    expect(onMissing.calls[1]).toEqual(['entities.books.fields.title', 'en'])
  })
})

describe('Resolver — trace', () => {
  it('returns lookup steps', () => {
    const { resolver } = makeResolver({
      bundles: { en: { entities: { books: { fields: { title: 'Title' } } } } },
    })
    const trace = resolver.resolve('entities.books.fields.title', 'en')
    expect(trace.hit).toBe(true)
    expect(trace.result).toBe('Title')
    expect(trace.steps[0]).toEqual({
      kind: 'lookup',
      locale: 'en',
      key: 'entities.books.fields.title',
      found: true,
    })
  })

  it('records the alias-pattern step on rewrite', () => {
    const { resolver } = makeResolver({
      bundles: { en: { core: { actions: { save: 'Save' } } } },
      globalAliases: [{ pattern: 'entities.*.actions.*', target: 'core.actions.$2' }],
    })
    const trace = resolver.resolve('entities.books.actions.save', 'en')
    expect(trace.hit).toBe(true)
    const aliasStep = trace.steps.find((s) => s.kind === 'alias-pattern')
    expect(aliasStep).toBeDefined()
  })

  it('records snake-case-fallback for missing field', () => {
    const { resolver } = makeResolver({ bundles: { en: {} } })
    const trace = resolver.resolve('entities.books.fields.first_name', 'en')
    expect(trace.hit).toBe(false)
    expect(trace.result).toBe('First Name')
    const last = trace.steps[trace.steps.length - 1]
    expect(last?.kind).toBe('snake-case-fallback')
  })
})

// ----------------------------------------------------------------------------
// Tiny mock helper (avoids import-order quirks with vi.fn() in some setups)
// ----------------------------------------------------------------------------
function vitestFn<A extends unknown[] = unknown[]>(): ((...args: A) => void) & {
  calls: A[]
} {
  const calls: A[] = []
  const fn = ((...args: A) => {
    calls.push(args)
  }) as ((...args: A) => void) & { calls: A[] }
  fn.calls = calls
  return fn
}
