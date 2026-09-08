/**
 * A handler is a slug or an instance (#2146).
 *
 * The same convention `storage` already follows, on purpose: a consumer
 * should meet one shape, not two. And an unknown slug THROWS — a persistence
 * choice that silently does something else is the exact failure ADR 0011
 * forbids, and the one this seam is cleaning up after.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import {
  resolveRouteStatePersister,
  isRouteStatePersister,
} from '../../src/routeState/RouteStatePersister'
import { createRouteStatePersisterFactory } from '../../src/routeState/factory'

const context = { router: { replace: vi.fn() }, route: { query: {} } }
const factory = createRouteStatePersisterFactory(context)

const custom = { name: 'mine', read: () => null, write: () => {}, clear: () => {} }

describe('recognising an instance', () => {
  it('accepts anything with read/write/clear', () => {
    expect(isRouteStatePersister(custom)).toBe(true)
  })

  it.each([null, undefined, 'url', 42, {}, { read: () => null }])('rejects %s', (value) => {
    expect(isRouteStatePersister(value)).toBe(false)
  })
})

describe('resolving', () => {
  it('returns an instance untouched', () => {
    expect(resolveRouteStatePersister(custom, factory)).toBe(custom)
  })

  it('builds the url persister from its slug', () => {
    expect(resolveRouteStatePersister('url', factory).name).toBe('url')
  })

  it('THROWS on an unknown slug instead of quietly using the default', () => {
    // The whole point. Falling back to `url` here would mean a consumer who
    // asked for something else gets the URL and is never told — which is the
    // silence this seam exists to end.
    expect(() => resolveRouteStatePersister('sessionstorage', factory)).toThrow(/sessionstorage/)
  })

  it('names the offending slug, so the message is actionable', () => {
    expect(() => resolveRouteStatePersister('typo', factory)).toThrow(/"typo"/)
  })

  it('throws on something that is neither', () => {
    expect(() => resolveRouteStatePersister(42, factory)).toThrow(/Invalid/)
  })
})
