/**
 * useFavorites / useRecent (#5349): the person's favourites and the records
 * they just opened, live, through the `favorites` and `recents` entities the
 * app declares (see store.ts).
 *
 * ```ts
 * const favorites = useFavorites()
 * await favorites.toggle({ kind: 'item', label: book.title, to: route.path, entity: 'books' })
 * favorites.list.value   // oldest first
 *
 * const recent = useRecent()
 * recent.list.value      // the last records opened, newest first
 * ```
 *
 * Without the entity, `available` is false and the lists stay empty.
 */
import { computed, inject, type ComputedRef } from 'vue'
import {
  changeFailed,
  getFavoritesConfig,
  liveList,
  managerOf,
  readFavorite,
  readRecent,
  reloadList,
  RECENT_MAX,
  type Favorite,
  type FavoritesManager,
  type LiveList,
  type RecentItem,
} from './store'

type FavoriteInput = Omit<Favorite, 'id' | 'at'>

export interface UseFavoritesReturn {
  /** The app declares the favorites entity */
  available: boolean
  list: ComputedRef<Favorite[]>
  /** The entity has answered */
  loaded: ComputedRef<boolean>
  /** The last read or change failed */
  error: ComputedRef<string | null>
  /** The favourite of this page, if any */
  find: (to: string) => Favorite | undefined
  /** A record's favourite, whichever of its pages added it */
  findItem: (entity: string, itemId: string | number) => Favorite | undefined
  has: (to: string) => boolean
  add: (entry: FavoriteInput) => Promise<Favorite | null>
  remove: (id: string) => Promise<void>
  /** Add it, or remove it when this page is already one; true when it is one now */
  toggle: (entry: FavoriteInput) => Promise<boolean>
  rename: (id: string, label: string) => Promise<void>
  /** Forget every favourite of a path (a deleted record) */
  forgetPath: (to: string) => Promise<void>
  /** Forget a deleted record's favourites */
  forgetItem: (entity: string, itemId: string | number) => Promise<void>
  reload: () => Promise<void>
}

export interface UseRecentReturn {
  available: boolean
  /** The last records opened, newest first */
  list: ComputedRef<RecentItem[]>
  loaded: ComputedRef<boolean>
  error: ComputedRef<string | null>
  /** A record opened now: first in the list, once, at most RECENT_MAX kept */
  record: (entry: Omit<RecentItem, 'id' | 'at'>) => Promise<void>
  /** A deleted record leaves the list */
  forget: (entity: string, itemId: string | number) => Promise<void>
  reload: () => Promise<void>
}

const EMPTY: LiveList<never> = { items: [], loaded: true, error: null }
let tempIds = 0
const tempId = () => `pending-${++tempIds}`

/** The id the storage gave the record it created */
function createdId(created: unknown, manager: FavoritesManager): string | null {
  const id = (created as Record<string, unknown> | null)?.[manager.idField ?? 'id']
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null
}

export function useFavorites(): UseFavoritesReturn {
  const orchestrator = inject<{ get?: (name: string) => unknown; has?: (name: string) => boolean } | null>('qdadmOrchestrator', null)
  const name = getFavoritesConfig().favorites
  const manager = managerOf(orchestrator, name)
  const state: LiveList<Favorite> = manager && name ? liveList(name, manager, readFavorite) : EMPTY

  const find = (to: string) => state.items.find((f) => f.to === to)
  /** A record's favourite, whichever of its pages added it */
  const findItem = (entity: string, itemId: string | number) => state.items.find((f) => f.entity === entity && f.itemId === String(itemId))
  const findEntry = (entry: FavoriteInput) => (entry.entity && entry.itemId ? findItem(entry.entity, entry.itemId) : undefined) ?? find(entry.to)

  async function add(entry: FavoriteInput): Promise<Favorite | null> {
    if (!manager || !name) return null
    const known = findEntry(entry)
    if (known) return known
    const fav: Favorite = { ...entry, id: tempId(), at: new Date().toISOString() }
    state.items.push(fav)
    const { id: _id, ...fields } = fav
    try {
      const id = createdId(await manager.create(fields), manager)
      const shown = state.items.find((f) => f.id === fav.id)
      if (shown && id) shown.id = id
      else if (!id) await reloadList(name, manager, readFavorite)
      return shown ?? fav
    } catch (err) {
      state.items = state.items.filter((f) => f.id !== fav.id)
      changeFailed(name, state, err)
      return null
    }
  }

  async function remove(id: string): Promise<void> {
    if (!manager || !name) return
    const before = state.items
    if (!before.some((f) => f.id === id)) return
    state.items = before.filter((f) => f.id !== id)
    try {
      await manager.delete(id)
    } catch (err) {
      state.items = before
      changeFailed(name, state, err)
    }
  }

  return {
    available: !!manager,
    list: computed(() => state.items),
    loaded: computed(() => state.loaded),
    error: computed(() => state.error),
    find,
    findItem,
    has: (to) => !!find(to),
    add,
    remove,
    async toggle(entry) {
      const known = findEntry(entry)
      if (known) {
        await remove(known.id)
        return false
      }
      return !!(await add(entry))
    },
    async rename(id, label) {
      const fav = state.items.find((f) => f.id === id)
      const text = label.trim()
      if (!manager || !name || !fav || !text || fav.label === text) return
      const old = fav.label
      fav.label = text
      try {
        await (manager.patch ?? manager.update)?.call(manager, id, { label: text })
      } catch (err) {
        fav.label = old
        changeFailed(name, state, err)
      }
    },
    async forgetPath(to) {
      for (const f of state.items.filter((x) => x.to === to || x.to.startsWith(`${to}?`))) await remove(f.id)
    },
    async forgetItem(entity, itemId) {
      for (const f of state.items.filter((x) => x.entity === entity && x.itemId === String(itemId))) await remove(f.id)
    },
    reload: () => (manager && name ? reloadList(name, manager, readFavorite) : Promise.resolve()),
  }
}

export function useRecent(): UseRecentReturn {
  const orchestrator = inject<{ get?: (name: string) => unknown; has?: (name: string) => boolean } | null>('qdadmOrchestrator', null)
  const name = getFavoritesConfig().recents
  const manager = managerOf(orchestrator, name)
  const state: LiveList<RecentItem> = manager && name ? liveList(name, manager, readRecent) : EMPTY

  async function drop(items: RecentItem[]): Promise<void> {
    if (!manager || !name) return
    const ids = new Set(items.map((r) => r.id))
    state.items = state.items.filter((r) => !ids.has(r.id))
    for (const r of items) {
      if (r.id.startsWith('pending-')) continue
      try {
        await manager.delete(r.id)
      } catch (err) {
        changeFailed(name, state, err)
      }
    }
  }

  return {
    available: !!manager,
    list: computed(() => [...state.items].sort((a, b) => b.at.localeCompare(a.at))),
    loaded: computed(() => state.loaded),
    error: computed(() => state.error),
    async record(entry) {
      if (!manager || !name) return
      const itemId = String(entry.itemId)
      const same = state.items.filter((r) => r.entity === entry.entity && r.itemId === itemId)
      const item: RecentItem = { ...entry, itemId, id: tempId(), at: new Date().toISOString() }
      state.items.push(item)
      // Older than the RECENT_MAX newest go
      const overflow = [...state.items].sort((a, b) => b.at.localeCompare(a.at)).filter((r) => !same.includes(r)).slice(RECENT_MAX)
      await drop([...same, ...overflow])
      const { id: _id, ...fields } = item
      try {
        const id = createdId(await manager.create(fields), manager)
        const shown = state.items.find((r) => r.id === item.id)
        if (shown && id) shown.id = id
      } catch (err) {
        state.items = state.items.filter((r) => r.id !== item.id)
        changeFailed(name, state, err)
      }
    },
    async forget(entity, itemId) {
      await drop(state.items.filter((r) => r.entity === entity && r.itemId === String(itemId)))
    },
    reload: () => (manager && name ? reloadList(name, manager, readRecent) : Promise.resolve()),
  }
}
