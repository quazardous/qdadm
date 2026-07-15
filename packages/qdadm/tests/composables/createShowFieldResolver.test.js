/**
 * Tests for createShowFieldResolver — reference handling (#1341 fallout)
 *
 * FieldConfig.reference is canonically `{ entity, labelField?, valueField? }`;
 * the resolver used to pass that object straight to orchestrator.get(),
 * producing an '[object Object]' lookup that THREW during generateFields
 * (blank show page on any entity with an object-form reference field).
 */
import { describe, it, expect, vi } from 'vitest'
import { createShowFieldResolver } from '../../src/composables/createShowFieldResolver'

const genresManager = { idField: 'id', routePrefix: 'genre' }

function createOrchestrator() {
  return {
    has: vi.fn((name) => name === 'genres'),
    get: vi.fn((name) => {
      if (name !== 'genres') throw new Error(`No manager for entity "${name}"`)
      return genresManager
    }),
  }
}

const manager = { getEntityLabel: () => 'x' }

describe('createShowFieldResolver reference handling (#1341)', () => {
  it('resolves the reference route from the canonical object form', () => {
    const orchestrator = createOrchestrator()
    const resolve = createShowFieldResolver(manager, orchestrator)

    const field = resolve('genre', { type: 'select', reference: { entity: 'genres' } })

    expect(orchestrator.get).toHaveBeenCalledWith('genres')
    expect(typeof field.referenceRoute).toBe('function')
    expect(field.referenceRoute('sci-fi')).toEqual({
      name: 'genre-show',
      params: { id: 'sci-fi' },
    })
  })

  it('still accepts the bare-string form', () => {
    const orchestrator = createOrchestrator()
    const resolve = createShowFieldResolver(manager, orchestrator)

    const field = resolve('genre', { type: 'select', reference: 'genres' })

    expect(field.referenceRoute('sci-fi')).toEqual({
      name: 'genre-show',
      params: { id: 'sci-fi' },
    })
  })

  it('does not throw on a reference to an unregistered entity (has() probe)', () => {
    const orchestrator = createOrchestrator()
    const resolve = createShowFieldResolver(manager, orchestrator)

    const field = resolve('other', { type: 'select', reference: { entity: 'nope' } })

    expect(orchestrator.get).not.toHaveBeenCalledWith('nope')
    expect(field.referenceRoute).toBeUndefined()
  })

  it('keeps an explicit referenceRoute untouched', () => {
    const orchestrator = createOrchestrator()
    const resolve = createShowFieldResolver(manager, orchestrator)
    const custom = () => ({ name: 'custom', params: {} })

    const field = resolve('genre', {
      type: 'select',
      reference: { entity: 'genres' },
      referenceRoute: custom,
    })

    expect(field.referenceRoute).toBe(custom)
    expect(orchestrator.get).not.toHaveBeenCalled()
  })
})
