/**
 * The user's arrangement of a card dashboard (#4320): reconciliation with the
 * declared cards, moves around fixed cards, pin, hide, storage.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import {
  defaultArrangement,
  reconcileArrangement,
  groupCards,
  moveCard,
  setPinned,
  setHidden,
  useCardsArrangement,
} from '../../src/composables/useCardsArrangement'

const c = (id, card = {}) => ({ id, card: { title: id.toUpperCase(), ...card } })
const CARDS = [c('a'), c('b', { required: true }), c('c'), c('d', { pinned: true }), c('e')]
const ids = (list) => list.map((x) => x.id)

describe('reconcileArrangement', () => {
  it('falls back to the default on nothing, garbage or an unknown version', () => {
    const def = defaultArrangement(CARDS)
    expect(def).toEqual({ v: 1, order: ['a', 'b', 'c', 'd', 'e'], hidden: [], pinned: ['d'] })
    expect(reconcileArrangement(null, CARDS)).toEqual(def)
    expect(reconcileArrangement('nope', CARDS)).toEqual(def)
    expect(reconcileArrangement({ v: 99, order: ['e'] }, CARDS)).toEqual(def)
  })

  it('drops unknown ids and puts a new card after its default neighbour', () => {
    const saved = { v: 1, order: ['e', 'zzz', 'c', 'a', 'd'], hidden: ['zzz'], pinned: [] }
    // b is new: after a, its nearest earlier default neighbour
    expect(reconcileArrangement(saved, CARDS).order).toEqual(['e', 'c', 'a', 'b', 'd'])
  })

  it('never hides a required card; a new card takes its default pin', () => {
    const saved = { v: 1, order: ['a', 'b', 'c', 'e'], hidden: ['b', 'c'], pinned: [] }
    const r = reconcileArrangement(saved, CARDS)
    expect(r.hidden).toEqual(['c'])
    expect(r.pinned).toEqual(['d'])
    // A known card the user unpinned stays unpinned
    expect(reconcileArrangement({ ...saved, order: ['a', 'b', 'c', 'd', 'e'] }, CARDS).pinned).toEqual([])
  })

  it('puts a fixed card back at its default index', () => {
    const cards = [c('a'), c('b', { fixed: true }), c('c'), c('d')]
    expect(reconcileArrangement({ v: 1, order: ['d', 'c', 'a', 'b'], hidden: [], pinned: [] }, cards).order).toEqual(['d', 'b', 'c', 'a'])
  })
})

describe('moves', () => {
  it('moves within the visible group, pinned cards apart', () => {
    let a = defaultArrangement(CARDS)
    a = moveCard(a, CARDS, 'e', 0)
    expect(ids(groupCards(a, CARDS).rest)).toEqual(['e', 'a', 'b', 'c'])
    expect(ids(groupCards(a, CARDS).pinned)).toEqual(['d'])
    a = moveCard(a, CARDS, 'e', 3)
    expect(ids(groupCards(a, CARDS).rest)).toEqual(['a', 'b', 'c', 'e'])
  })

  it('flows around a fixed card, which never moves', () => {
    const cards = [c('a'), c('b', { fixed: true }), c('c'), c('d')]
    let a = defaultArrangement(cards)
    a = moveCard(a, cards, 'a', 3)
    expect(ids(groupCards(a, cards).rest)).toEqual(['c', 'b', 'd', 'a'])
    expect(moveCard(a, cards, 'b', 0)).toBe(a)
    a = moveCard(a, cards, 'd', 0)
    expect(ids(groupCards(a, cards).rest)).toEqual(['d', 'b', 'c', 'a'])
  })

  it('returns the same object when nothing moves', () => {
    const a = defaultArrangement(CARDS)
    expect(moveCard(a, CARDS, 'a', 0)).toBe(a)
  })

  it('pins to the end of the pinned group; hides and restores in place', () => {
    let a = defaultArrangement(CARDS)
    a = setPinned(a, CARDS, 'a', true)
    expect(ids(groupCards(a, CARDS).pinned)).toEqual(['d', 'a'])
    a = setHidden(a, CARDS, 'c', true)
    expect(ids(groupCards(a, CARDS).hidden)).toEqual(['c'])
    expect(setHidden(a, CARDS, 'b', true)).toBe(a) // required
    a = setHidden(a, CARDS, 'c', false)
    expect(ids(groupCards(a, CARDS).rest)).toEqual(['b', 'c', 'e'])
  })
})

describe('useCardsArrangement', () => {
  beforeEach(() => localStorage.clear())

  it('saves each change under its key, reads it back, and resets', async () => {
    const key = ref('qdadm.dashboard.home.bob')
    const cards = ref(CARDS)
    const one = useCardsArrangement(key, cards)
    one.move('e', 0)
    one.hide('c', true)
    expect(JSON.parse(localStorage.getItem('qdadm.dashboard.home.bob')).hidden).toEqual(['c'])

    const two = useCardsArrangement(ref('qdadm.dashboard.home.bob'), ref(CARDS))
    expect(ids(two.groups.value.rest)).toEqual(['e', 'a', 'b'])

    // Another user starts from the default
    key.value = 'qdadm.dashboard.home.june'
    await nextTick()
    expect(ids(one.groups.value.rest)).toEqual(['a', 'b', 'c', 'e'])

    two.reset()
    expect(localStorage.getItem('qdadm.dashboard.home.bob')).toBeNull()
    expect(ids(two.groups.value.rest)).toEqual(['a', 'b', 'c', 'e'])
  })

  it('works without storage', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked') } })
    try {
      const s = useCardsArrangement(ref('k'), ref(CARDS))
      expect(s.move('e', 0)).toBe(true)
      expect(ids(s.groups.value.rest)[0]).toBe('e')
    } finally {
      Object.defineProperty(globalThis, 'localStorage', original)
    }
  })
})
