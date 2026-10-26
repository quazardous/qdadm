/**
 * useCardsArrangement — the user's arrangement of a card dashboard (#4320):
 * order, hidden, pinned, kept per dashboard and per user in a storage the app
 * may provide (#4338: the server, per account); localStorage by default.
 *
 * The saved arrangement is reconciled with the cards the app declares on every
 * load: unknown ids are dropped, a new card takes its default place, a
 * required card is never hidden, a fixed card keeps its default place.
 *
 * The functions are pure; the composable wraps them with a ref and storage.
 */
import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
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

/**
 * Where arrangements are kept (#4338). `load` may answer at once (localStorage)
 * or with a promise (a server); whatever it gives back is reconciled with the
 * declared cards, so an old or partial shape is fine. `save(key, null)`: back
 * to the defaults.
 */
export interface CardsArrangementStorage {
  load(key: string): unknown | Promise<unknown>
  save(key: string, arrangement: CardsArrangement | null): void | Promise<void>
}

/** The default storage: localStorage; no storage at all (private window, blocked): the arrangement lasts the page */
export const localArrangementStorage: CardsArrangementStorage = {
  load(key) {
    try {
      const raw = globalThis.localStorage?.getItem(key)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  save(key, value) {
    try {
      if (value) globalThis.localStorage?.setItem(key, JSON.stringify(value))
      else globalThis.localStorage?.removeItem(key)
    } catch {
      // Quota or blocked: the arrangement lasts the page
    }
  },
}

const isThenable = (v: unknown): v is PromiseLike<unknown> => !!v && typeof (v as { then?: unknown }).then === 'function'

export interface UseCardsArrangementOptions {
  /** The storage, or a getter read at each load and save (default: localArrangementStorage) */
  storage?: CardsArrangementStorage | (() => CardsArrangementStorage)
  /** Save at each change (default true); false: only `commit()` and `reset()` save */
  autoSave?: boolean
  /** Ms an async load may take while `loading` holds the cards back (default 150) */
  loadGrace?: number
  /** A load or a save failed (default: a console warning) */
  onError?: (op: 'load' | 'save', error: unknown) => void
}

export interface UseCardsArrangementReturn {
  arrangement: Ref<CardsArrangement>
  groups: ComputedRef<CardsGroups>
  /** An async load is in its grace: hold the cards back rather than show the defaults */
  loading: Ref<boolean>
  saving: Ref<boolean>
  /** What is shown differs from what the storage holds */
  dirty: ComputedRef<boolean>
  move: (id: string, toIndex: number) => boolean
  pin: (id: string, pinned: boolean) => boolean
  hide: (id: string, hidden: boolean) => boolean
  /** Replace the arrangement without saving (a drag in progress) */
  preview: (next: CardsArrangement) => void
  /** Save what is shown; false when the storage failed */
  commit: () => Promise<boolean>
  /** Back to the defaults, in the storage too; false when the storage failed */
  reset: () => Promise<boolean>
}

/**
 * @param storageKey - the storage key (dashboard and user in it)
 * @param cards - the declared cards, in default order
 */
export function useCardsArrangement(
  storageKey: Ref<string>,
  cards: Ref<CardDef[]>,
  options: UseCardsArrangementOptions = {}
): UseCardsArrangementReturn {
  const storage = (): CardsArrangementStorage =>
    (typeof options.storage === 'function' ? options.storage() : options.storage) ?? localArrangementStorage
  const autoSave = options.autoSave ?? true
  const onError =
    options.onError ?? ((op, err) => console.warn(`[qdadm] CardsDashboard: the arrangement could not ${op === 'load' ? 'be loaded' : 'be saved'}:`, err))

  /** What the storage holds, as it gave it (reconciled again when the cards change) */
  let stored: unknown = null
  /** The user changed something since the last load: a late answer must not undo it */
  let touched = false
  let loadToken = 0
  let graceTimer: ReturnType<typeof setTimeout> | null = null

  const arrangement = ref<CardsArrangement>(defaultArrangement(cards.value))
  const savedJson = ref(JSON.stringify(arrangement.value))
  const loading = ref(false)
  const saving = ref(false)
  const dirty = computed(() => JSON.stringify(arrangement.value) !== savedJson.value)

  function settle(raw: unknown): void {
    stored = raw
    arrangement.value = reconcileArrangement(raw, cards.value)
    savedJson.value = JSON.stringify(arrangement.value)
  }

  function stopGrace(): void {
    if (graceTimer) clearTimeout(graceTimer)
    graceTimer = null
    loading.value = false
  }

  function load(): void {
    const token = ++loadToken
    const key = storageKey.value
    touched = false
    stopGrace()
    let answer: unknown
    try {
      answer = storage().load(key)
    } catch (err) {
      onError('load', err)
      settle(null)
      return
    }
    if (!isThenable(answer)) return settle(answer)
    // Async: the defaults wait out the grace, then show until the answer
    settle(null)
    loading.value = true
    graceTimer = setTimeout(stopGrace, options.loadGrace ?? 150)
    Promise.resolve(answer).then(
      (raw) => {
        if (token !== loadToken) return // another key since
        stopGrace()
        if (touched) {
          stored = raw
          savedJson.value = JSON.stringify(reconcileArrangement(raw, cards.value))
        } else settle(raw)
      },
      (err) => {
        if (token !== loadToken) return
        stopGrace()
        onError('load', err)
      }
    )
  }

  load()
  // A new user: load again
  watch(storageKey, load)
  // A changed set of cards: reconciled again, from what is shown if the user changed it
  watch(cards, () => {
    const saved = reconcileArrangement(stored, cards.value)
    savedJson.value = JSON.stringify(saved)
    arrangement.value = touched ? reconcileArrangement(arrangement.value, cards.value) : saved
  })
  onScopeDispose(() => {
    loadToken++
    stopGrace()
  })

  async function write(value: CardsArrangement | null): Promise<boolean> {
    const key = storageKey.value
    saving.value = true
    try {
      await storage().save(key, value)
      if (key === storageKey.value) {
        stored = value
        savedJson.value = JSON.stringify(value ?? defaultArrangement(cards.value))
      }
      return true
    } catch (err) {
      onError('save', err)
      return false
    } finally {
      saving.value = false
    }
  }

  const groups = computed(() => groupCards(arrangement.value, cards.value))

  const apply = (next: CardsArrangement): boolean => {
    if (next === arrangement.value) return false
    touched = true
    arrangement.value = next
    if (autoSave) void write(next)
    return true
  }

  return {
    arrangement,
    groups,
    loading,
    saving,
    dirty,
    move: (id, toIndex) => apply(moveCard(arrangement.value, cards.value, id, toIndex)),
    pin: (id, pinned) => apply(setPinned(arrangement.value, cards.value, id, pinned)),
    hide: (id, hidden) => apply(setHidden(arrangement.value, cards.value, id, hidden)),
    preview: (next) => {
      touched = true
      arrangement.value = next
    },
    commit: () => write(arrangement.value),
    reset: () => {
      touched = true
      arrangement.value = defaultArrangement(cards.value)
      return write(null)
    },
  }
}
