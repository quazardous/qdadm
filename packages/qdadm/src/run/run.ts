/**
 * Runs (#5343): an ordered set of items of one entity, walked one item after
 * the other from its show or form page, with where it came from.
 *
 * A run lives in the tab's sessionStorage under a short key, which the URL
 * carries as `?run=<key>`: a reload keeps it, another tab does not see it.
 * Nothing here knows Vue or the router: `useRun` does the navigation.
 */
import type { RouteLocationRaw } from 'vue-router'

/** One item of a run */
export interface RunItem {
  /** The item's id, as its route takes it */
  id: string
  /** Shown warm in the strip until it is done */
  urgent?: boolean
  /** What the strip's segment says about it ("575806 · Amazon FR") */
  label?: string
  /** Done since the run started: it leaves what remains */
  done?: boolean
  /**
   * Its segment's colour while it is to do, and once done (#5455): a tone,
   * `critical` (`danger`), `watch` (`warn`), `good` (`success`), `info`,
   * `neutral` (`secondary`), or the name of the app's own `--qd-tone-<name>`.
   * Without them: warm when urgent, filled once done, grey otherwise.
   */
  tone?: string
  doneTone?: string
}

const TONE_ALIASES: Record<string, string> = { danger: 'critical', warn: 'watch', warning: 'watch', success: 'good', secondary: 'neutral' }

/** A tone's colour, on the cards' tokens (light and dark): `var(--qd-tone-…)` */
export function runToneColor(tone: string | null | undefined): string | null {
  if (!tone || typeof tone !== 'string') return null
  const name = TONE_ALIASES[tone] ?? tone
  if (!/^[a-z][a-z0-9-]*$/i.test(name)) return null
  return `var(--qd-tone-${name})`
}

/** The page every item of a run opens on */
export interface RunRoute {
  /** The route's name, e.g. `book-edit` */
  name: string
  /** The route param holding the item's id, e.g. `id` */
  param: string
  /** The route's other params (a parent's id) */
  params?: Record<string, string>
}

/**
 * The run bar's keys (#5454): a `KeyboardEvent.key` each (`'j'`, `'ArrowLeft'`,
 * `'['`; letters match either case), `null` or `false` for none. App-wide in
 * `features.run.keys`, per run in `RunInit.keys`; by default J previous, K
 * next (left and right on the keyboard, as the bar reads), L back.
 */
export interface RunKeys {
  prev?: string | null | false
  next?: string | null | false
  back?: string | null | false
}

/** What a run is started with */
export interface RunInit {
  /** The entity the items belong to */
  entity: string
  /** The items, in the order they are walked: ids, or items with their marks */
  items: Array<string | number | (Omit<RunItem, 'id'> & { id: string | number })>
  /** What the items are, after "3 of 14": "to process" */
  label?: string
  /** How they were chosen, in words: "status: to process" */
  filter?: string
  /** How they were ordered, in words: "by urgency" */
  order?: string
  /** Where to go back at the end; by default where the run was started */
  returnTo?: RouteLocationRaw
  /** The page the items open on; by default the entity's edit page, or its show page */
  route?: RunRoute
  /** The item to start with; by default the first one */
  start?: string | number
  /** This run's keys, over the app's (`features.run.keys`) */
  keys?: RunKeys
}

/** A run as it is kept */
export interface Run {
  key: string
  entity: string
  route: RunRoute
  items: RunItem[]
  label?: string
  filter?: string
  order?: string
  returnTo?: RouteLocationRaw
  keys?: RunKeys
  startedAt: number
}

const PREFIX = 'qdadm.run.'
/** Runs kept per tab: the oldest go first */
const MAX_RUNS = 20

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/** A short key for the URL */
export function newRunKey(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** A run from what it is started with */
export function createRun(init: RunInit, route: RunRoute, returnTo?: RouteLocationRaw): Run {
  return {
    key: newRunKey(),
    entity: init.entity,
    route,
    items: init.items.map((item) =>
      typeof item === 'object' ? { ...item, id: String(item.id) } : { id: String(item) }
    ),
    ...(init.label ? { label: init.label } : {}),
    ...(init.filter ? { filter: init.filter } : {}),
    ...(init.order ? { order: init.order } : {}),
    ...(init.returnTo ?? returnTo ? { returnTo: init.returnTo ?? returnTo } : {}),
    ...(init.keys ? { keys: { ...init.keys } } : {}),
    startedAt: Date.now(),
  }
}

export function saveRun(run: Run): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(PREFIX + run.key, JSON.stringify(run))
    // Keep the tab's storage small: drop the oldest runs
    const keys: Array<{ key: string; at: number }> = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (!key?.startsWith(PREFIX)) continue
      try {
        keys.push({ key, at: (JSON.parse(store.getItem(key) ?? '{}') as Run).startedAt ?? 0 })
      } catch {
        keys.push({ key, at: 0 })
      }
    }
    keys.sort((a, b) => b.at - a.at).slice(MAX_RUNS).forEach(({ key }) => store.removeItem(key))
  } catch {
    // A full or blocked storage: the run lasts as long as the page
  }
}

export function loadRun(key: string | null | undefined): Run | null {
  if (!key) return null
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(PREFIX + key)
    if (!raw) return null
    const run = JSON.parse(raw) as Run
    return Array.isArray(run?.items) && run.route?.name ? run : null
  } catch {
    return null
  }
}

export function forgetRun(key: string): void {
  try {
    storage()?.removeItem(PREFIX + key)
  } catch {
    // nothing kept, nothing to forget
  }
}

/** Where an item is in the run, or -1 */
export function runIndexOf(run: Run, id: string | number | null | undefined): number {
  if (id === null || id === undefined) return -1
  return run.items.findIndex((item) => item.id === String(id))
}

/**
 * The next item still to do after `from`, going round to the start: null when
 * all are done. `from` -1 looks from the start.
 */
export function nextPending(run: Run, from: number): number | null {
  const n = run.items.length
  for (let step = 1; step <= n; step++) {
    const i = (from + step + n) % n
    if (i === from) continue
    if (!run.items[i]!.done) return i
  }
  return from >= 0 && from < n && !run.items[from]!.done ? from : null
}
