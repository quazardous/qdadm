import { describe, it, expect } from 'vitest'
import { interpolate, pluralForm } from '../Resolver'

describe('plural forms', () => {
  it('picks one | other by the locale rules', () => {
    const msg = '{count} running task | {count} running tasks'
    expect(interpolate(msg, { count: 1 }, 'en')).toBe('1 running task')
    expect(interpolate(msg, { count: 0 }, 'en')).toBe('0 running tasks')
    expect(interpolate(msg, { count: 3 }, 'en')).toBe('3 running tasks')
    const fr = '{count} tâche en cours | {count} tâches en cours'
    expect(interpolate(fr, { count: 0 }, 'fr')).toBe('0 tâche en cours')
    expect(interpolate(fr, { count: 1 }, 'fr')).toBe('1 tâche en cours')
    expect(interpolate(fr, { count: 2 }, 'fr')).toBe('2 tâches en cours')
  })

  it('reads zero | one | other', () => {
    const msg = 'No line | One line | {count} lines'
    expect(interpolate(msg, { count: 0 })).toBe('No line')
    expect(interpolate(msg, { count: 1 })).toBe('One line')
    expect(interpolate(msg, { count: 7 })).toBe('7 lines')
  })

  it('leaves a message alone without a numeric count', () => {
    expect(pluralForm('a | b', undefined)).toBe('a | b')
    expect(pluralForm('a | b', '1')).toBe('a | b')
    expect(interpolate('x|y {n}', { n: 2, count: 1 })).toBe('x|y 2')
  })

  it('falls back to English rules on an unknown locale', () => {
    expect(pluralForm('one | many', 1, 'not a locale!')).toBe('one')
  })
})
