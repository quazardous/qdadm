/**
 * Locks the vendored ESM port of pluralize@8.0.0 (#1454) against the
 * upstream behavior — especially the irregular/uncountable tables that
 * EntityManager relies on for label/routePrefix inference.
 */
import { describe, it, expect } from 'vitest'
import pluralize, { plural, singular, isPlural, isSingular } from '../../src/utils/pluralize'
import { EntityManager } from '../../src/entity/EntityManager'

describe('vendored pluralize', () => {
  it('handles regular forms', () => {
    expect(plural('book')).toBe('books')
    expect(singular('books')).toBe('book')
    expect(plural('box')).toBe('boxes')
    expect(singular('boxes')).toBe('box')
    expect(plural('status')).toBe('statuses')
    expect(singular('statuses')).toBe('status')
  })

  it('handles -y/-ies', () => {
    expect(plural('category')).toBe('categories')
    expect(singular('categories')).toBe('category')
    expect(plural('company')).toBe('companies')
    expect(singular('entries')).toBe('entry')
  })

  it('handles irregulars', () => {
    expect(plural('person')).toBe('people')
    expect(singular('people')).toBe('person')
    expect(plural('child')).toBe('children')
    expect(singular('children')).toBe('child')
    expect(plural('analysis')).toBe('analyses')
    expect(singular('analyses')).toBe('analysis')
    expect(plural('index')).toBe('indices')
    expect(singular('indices')).toBe('index')
  })

  it('handles uncountables', () => {
    expect(plural('series')).toBe('series')
    expect(singular('series')).toBe('series')
    expect(plural('news')).toBe('news')
    expect(plural('media')).toBe('media')
    expect(plural('software')).toBe('software')
  })

  it('restores case', () => {
    expect(singular('Books')).toBe('Book')
    expect(plural('Category')).toBe('Categories')
    expect(plural('BOOK')).toBe('BOOKS')
  })

  it('exposes the upstream API surface', () => {
    expect(pluralize('book', 1)).toBe('book')
    expect(pluralize('book', 2)).toBe('books')
    expect(pluralize('book', 3, true)).toBe('3 books')
    expect(isPlural('books')).toBe(true)
    expect(isSingular('book')).toBe(true)
  })

  it('drives EntityManager label/routePrefix inference unchanged', () => {
    const m = new EntityManager({ name: 'categories' })
    expect(m.label).toBe('Category')
    expect(m.labelPlural).toBe('Categories')
    expect(m.routePrefix).toBe('category')

    const p = new EntityManager({ name: 'people' })
    expect(p.label).toBe('Person')
    expect(p.labelPlural).toBe('People')
  })
})
