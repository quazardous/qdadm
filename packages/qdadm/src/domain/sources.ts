/**
 * A domain's sources (#5461): named reads its indicators share.
 *
 * Several indicators often show parts of the same answer (the counts behind
 * "to process" and "overdue"). A source is read once per refresh, whatever
 * the number of indicators that name it, and its state (loading, error, the
 * last good answer) is theirs.
 *
 * NOT AN ENTITY. An entity is records: ids, CRUD, permissions, pages, a list
 * cache keyed by query. A count or a curve is derived from an entity's
 * records and has none of that; declared as an entity, it would be refreshed
 * by its own changes, which never happen, rather than by those of the
 * records it counts. So a source names the entities it is read from
 * (`entities`), and a change to one of them (a local write, the live stream,
 * an app's `invalidate()`) reads it again, coalesced.
 *
 * The store is module-wide, keyed by domain and source: an answer still
 * fresh (younger than `refresh`) is reused when the bar comes back, and the
 * timer runs while one indicator at least reads it.
 */
import { shallowRef, ref, type Ref, type ShallowRef } from 'vue'
import { readErrorMessage } from '../composables/useAsyncRead'

/** One source a domain declares */
export interface DomainDataSource {
  /** The read: called once for every indicator naming it, then every `refresh` seconds */
  load: () => unknown | Promise<unknown>
  /** Seconds between two reads (default: none; read again each time the bar mounts) */
  refresh?: number
  /** The entities it is read from: a change to one reads it again (#5461) */
  entities?: string[]
}

/** What an indicator reads of a source */
export interface SourceRead {
  data: ShallowRef<unknown>
  error: Ref<string | null>
  loading: Ref<boolean>
  ready: Ref<boolean>
  load: () => Promise<void>
}

/** The bit of the signal bus a source needs */
export interface SourceSignals {
  on: (signal: string, handler: (event: { name: string; data: unknown }) => void) => () => void
}

interface Entry extends SourceRead {
  def: DomainDataSource
  readAt: number
  readers: number
  inflight: Promise<void> | null
  again: boolean
  seq: number
  timer: ReturnType<typeof setInterval> | null
  pending: ReturnType<typeof setTimeout> | null
  off: (() => void) | null
}

const entries = new Map<string, Entry>()

/** How long a change waits for the next before the source is read again */
export const SOURCE_COALESCE_MS = 300

function entryFor(key: string, def: DomainDataSource): Entry {
  let e = entries.get(key)
  if (e && e.def !== def) {
    // Declared again (a hot reload, a test): the new declaration, a fresh read
    stop(e)
    entries.delete(key)
    e = undefined
  }
  if (e) return e
  const created: Entry = {
    def,
    data: shallowRef<unknown>(undefined),
    error: ref<string | null>(null),
    loading: ref(false),
    ready: ref(false),
    readAt: 0,
    readers: 0,
    inflight: null,
    again: false,
    seq: 0,
    timer: null,
    pending: null,
    off: null,
    load: () => read(created),
  }
  entries.set(key, created)
  return created
}

/** One read at a time: a call while one is in flight waits for it, and one asked meanwhile follows it */
function read(e: Entry, force = false): Promise<void> {
  if (e.inflight) {
    if (force) e.again = true
    return e.inflight
  }
  const n = ++e.seq
  e.loading.value = true
  e.inflight = (async () => {
    try {
      const data = await e.def.load()
      if (n !== e.seq) return
      e.data.value = data
      e.ready.value = true
      e.error.value = null
      e.readAt = Date.now()
    } catch (err) {
      if (n === e.seq) e.error.value = readErrorMessage(err)
    } finally {
      if (n === e.seq) e.loading.value = false
      e.inflight = null
      if (e.again && e.readers > 0) {
        e.again = false
        void read(e)
      }
    }
  })()
  return e.inflight
}

function stop(e: Entry): void {
  if (e.timer) clearInterval(e.timer)
  if (e.pending) clearTimeout(e.pending)
  e.off?.()
  e.timer = null
  e.pending = null
  e.off = null
}

/**
 * An indicator starts reading a source: the first one reads it (unless its
 * answer is still fresh), starts its timer and listens to its entities.
 * Returns the read and the release.
 */
export function acquireSource(key: string, def: DomainDataSource, signals: SourceSignals | null): { read: SourceRead; release: () => void } {
  const e = entryFor(key, def)
  e.readers++
  if (e.readers === 1) {
    const fresh = e.ready.value && !e.error.value && !!def.refresh && Date.now() - e.readAt < def.refresh * 1000
    if (!fresh) void read(e)
    if (def.refresh && def.refresh > 0) e.timer = setInterval(() => void read(e), def.refresh * 1000)
    const names = def.entities ?? []
    if (signals && names.length) {
      e.off = signals.on('entity:data-invalidate', (event) => {
        const entity = (event?.data as { entity?: string } | undefined)?.entity
        if (!entity || !names.includes(entity)) return
        // A burst of changes: one read, once it settles
        if (e.pending) clearTimeout(e.pending)
        e.pending = setTimeout(() => {
          e.pending = null
          void read(e, true)
        }, SOURCE_COALESCE_MS)
      })
    }
  }
  let released = false
  return {
    read: e,
    release: () => {
      if (released) return
      released = true
      e.readers--
      if (e.readers <= 0) {
        e.readers = 0
        stop(e)
      }
    },
  }
}

/** Tests only */
export function resetSources(): void {
  for (const e of entries.values()) stop(e)
  entries.clear()
}
