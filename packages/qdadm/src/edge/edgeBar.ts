/**
 * The edge bar (#5506): a thin bar on an edge of the layout, its tabs hooked
 * onto it, and a panel laid over the content, full height. What it shows is
 * the app's: `features.edgeBar.panels(context)` is called with the page's
 * context (the context stack, the route, the user) whenever it changes, and
 * gives the panels. Some are global (always given), others contextual (given
 * on a task's page, with the task).
 *
 * The state (open, which tab) is shared: the layout draws it, and a page can
 * open a panel with `useEdgeBar().open(key)`.
 */
import { computed, ref, shallowRef, toValue, type Component, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import type { StackLevel, DomainStackLevel } from '../chain/ActiveStack'

/** What the app's handler is given */
export interface EdgeContext {
  /** The page's domain, or null */
  domain: DomainStackLevel | null
  /** The entity levels with their ids, root first */
  levels: StackLevel[]
  /** The deepest entity level, or null */
  current: StackLevel | null
  /** The level of that entity, or null: `context.entity('tasks')?.id` */
  entity: (name: string) => StackLevel | null
  route: { name: string | null; path: string; params: Record<string, unknown>; query: Record<string, unknown> }
  user: unknown
}

/** A panel, as the app's handler gives it */
export interface EdgePanelDef {
  key: string
  /** Its tab's name (an i18n key works) */
  label: string
  icon?: string
  /** Its tab's colour: a tone (`critical`, `watch`, `good`, `info`, `neutral`, the app's own) or a CSS colour */
  tone?: string
  /** What waits there: a number, a ref or a getter, kept live while the panel is closed; 0 or none hides it */
  badge?: MaybeRefOrGetter<number | null | undefined>
  /** What it draws, with `props` */
  component?: Component
  props?: Record<string, unknown>
}

export interface EdgeBarConfig {
  /** The panels for a context: global ones always, contextual ones in theirs */
  panels: (context: EdgeContext) => EdgePanelDef[] | null | undefined
  /** The edge it is on (default right) */
  side?: 'right' | 'left'
  /** Where its tabs sit along the bar (#5509): top (default) or bottom */
  tabsAt?: 'top' | 'bottom'
  /** A pin on the panel (#5511): pinned, beside the page and closed only on purpose (default true) */
  pinnable?: boolean
  /** A handle on the panel's inner edge to resize it (#5519), within minWidth and maxWidth (default true) */
  resizable?: boolean
  /** The narrowest it may be dragged to (default 18rem) */
  minWidth?: string
  /** The widest (default 60vw; never past 92vw) */
  maxWidth?: string
  /** The panel's width (default 26rem, at most 92vw) */
  width?: string
  /** Under this window width, the panel opens the screen's full width (default 900) */
  narrowAt?: number
}

/** A badge's value now: a number above 0, or null */
export function badgeCount(badge: EdgePanelDef['badge']): number | null {
  if (badge === undefined || badge === null) return null
  const n = Number(toValue(badge))
  return Number.isFinite(n) && n > 0 ? n : null
}

// ── The shared state ─────────────────────────────────────────────────────────
const SESSION_KEY = 'qdadm_edge_tab'
/** Pinned (#5511): kept by the browser, with whether it was open */
const PIN_KEY = 'qdadm_edge_pinned'
const readLast = (): string | null => {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null
  } catch {
    return null
  }
}
const readPin = (): { pinned: boolean; open: boolean; tab: string | null } => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PIN_KEY) : null
    const v = raw ? (JSON.parse(raw) as { pinned?: unknown; open?: unknown; tab?: unknown }) : null
    return { pinned: v?.pinned === true, open: v?.open === true, tab: typeof v?.tab === 'string' ? v.tab : null }
  } catch {
    return { pinned: false, open: false, tab: null }
  }
}
/** Open or not, for the session, pinned or not (#5518) */
const OPEN_KEY = 'qdadm_edge_open'
const readOpen = (): boolean => {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}
const saved = readPin()
const pinned = ref(saved.pinned)
// Open when the page was left (this session, or pinned): open again, on its tab
const isOpen = ref((saved.pinned && saved.open) || readOpen())
const tab = ref<string | null>(saved.pinned && saved.open && saved.tab ? saved.tab : readLast())
// Shallow: a panel's component is not made reactive
const panels = shallowRef<EdgePanelDef[]>([])
/** The screen is too narrow to share: no pin, the panel over the page */
const narrow = ref(false)
/** The width the person dragged it to, in px (#5519), kept by the browser; null: the configured width */
const WIDTH_KEY = 'qdadm_edge_width'
const readWidth = (): number | null => {
  try {
    const n = Number(typeof localStorage !== 'undefined' ? localStorage.getItem(WIDTH_KEY) : NaN)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}
const width = ref<number | null>(readWidth())

function remember(key: string | null): void {
  try {
    if (key) sessionStorage.setItem(SESSION_KEY, key)
  } catch {
    // a private window: not remembered, nothing else changes
  }
}
function rememberPin(): void {
  try {
    sessionStorage.setItem(OPEN_KEY, isOpen.value ? '1' : '0')
  } catch {
    // not kept for the session
  }
  try {
    if (pinned.value) localStorage.setItem(PIN_KEY, JSON.stringify({ pinned: true, open: isOpen.value, tab: tab.value }))
    else localStorage.removeItem(PIN_KEY)
  } catch {
    // not remembered: it is pinned for this page only
  }
}

/**
 * The panels given for this context (the layout calls it): the tab open
 * stays when it is still given; when it is gone, an open panel falls back to
 * the first panel left, or closes when none is
 */
export function setEdgePanels(next: EdgePanelDef[]): void {
  panels.value = next
  const keys = next.map((p) => p.key)
  // No panel here (#5518): the bar goes, the panel stays open in the state,
  // to open again, on its tab, on the next page that gives panels
  if (!keys.length) return
  if (tab.value && keys.includes(tab.value)) return
  if (isOpen.value) tab.value = keys[0]!
}

/** The screen's width, as the panel reads it (#5511): narrow, no pin */
export function setEdgeNarrow(value: boolean): void {
  narrow.value = value
}

/** Back to nothing open, nothing pinned and no panel (tests) */
export function resetEdgeBar(): void {
  isOpen.value = false
  tab.value = null
  panels.value = []
  pinned.value = false
  narrow.value = false
  width.value = null
  try {
    localStorage.removeItem(PIN_KEY)
    localStorage.removeItem(WIDTH_KEY)
    sessionStorage.removeItem(OPEN_KEY)
  } catch {
    // nothing kept
  }
}

export interface UseEdgeBarReturn {
  /** The panels given for the page on screen */
  panels: typeof panels
  /** There is a bar: at least one panel */
  present: ComputedRef<boolean>
  isOpen: typeof isOpen
  /** The tab open, or the last one used */
  tab: typeof tab
  /** Pinned (#5511): when open, beside the page rather than over it, and closed only on purpose */
  pinned: typeof pinned
  /** Open, pinned and room to share: the page makes room for it */
  docked: ComputedRef<boolean>
  /** The width dragged to, in px (#5519); null: the configured one */
  width: typeof width
  /** Set the width (px), or null for the configured one; `keep` saves it in the browser */
  resize: (px: number | null, keep?: boolean) => void
  /** Open a panel (its key), or the last one used; false when it is not given here */
  open: (key?: string) => boolean
  close: () => void
  /** A tab's gesture: open it, or close it when it is the one open */
  toggle: (key: string) => void
  /** Pin it, or unpin it */
  pin: (on: boolean) => void
}

export function useEdgeBar(): UseEdgeBarReturn {
  const present = computed(() => panels.value.length > 0)
  const docked = computed(() => present.value && isOpen.value && pinned.value && !narrow.value)
  function open(key?: string): boolean {
    const keys = panels.value.map((p) => p.key)
    const target = key ?? (tab.value && keys.includes(tab.value) ? tab.value : keys[0])
    if (!target || !keys.includes(target)) return false
    tab.value = target
    isOpen.value = true
    remember(target)
    rememberPin()
    return true
  }
  function close(): void {
    isOpen.value = false
    rememberPin()
  }
  function toggle(key: string): void {
    if (isOpen.value && tab.value === key) close()
    else open(key)
  }
  function pin(on: boolean): void {
    pinned.value = on
    rememberPin()
  }
  function resize(px: number | null, keep = true): void {
    width.value = px === null ? null : Math.round(px)
    if (!keep) return
    try {
      if (width.value === null) localStorage.removeItem(WIDTH_KEY)
      else localStorage.setItem(WIDTH_KEY, String(width.value))
    } catch {
      // not kept: this width holds for the page only
    }
  }
  return { panels, present, isOpen, tab, pinned, docked, width, resize, open, close, toggle, pin }
}
