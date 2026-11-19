/**
 * Favourites and recents (#5349): what a person follows, and the records they
 * just opened, kept as two entities the app declares, `favorites` and
 * `recents` by default (`configureFavorites` names others), through their
 * EntityManager and storage. Whose they are is the storage's business: a
 * server answers the current user's; a local storage keeps the browser's.
 *
 * What qdadm writes in them:
 * - favorites: `{ kind, label, to, entity?, itemId?, at }`
 * - recents: `{ entity, itemId, label, to, at }`
 * `at` is an ISO date. Any other field the app adds is kept.
 *
 * One live list per entity, shared by every component of the tab: a star
 * clicked in a header shows at once in the favorites card. Without the
 * entity, there is nothing to show: the star and "Save this search" hide,
 * nothing is recorded.
 */
import { reactive } from 'vue'
import { getEntityConfig } from '../module/moduleRegistry'

/** A page someone follows */
export interface Favorite {
  /** The record's id in the favorites entity */
  id: string
  kind: 'item' | 'list' | 'search' | 'board'
  label: string
  /** The page, as a path (with its query for a search) */
  to: string
  entity?: string
  /** A record's favourite: its id, so the show and edit pages share one */
  itemId?: string
  /** When it was added (ISO) */
  at: string
}

/** A record someone just opened */
export interface RecentItem {
  /** The record's id in the recents entity */
  id: string
  entity: string
  /** The opened record's id */
  itemId: string
  label: string
  to: string
  /** When it was opened (ISO) */
  at: string
}

export const RECENT_MAX = 20

export interface FavoritesOptions {
  /** The entity holding the favourites (default 'favorites'); false: none */
  favorites?: string | false
  /** The entity holding the recents (default 'recents'); false: none */
  recents?: string | false
}

const config: Required<FavoritesOptions> = { favorites: 'favorites', recents: 'recents' }

/** Name the entities, once at boot. Later calls merge over earlier ones. */
export function configureFavorites(options: FavoritesOptions): void {
  Object.assign(config, options)
}

export function getFavoritesConfig(): Readonly<Required<FavoritesOptions>> {
  return config
}

/** What qdadm needs of an entity's manager */
export interface FavoritesManager {
  list(params?: Record<string, unknown>): Promise<{ items: Array<Record<string, unknown>> }>
  create(data: Record<string, unknown>): Promise<unknown>
  delete(id: string | number): Promise<unknown>
  patch?(id: string | number, data: Record<string, unknown>): Promise<unknown>
  update?(id: string | number, data: Record<string, unknown>): Promise<unknown>
  idField?: string
}

export interface LiveList<T> {
  items: T[]
  loaded: boolean
  /** The load or the last change failed */
  error: string | null
}

const lists = new Map<string, LiveList<unknown>>()
const warned = new Set<string>()

/** The live list of an entity, loaded from its manager the first time */
export function liveList<T>(name: string, manager: FavoritesManager, read: (row: Record<string, unknown>, idField: string) => T | null): LiveList<T> {
  const known = lists.get(name)
  if (known) return known as LiveList<T>
  const state = reactive({ items: [] as T[], loaded: false, error: null as string | null }) as LiveList<T>
  lists.set(name, state as LiveList<unknown>)
  void reloadList(name, manager, read)
  return state
}

/** Read the entity again (another tab, a page that edits it) */
export async function reloadList<T>(name: string, manager: FavoritesManager, read: (row: Record<string, unknown>, idField: string) => T | null): Promise<void> {
  const state = lists.get(name) as LiveList<T> | undefined
  if (!state) return
  try {
    const { items } = await manager.list({ page_size: 500 })
    const idField = manager.idField ?? 'id'
    state.items = items.map((row) => read(row, idField)).filter((v): v is T => v !== null)
    state.error = null
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err)
    console.warn(`[qdadm] favourites: "${name}" could not be read:`, err)
  } finally {
    state.loaded = true
  }
}

/** A change failed: say so in the console, keep the error for the cards */
export function changeFailed(name: string, state: LiveList<unknown>, err: unknown): void {
  state.error = err instanceof Error ? err.message : String(err)
  console.warn(`[qdadm] favourites: "${name}" could not be changed:`, err)
}

/** The entity's manager, or null (with one warning) when the app declares none */
export function managerOf(orchestrator: { get?: (name: string) => unknown; has?: (name: string) => boolean } | null, name: string | false): FavoritesManager | null {
  if (!name) return null
  let manager: FavoritesManager | undefined
  // Declared only: a factory would make a manager for any name
  let declared = !!orchestrator?.has?.(name)
  try {
    declared ||= !!getEntityConfig(name)
  } catch {
    // A module registry mocked without it (tests): instantiated managers only
  }
  try {
    manager = declared ? (orchestrator?.get?.(name) as FavoritesManager | undefined) : undefined
  } catch {
    manager = undefined
  }
  if (manager) return manager
  if (!warned.has(name) && orchestrator && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    warned.add(name)
    console.warn(`[qdadm] favourites: no "${name}" entity is declared, so its star and card stay hidden; declare it (ctx.entity), name another with configureFavorites(), or turn it off with configureFavorites({ ${name === config.recents ? 'recents' : 'favorites'}: false })`)
  }
  return null
}

/** For tests: forget the live lists, back to the default names */
export function resetFavoriteLists(): void {
  lists.clear()
  warned.clear()
  config.favorites = 'favorites'
  config.recents = 'recents'
}

const KINDS = ['item', 'list', 'search', 'board']
const iso = (v: unknown): string => {
  const d = v instanceof Date ? v : new Date(typeof v === 'number' || typeof v === 'string' ? v : 0)
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString()
}

export function readFavorite(row: Record<string, unknown>, idField: string): Favorite | null {
  const id = row[idField]
  if ((typeof id !== 'string' && typeof id !== 'number') || typeof row.label !== 'string' || typeof row.to !== 'string') return null
  const kind = KINDS.includes(row.kind as string) ? (row.kind as Favorite['kind']) : 'item'
  const itemId = row.itemId !== undefined && row.itemId !== null && row.itemId !== '' ? { itemId: String(row.itemId) } : {}
  return { id: String(id), kind, label: row.label, to: row.to, ...(typeof row.entity === 'string' && row.entity ? { entity: row.entity } : {}), ...itemId, at: iso(row.at) }
}

export function readRecent(row: Record<string, unknown>, idField: string): RecentItem | null {
  const id = row[idField]
  if ((typeof id !== 'string' && typeof id !== 'number') || typeof row.entity !== 'string' || typeof row.label !== 'string' || typeof row.to !== 'string') return null
  return { id: String(id), entity: row.entity, itemId: String(row.itemId ?? ''), label: row.label, to: row.to, at: iso(row.at) }
}
