/**
 * useCardsArrangement — the user's arrangement of a card dashboard (#4320):
 * order, hidden, pinned, kept in localStorage per dashboard and per user.
 *
 * The saved arrangement is reconciled with the cards the app declares on every
 * load: unknown ids are dropped, a new card takes its default place, a
 * required card is never hidden, a fixed card keeps its default place.
 *
 * The functions are pure; the composable wraps them with a ref and storage.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { BlockCard } from '../zones/ZoneRegistry'

/** A card as the dashboard knows it: its id and its declaration, in default order. */
export interface CardDef {
  id: string
  card: BlockCard & { title: string }
}

export interface CardsArrangement {
  v: 1
  /** Every known card, hidden ones included: a restored card comes back where it was */
  order: string[]
  hidden: string[]
  pinned: string[]
}

export interface CardsGroups {
  pinned: CardDef[]
  rest: CardDef[]
  hidden: CardDef[]
}

export const CARDS_ARRANGEMENT_VERSION = 1

/** Migrations from an older saved version to the next; none yet. */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {}

export function defaultArrangement(cards: CardDef[]): CardsArrangement {
  return {
    v: 1,
    order: cards.map((c) => c.id),
    hidden: [],
    pinned: cards.filter((c) => c.card.pinned).map((c) => c.id),
  }
}

/** Fixed cards back at their default index, the others flowing around them. */
function placeFixed(order: string[], cards: CardDef[]): string[] {
  const fixed = cards.map((c, i) => ({ c, i })).filter(({ c }) => c.card.fixed)
  if (!fixed.length) return order
  const fixedIds = new Set(fixed.map(({ c }) => c.id))
  const out = order.filter((id) => !fixedIds.has(id))
  for (const { c, i } of fixed) out.splice(Math.min(i, out.length), 0, c.id)
  return out
}

/** Bring a saved arrangement (any shape, any version) in line with the declared cards. */
export function reconcileArrangement(saved: unknown, cards: CardDef[]): CardsArrangement {
  const fallback = defaultArrangement(cards)
  let data = saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : null
  if (!data) return fallback
  for (let v = Number(data.v); v < CARDS_ARRANGEMENT_VERSION && MIGRATIONS[v]; v = Number(data.v)) data = MIGRATIONS[v]!(data)
  if (data.v !== CARDS_ARRANGEMENT_VERSION) return fallback

  const byId = new Map(cards.map((c) => [c.id, c]))
  const ids = (list: unknown): string[] => (Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string' && byId.has(id)) : [])
  const savedOrder = [...new Set(ids(data.order))]
  const known = new Set(savedOrder)

  // A new card goes after its nearest earlier neighbour in the default order
  const order = [...savedOrder]
  cards.forEach((c, i) => {
    if (known.has(c.id)) return
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const k = order.indexOf(cards[j]!.id)
      if (k !== -1) {
        at = k + 1
        break
      }
    }
    order.splice(at, 0, c.id)
  })

  const hidden = ids(data.hidden).filter((id) => !byId.get(id)!.card.required)
  // A fixed card keeps its declared pin; a new card takes its default
  const pinned = new Set(ids(data.pinned).filter((id) => !byId.get(id)!.card.fixed))
  for (const c of cards) if (c.card.pinned && (c.card.fixed || !known.has(c.id))) pinned.add(c.id)
  return { v: 1, order: placeFixed(order, cards), hidden: [...new Set(hidden)], pinned: order.filter((id) => pinned.has(id)) }
}

export function groupCards(arrangement: CardsArrangement, cards: CardDef[]): CardsGroups {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const hidden = new Set(arrangement.hidden)
  const pinned = new Set(arrangement.pinned)
  const inOrder = arrangement.order.map((id) => byId.get(id)).filter((c): c is CardDef => !!c)
  return {
    pinned: inOrder.filter((c) => pinned.has(c.id) && !hidden.has(c.id)),
    rest: inOrder.filter((c) => !pinned.has(c.id) && !hidden.has(c.id)),
    hidden: inOrder.filter((c) => hidden.has(c.id)),
  }
}

/** The visible group a card is in, as ids. */
function groupOf(arrangement: CardsArrangement, cards: CardDef[], id: string): string[] {
  const g = groupCards(arrangement, cards)
  const group = g.pinned.some((c) => c.id === id) ? g.pinned : g.rest
  return group.map((c) => c.id)
}

/**
 * Move a card to an index of its visible group. Fixed cards keep their index
 * in the group; the others flow around them. Returns the same object when
 * nothing moves.
 */
export function moveCard(arrangement: CardsArrangement, cards: CardDef[], id: string, toIndex: number): CardsArrangement {
  const byId = new Map(cards.map((c) => [c.id, c]))
  if (byId.get(id)?.card.fixed) return arrangement
  const group = groupOf(arrangement, cards, id)
  const from = group.indexOf(id)
  if (from === -1) return arrangement
  const fixed = group.map((gid, i) => ({ gid, i })).filter(({ gid }) => byId.get(gid)?.card.fixed)
  const movable = group.filter((gid) => !byId.get(gid)?.card.fixed && gid !== id)
  // Target in the group's coordinates: the movable cards before it are its
  // non-fixed slots
  const target = Math.max(0, Math.min(toIndex, group.length - 1))
  movable.splice(target - fixed.filter(({ i }) => i < target).length, 0, id)
  for (const { gid, i } of fixed) movable.splice(i, 0, gid)
  if (movable.every((gid, i) => gid === group[i])) return arrangement
  // Write the group back into the slots its cards held in the full order
  const slots = arrangement.order.map((oid, i) => (group.includes(oid) ? i : -1)).filter((i) => i !== -1)
  const order = [...arrangement.order]
  slots.forEach((slot, k) => (order[slot] = movable[k]!))
  return { ...arrangement, order }
}

export function setPinned(arrangement: CardsArrangement, cards: CardDef[], id: string, pinned: boolean): CardsArrangement {
  const card = cards.find((c) => c.id === id)
  if (!card || card.card.fixed || arrangement.pinned.includes(id) === pinned) return arrangement
  // It joins the end of its new group
  const order = [...arrangement.order.filter((oid) => oid !== id), id]
  const pinnedSet = new Set(arrangement.pinned)
  if (pinned) pinnedSet.add(id)
  else pinnedSet.delete(id)
  return { ...arrangement, order: placeFixed(order, cards), pinned: order.filter((oid) => pinnedSet.has(oid)) }
}

export function setHidden(arrangement: CardsArrangement, cards: CardDef[], id: string, hidden: boolean): CardsArrangement {
  const card = cards.find((c) => c.id === id)
  if (!card || (hidden && card.card.required) || arrangement.hidden.includes(id) === hidden) return arrangement
  return { ...arrangement, hidden: hidden ? [...arrangement.hidden, id] : arrangement.hidden.filter((h) => h !== id) }
}

function readStorage(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: CardsArrangement | null): void {
  try {
    if (value) globalThis.localStorage?.setItem(key, JSON.stringify(value))
    else globalThis.localStorage?.removeItem(key)
  } catch {
    // No storage (private window, quota, blocked): the arrangement lasts the page
  }
}

export interface UseCardsArrangementReturn {
  arrangement: Ref<CardsArrangement>
  groups: ComputedRef<CardsGroups>
  move: (id: string, toIndex: number) => boolean
  pin: (id: string, pinned: boolean) => boolean
  hide: (id: string, hidden: boolean) => boolean
  /** Replace the arrangement without saving (a drag in progress) */
  preview: (next: CardsArrangement) => void
  /** Save what is shown */
  commit: () => void
  reset: () => void
}

/**
 * @param storageKey - the localStorage key (dashboard and user in it)
 * @param cards - the declared cards, in default order
 */
export function useCardsArrangement(storageKey: Ref<string>, cards: Ref<CardDef[]>): UseCardsArrangementReturn {
  const arrangement = ref<CardsArrangement>(reconcileArrangement(readStorage(storageKey.value), cards.value))
  // A new user or a changed set of cards: read again, reconciled
  watch([storageKey, cards], () => {
    arrangement.value = reconcileArrangement(readStorage(storageKey.value), cards.value)
  })
  const groups = computed(() => groupCards(arrangement.value, cards.value))

  const apply = (next: CardsArrangement): boolean => {
    if (next === arrangement.value) return false
    arrangement.value = next
    writeStorage(storageKey.value, next)
    return true
  }

  return {
    arrangement,
    groups,
    move: (id, toIndex) => apply(moveCard(arrangement.value, cards.value, id, toIndex)),
    pin: (id, pinned) => apply(setPinned(arrangement.value, cards.value, id, pinned)),
    hide: (id, hidden) => apply(setHidden(arrangement.value, cards.value, id, hidden)),
    preview: (next) => {
      arrangement.value = next
    },
    commit: () => writeStorage(storageKey.value, arrangement.value),
    reset: () => {
      writeStorage(storageKey.value, null)
      arrangement.value = defaultArrangement(cards.value)
    },
  }
}
