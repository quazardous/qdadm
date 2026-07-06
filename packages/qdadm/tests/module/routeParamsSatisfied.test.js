/**
 * Unit tests for routeParamsSatisfied — the PageNav navlink guard (#1205).
 *
 * A navlink to a route must only be built when every required :param of
 * the target path is available; vue-router's useLink throws
 * "Missing required param" otherwise (child show route at list level).
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { routeParamsSatisfied } from '../../src/module/moduleRegistry'

describe('routeParamsSatisfied (#1205)', () => {
  it('accepts when all required params are present', () => {
    expect(routeParamsSatisfied('jobs/:jobId/bot-tasks', { jobId: 'j1' })).toBe(true)
    expect(
      routeParamsSatisfied('jobs/:jobId/bot-tasks/:id', { jobId: 'j1', id: 't1' }),
    ).toBe(true)
  })

  it('rejects the #1205 case: child show path at list level (no :id)', () => {
    expect(routeParamsSatisfied('jobs/:jobId/bot-tasks/:id', { jobId: 'j1' })).toBe(false)
  })

  it('rejects empty/null/undefined param values', () => {
    expect(routeParamsSatisfied('jobs/:jobId/tasks', { jobId: '' })).toBe(false)
    expect(routeParamsSatisfied('jobs/:jobId/tasks', { jobId: null })).toBe(false)
    expect(routeParamsSatisfied('jobs/:jobId/tasks', {})).toBe(false)
  })

  it('ignores optional params', () => {
    expect(routeParamsSatisfied('books/:bookId/loans/:filter?', { bookId: 'b1' })).toBe(true)
  })

  it('accepts param-less paths', () => {
    expect(routeParamsSatisfied('books', {})).toBe(true)
  })
})
