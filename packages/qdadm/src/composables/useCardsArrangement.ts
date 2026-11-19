/**
 * useCardsArrangement — the user's arrangement of a card dashboard (#4320):
 * order, hidden, pinned, kept per dashboard and per user in a storage the app
 * may provide (#4338: the server, per account); localStorage by default.
 * Since #5348: cards added from a repeatable block with their parameters
 * (instances), the size each person picks, named sections.
 *
 * The saved arrangement is reconciled with the cards the app declares on every
 * load: unknown ids are dropped, a new card takes its default place, a
 * required card is never hidden, a fixed card keeps its default place, an
 * instance whose block is gone or whose parameters no longer fit is dropped.
 *
 * The functions are pure; the composable wraps them with a ref and storage.
 */
import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { BlockCard, CardSizeName } from '../zones/ZoneRegistry'
import { validateCardData } from '../cards/validate'

/**
 * A card as the dashboard knows it: its id and its declaration, in default
 * order. A repeatable block is declared too (`card.repeatable`): it is not
 * shown, it is what instances are added from.
 */
export interface CardDef {
  id: string
  card: BlockCard & { title: string }
  /** An instance: the repeatable block it comes from, and its parameters */
  block?: string
  params?: Record<string, unknown>
}

/** A card added from a repeatable block, with its parameters */
export interface CardInstance {
  id: string
  block: string
  params: Record<string, unknown>
  /** Its own title; default the block's */
  title?: string
}

export interface CardsSection {
  id: string
  title: string
}

export interface CardsArrangement {
  v: 2
  /** Every known card, hidden ones included: a restored card comes back where it was */
  order: string[]
  hidden: string[]
  pinned: string[]
  /** The size each person picked, by card */
  sizes: Record<string, CardSizeName>
  /** Named sections, in order; none: one unnamed group, as before */
  sections: CardsSection[]
  /** The section of each card; a card without one is in the first */
  sectionOf: Record<string, string>
  instances: CardInstance[]
}

export interface CardsSectionGroup {
  /** null: the one unnamed group of a board without sections */
  section: CardsSection | null
  cards: CardDef[]
}

export interface CardsGroups {
  pinned: CardDef[]
  rest: CardDef[]
  hidden: CardDef[]
  /** `rest`, by section */
  sections: CardsSectionGroup[]
}

export const CARDS_ARRANGEMENT_VERSION = 2

export const CARD_SIZES: readonly CardSizeName[] = ['s', 'm', 'l']
const SPAN: Record<CardSizeName, number> = { s: 1, m: 2, l: 3 }

/** Migrations from an older saved version to the next */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 had order, hidden, pinned: nothing else to carry over
  1: (old) => ({ ...old, v: 2, sizes: {}, sections: [], sectionOf: {}, instances: [] }),
}

/** The sizes a card may take */
export function cardSizes(c: CardDef): CardSizeName[] {
  const allowed = (c.card.sizes ?? CARD_SIZES).filter((s) => CARD_SIZES.includes(s))
  return allowed.length ? allowed : [...CARD_SIZES]
}

/** Columns a card spans: the size picked, else its declared span */
export function cardSpan(arrangement: CardsArrangement, c: CardDef): number {
  const size = arrangement.sizes[c.id]
  if (size && cardSizes(c).includes(size)) return SPAN[size]
  return Math.max(1, Math.min(3, Math.round(c.card.span ?? 1)))
}

/** The cards shown or hidden: the declared ones, without the repeatable blocks, then the instances */
export function effectiveCards(arrangement: Pick<CardsArrangement, 'instances'>, cards: CardDef[]): CardDef[] {
  const templates = new Map(cards.filter((c) => c.card.repeatable).map((c) => [c.id, c]))
  const instances = (arrangement.instances ?? []).flatMap((inst): CardDef[] => {
    const t = templates.get(inst.block)
    if (!t) return []
    const { repeatable: _r, params: _p, required: _q, fixed: _f, pinned: _n, ...rest } = t.card
    return [{ id: inst.id, card: { ...rest, title: inst.title || t.card.title }, block: t.id, params: inst.params }]
  })
  return [...cards.filter((c) => !c.card.repeatable), ...instances]
}

export function defaultArrangement(cards: CardDef[]): CardsArrangement {
  const shown = cards.filter((c) => !c.card.repeatable)
  return {
    v: 2,
    order: shown.map((c) => c.id),
    hidden: [],
    pinned: shown.filter((c) => c.card.pinned).map((c) => c.id),
    sizes: {},
    sections: [],
    sectionOf: {},
    instances: [],
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

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** The instances still worth keeping: their block is there, their parameters fit its schema */
function keptInstances(list: unknown, cards: CardDef[]): CardInstance[] {
  if (!Array.isArray(list)) return []
  const templates = new Map(cards.filter((c) => c.card.repeatable).map((c) => [c.id, c]))
  const seen = new Set(cards.map((c) => c.id))
  const kept: CardInstance[] = []
  for (const raw of list) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.block !== 'string' || seen.has(raw.id)) continue
    const t = templates.get(raw.block)
    if (!t) continue
    const params = isRecord(raw.params) ? raw.params : {}
    if (t.card.params) {
      const problems = validateCardData(params, t.card.params, 'params')
      if (problems.length) {
        console.warn(`[qdadm] CardsDashboard: card "${raw.id}" dropped, its parameters no longer fit "${raw.block}": ${problems[0]!.path} ${problems[0]!.message}`)
        continue
      }
    }
    seen.add(raw.id)
    kept.push({ id: raw.id, block: raw.block, params, ...(typeof raw.title === 'string' && raw.title ? { title: raw.title } : {}) })
  }
  return kept
}

/** Bring a saved arrangement (any shape, any version) in line with the declared cards. */
export function reconcileArrangement(saved: unknown, cards: CardDef[]): CardsArrangement {
  const fallback = defaultArrangement(cards)
  let data = isRecord(saved) ? saved : null
  if (!data) return fallback
  for (let v = Number(data.v); v < CARDS_ARRANGEMENT_VERSION && MIGRATIONS[v]; v = Number(data.v)) data = MIGRATIONS[v]!(data)
  if (data.v !== CARDS_ARRANGEMENT_VERSION) return fallback

  const instances = keptInstances(data.instances, cards)
  const all = effectiveCards({ instances }, cards)
  const instanceIds = new Set(instances.map((i) => i.id))
  const byId = new Map(all.map((c) => [c.id, c]))
  const ids = (list: unknown): string[] => (Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string' && byId.has(id)) : [])
  const savedOrder = [...new Set(ids(data.order))]
  const known = new Set(savedOrder)

  // A new card goes after its nearest earlier neighbour in the default order
  const order = [...savedOrder]
  all.forEach((c, i) => {
    if (known.has(c.id)) return
    let at = instanceIds.has(c.id) ? order.length : 0
    for (let j = i - 1; j >= 0 && !instanceIds.has(c.id); j--) {
      const k = order.indexOf(all[j]!.id)
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
  for (const c of all) if (c.card.pinned && (c.card.fixed || !known.has(c.id))) pinned.add(c.id)

  const sizes: Record<string, CardSizeName> = {}
  if (isRecord(data.sizes)) {
    for (const [id, size] of Object.entries(data.sizes)) {
      const c = byId.get(id)
      if (c && cardSizes(c).includes(size as CardSizeName)) sizes[id] = size as CardSizeName
    }
  }
  const sections: CardsSection[] = []
  if (Array.isArray(data.sections)) {
    for (const s of data.sections) {
      if (isRecord(s) && typeof s.id === 'string' && typeof s.title === 'string' && !sections.some((x) => x.id === s.id)) sections.push({ id: s.id, title: s.title })
    }
  }
  const sectionIds = new Set(sections.map((s) => s.id))
  const sectionOf: Record<string, string> = {}
  if (isRecord(data.sectionOf)) {
    for (const [id, sid] of Object.entries(data.sectionOf)) if (byId.has(id) && typeof sid === 'string' && sectionIds.has(sid)) sectionOf[id] = sid
  }

  return {
    v: 2,
    order: placeFixed(order, all),
    hidden: [...new Set(hidden)],
    pinned: order.filter((id) => pinned.has(id)),
    sizes,
    sections,
    sectionOf,
    instances,
  }
}

/** The section a card is in: its own, else the first; null on a board without sections */
export function sectionOfCard(arrangement: CardsArrangement, id: string): string | null {
  const own = arrangement.sectionOf[id]
  if (own && arrangement.sections.some((s) => s.id === own)) return own
  return arrangement.sections[0]?.id ?? null
}

export function groupCards(arrangement: CardsArrangement, cards: CardDef[]): CardsGroups {
  const all = effectiveCards(arrangement, cards)
  const byId = new Map(all.map((c) => [c.id, c]))
  const hidden = new Set(arrangement.hidden)
  const pinned = new Set(arrangement.pinned)
  const inOrder = arrangement.order.map((id) => byId.get(id)).filter((c): c is CardDef => !!c)
  const rest = inOrder.filter((c) => !pinned.has(c.id) && !hidden.has(c.id))
  const sections: CardsSectionGroup[] = arrangement.sections.length
    ? arrangement.sections.map((section) => ({ section, cards: rest.filter((c) => sectionOfCard(arrangement, c.id) === section.id) }))
    : [{ section: null, cards: rest }]
  return {
    pinned: inOrder.filter((c) => pinned.has(c.id) && !hidden.has(c.id)),
    rest,
    hidden: inOrder.filter((c) => hidden.has(c.id)),
    sections,
  }
}

/** The visible group a card moves in, as ids: the pinned ones, or its section */
function groupOf(arrangement: CardsArrangement, cards: CardDef[], id: string): string[] {
  const g = groupCards(arrangement, cards)
  if (g.pinned.some((c) => c.id === id)) return g.pinned.map((c) => c.id)
  return (g.sections.find((s) => s.cards.some((c) => c.id === id))?.cards ?? []).map((c) => c.id)
}

/** The cards a card moves among, as the dashboard shows them */
export function cardGroup(arrangement: CardsArrangement, cards: CardDef[], id: string): CardDef[] {
  const byId = new Map(effectiveCards(arrangement, cards).map((c) => [c.id, c]))
  return groupOf(arrangement, cards, id).map((gid) => byId.get(gid)!)
}

/**
 * Move a card to an index of its visible group. Fixed cards keep their index
 * in the group; the others flow around them. Returns the same object when
 * nothing moves.
 */
export function moveCard(arrangement: CardsArrangement, cards: CardDef[], id: string, toIndex: number): CardsArrangement {
  const byId = new Map(effectiveCards(arrangement, cards).map((c) => [c.id, c]))
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
  const all = effectiveCards(arrangement, cards)
  const card = all.find((c) => c.id === id)
  if (!card || card.card.fixed || arrangement.pinned.includes(id) === pinned) return arrangement
  // It joins the end of its new group
  const order = [...arrangement.order.filter((oid) => oid !== id), id]
  const pinnedSet = new Set(arrangement.pinned)
  if (pinned) pinnedSet.add(id)
  else pinnedSet.delete(id)
  return { ...arrangement, order: placeFixed(order, all), pinned: order.filter((oid) => pinnedSet.has(oid)) }
}

export function setHidden(arrangement: CardsArrangement, cards: CardDef[], id: string, hidden: boolean): CardsArrangement {
  const card = effectiveCards(arrangement, cards).find((c) => c.id === id)
  if (!card || (hidden && card.card.required) || arrangement.hidden.includes(id) === hidden) return arrangement
  return { ...arrangement, hidden: hidden ? [...arrangement.hidden, id] : arrangement.hidden.filter((h) => h !== id) }
}

/** The size a person picked for a card, among the ones it allows; null: back to its default */
export function setSize(arrangement: CardsArrangement, cards: CardDef[], id: string, size: CardSizeName | null): CardsArrangement {
  const card = effectiveCards(arrangement, cards).find((c) => c.id === id)
  if (!card || (size && !cardSizes(card).includes(size)) || (arrangement.sizes[id] ?? null) === size) return arrangement
  const sizes = { ...arrangement.sizes }
  if (size) sizes[id] = size
  else delete sizes[id]
  return { ...arrangement, sizes }
}

const newId = (prefix: string, taken: Set<string>): string => {
  let id: string
  do id = `${prefix}${Math.random().toString(36).slice(2, 8)}`
  while (taken.has(id))
  return id
}

/** A card added from a repeatable block, at the end of a section (default the first) */
export function addInstance(
  arrangement: CardsArrangement,
  cards: CardDef[],
  block: string,
  params: Record<string, unknown>,
  { title, section }: { title?: string; section?: string | null } = {}
): { arrangement: CardsArrangement; id: string | null } {
  const template = cards.find((c) => c.id === block && c.card.repeatable)
  if (!template) return { arrangement, id: null }
  if (template.card.params && validateCardData(params, template.card.params, 'params').length) return { arrangement, id: null }
  const id = newId(`${block}~`, new Set([...cards.map((c) => c.id), ...arrangement.order]))
  const sectionOf = { ...arrangement.sectionOf }
  const sid = section && arrangement.sections.some((s) => s.id === section) ? section : null
  if (sid) sectionOf[id] = sid
  return {
    id,
    arrangement: {
      ...arrangement,
      order: [...arrangement.order, id],
      instances: [...arrangement.instances, { id, block, params: { ...params }, ...(title ? { title } : {}) }],
      sectionOf,
    },
  }
}

/** An added card, gone for good */
export function removeInstance(arrangement: CardsArrangement, id: string): CardsArrangement {
  if (!arrangement.instances.some((i) => i.id === id)) return arrangement
  const { [id]: _size, ...sizes } = arrangement.sizes
  const { [id]: _section, ...sectionOf } = arrangement.sectionOf
  return {
    ...arrangement,
    order: arrangement.order.filter((o) => o !== id),
    hidden: arrangement.hidden.filter((o) => o !== id),
    pinned: arrangement.pinned.filter((o) => o !== id),
    instances: arrangement.instances.filter((i) => i.id !== id),
    sizes,
    sectionOf,
  }
}

/** A new named section, at the end */
export function addSection(arrangement: CardsArrangement, title: string): { arrangement: CardsArrangement; id: string } {
  const id = newId('section-', new Set(arrangement.sections.map((s) => s.id)))
  return { id, arrangement: { ...arrangement, sections: [...arrangement.sections, { id, title }] } }
}

export function renameSection(arrangement: CardsArrangement, id: string, title: string): CardsArrangement {
  if (!arrangement.sections.some((s) => s.id === id && s.title !== title)) return arrangement
  return { ...arrangement, sections: arrangement.sections.map((s) => (s.id === id ? { ...s, title } : s)) }
}

/** A section gone: its cards go back to the first section */
export function removeSection(arrangement: CardsArrangement, id: string): CardsArrangement {
  if (!arrangement.sections.some((s) => s.id === id)) return arrangement
  const sectionOf = Object.fromEntries(Object.entries(arrangement.sectionOf).filter(([, sid]) => sid !== id))
  return { ...arrangement, sections: arrangement.sections.filter((s) => s.id !== id), sectionOf }
}

/** Move a card to another section, at its end */
export function setSection(arrangement: CardsArrangement, cards: CardDef[], id: string, section: string): CardsArrangement {
  const card = effectiveCards(arrangement, cards).find((c) => c.id === id)
  if (!card || card.card.fixed || !arrangement.sections.some((s) => s.id === section) || sectionOfCard(arrangement, id) === section) return arrangement
  return {
    ...arrangement,
    order: [...arrangement.order.filter((o) => o !== id), id],
    sectionOf: { ...arrangement.sectionOf, [id]: section },
  }
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
  /** The cards shown or hidden: the declared ones, then the instances */
  allCards: ComputedRef<CardDef[]>
  move: (id: string, toIndex: number) => boolean
  pin: (id: string, pinned: boolean) => boolean
  hide: (id: string, hidden: boolean) => boolean
  /** The size picked for a card; null: its default */
  resize: (id: string, size: CardSizeName | null) => boolean
  /** Add a card from a repeatable block; its id, or null when the block or the parameters do not fit */
  add: (block: string, params: Record<string, unknown>, options?: { title?: string; section?: string | null }) => string | null
  /** Remove an added card */
  remove: (id: string) => boolean
  addSection: (title: string) => string
  renameSection: (id: string, title: string) => boolean
  removeSection: (id: string) => boolean
  moveToSection: (id: string, section: string) => boolean
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
    allCards: computed(() => effectiveCards(arrangement.value, cards.value)),
    move: (id, toIndex) => apply(moveCard(arrangement.value, cards.value, id, toIndex)),
    pin: (id, pinned) => apply(setPinned(arrangement.value, cards.value, id, pinned)),
    hide: (id, hidden) => apply(setHidden(arrangement.value, cards.value, id, hidden)),
    resize: (id, size) => apply(setSize(arrangement.value, cards.value, id, size)),
    add: (block, params, opts) => {
      const r = addInstance(arrangement.value, cards.value, block, params, opts)
      if (r.id) apply(r.arrangement)
      return r.id
    },
    remove: (id) => apply(removeInstance(arrangement.value, id)),
    addSection: (title) => {
      const r = addSection(arrangement.value, title)
      apply(r.arrangement)
      return r.id
    },
    renameSection: (id, title) => apply(renameSection(arrangement.value, id, title)),
    removeSection: (id) => apply(removeSection(arrangement.value, id)),
    moveToSection: (id, section) => apply(setSection(arrangement.value, cards.value, id, section)),
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
