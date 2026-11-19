/**
 * The arrangement v2 (#5348): cards added from a repeatable block with their
 * parameters, the size each person picks, named sections; a v1 arrangement
 * migrates as it is.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import {
  defaultArrangement,
  reconcileArrangement,
  groupCards,
  moveCard,
  setHidden,
  setSize,
  addInstance,
  removeInstance,
  addSection,
  renameSection,
  removeSection,
  setSection,
  effectiveCards,
  cardSpan,
} from '../../src/composables/useCardsArrangement'

const c = (id, card = {}) => ({ id, card: { title: id.toUpperCase(), ...card } })
const SEARCH = c('search', {
  repeatable: true,
  params: { type: 'object', required: ['genre'], properties: { genre: { type: 'string', enum: ['sci-fi', 'fantasy'] }, max: { type: 'integer', minimum: 1 } } },
})
const CARDS = [c('a'), c('b', { sizes: ['s', 'm'] }), c('c'), SEARCH]
const ids = (list) => list.map((x) => x.id)

describe('the arrangement v2 (#5348)', () => {
  it('a repeatable block is not a card: only its instances are', () => {
    const def = defaultArrangement(CARDS)
    expect(def.order).toEqual(['a', 'b', 'c'])
    expect(ids(effectiveCards(def, CARDS))).toEqual(['a', 'b', 'c'])
  })

  it('a v1 arrangement migrates as it is', () => {
    const r = reconcileArrangement({ v: 1, order: ['c', 'a', 'b'], hidden: ['b'], pinned: ['c'] }, CARDS)
    expect(r).toEqual({ v: 2, order: ['c', 'a', 'b'], hidden: ['b'], pinned: ['c'], sizes: {}, sections: [], sectionOf: {}, instances: [] })
  })

  it('adds an instance with its parameters, several of one block, and removes one for good', () => {
    let arr = defaultArrangement(CARDS)
    const one = addInstance(arr, CARDS, 'search', { genre: 'sci-fi' }, { title: 'Sci-fi' })
    arr = one.arrangement
    const two = addInstance(arr, CARDS, 'search', { genre: 'fantasy', max: 3 })
    arr = two.arrangement
    expect(one.id).toMatch(/^search~/)
    expect(two.id).not.toBe(one.id)
    const all = effectiveCards(arr, CARDS)
    expect(all.find((x) => x.id === one.id)).toMatchObject({ block: 'search', params: { genre: 'sci-fi' }, card: { title: 'Sci-fi' } })
    expect(all.find((x) => x.id === two.id).card.title).toBe('SEARCH')
    expect(arr.order.slice(-2)).toEqual([one.id, two.id])

    arr = setHidden(arr, CARDS, one.id, true)
    expect(ids(groupCards(arr, CARDS).hidden)).toEqual([one.id])
    arr = removeInstance(arr, one.id)
    expect(arr.order).not.toContain(one.id)
    expect(arr.hidden).toEqual([])
    expect(arr.instances.map((i) => i.id)).toEqual([two.id])
  })

  it('refuses parameters that do not fit, and an unknown block', () => {
    const arr = defaultArrangement(CARDS)
    expect(addInstance(arr, CARDS, 'search', {}).id).toBeNull()
    expect(addInstance(arr, CARDS, 'search', { genre: 'horror' }).id).toBeNull()
    expect(addInstance(arr, CARDS, 'a', {}).id).toBeNull()
    expect(addInstance(arr, CARDS, 'nope', {}).id).toBeNull()
  })

  it('reconciling drops an instance whose block is gone or whose parameters no longer fit, and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const saved = {
      v: 2,
      order: ['a', 'search~1', 'search~2', 'gone~1', 'b', 'c'],
      hidden: [],
      pinned: [],
      sizes: { 'search~1': 'l' },
      sections: [],
      sectionOf: {},
      instances: [
        { id: 'search~1', block: 'search', params: { genre: 'sci-fi' } },
        { id: 'search~2', block: 'search', params: { genre: 'horror' } },
        { id: 'gone~1', block: 'gone', params: {} },
      ],
    }
    const r = reconcileArrangement(saved, CARDS)
    expect(r.order).toEqual(['a', 'search~1', 'b', 'c'])
    expect(r.instances.map((i) => i.id)).toEqual(['search~1'])
    expect(r.sizes).toEqual({ 'search~1': 'l' })
    expect(warn.mock.calls.map((w) => String(w[0])).join('\n')).toContain('search~2')
    warn.mockRestore()
  })

  it('a size among the ones the card allows; the declared span otherwise', () => {
    let arr = defaultArrangement(CARDS)
    const b = CARDS[1]
    expect(cardSpan(arr, b)).toBe(1)
    arr = setSize(arr, CARDS, 'b', 'm')
    expect(cardSpan(arr, b)).toBe(2)
    expect(setSize(arr, CARDS, 'b', 'l')).toBe(arr)
    arr = setSize(arr, CARDS, 'b', null)
    expect(arr.sizes).toEqual({})
    // A saved size the card no longer allows is dropped
    expect(reconcileArrangement({ ...arr, sizes: { b: 'l', a: 'm' } }, CARDS).sizes).toEqual({ a: 'm' })
  })

  it('sections: cards in the first by default, moved to another, back to the first when theirs is removed', () => {
    let arr = defaultArrangement(CARDS)
    expect(groupCards(arr, CARDS).sections).toEqual([{ section: null, cards: groupCards(arr, CARDS).rest }])
    const main = addSection(arr, 'Main')
    arr = main.arrangement
    const sales = addSection(arr, 'Sales')
    arr = sales.arrangement
    let g = groupCards(arr, CARDS)
    expect(g.sections.map((s) => [s.section.title, ids(s.cards)])).toEqual([['Main', ['a', 'b', 'c']], ['Sales', []]])

    arr = setSection(arr, CARDS, 'b', sales.id)
    arr = setSection(arr, CARDS, 'a', sales.id)
    g = groupCards(arr, CARDS)
    expect(g.sections.map((s) => ids(s.cards))).toEqual([['c'], ['b', 'a']])
    // A card moves within its section only
    arr = moveCard(arr, CARDS, 'a', 0)
    expect(groupCards(arr, CARDS).sections.map((s) => ids(s.cards))).toEqual([['c'], ['a', 'b']])

    arr = renameSection(arr, sales.id, 'Sales team')
    expect(arr.sections[1].title).toBe('Sales team')
    arr = removeSection(arr, sales.id)
    expect(groupCards(arr, CARDS).sections.map((s) => [s.section.title, ids(s.cards)])).toEqual([['Main', ['c', 'a', 'b']]])
  })

  it('an instance goes to the section asked for', () => {
    let arr = defaultArrangement(CARDS)
    arr = addSection(arr, 'Main').arrangement
    const books = addSection(arr, 'Books')
    arr = books.arrangement
    const r = addInstance(arr, CARDS, 'search', { genre: 'fantasy' }, { section: books.id })
    expect(groupCards(r.arrangement, CARDS).sections[1].cards.map((x) => x.id)).toEqual([r.id])
  })
})
