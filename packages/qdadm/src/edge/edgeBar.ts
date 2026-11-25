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
import { computed, ref, toValue, type Component, type ComputedRef, type MaybeRefOrGetter } from 'vue'
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
const readLast = (): string | null => {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null
  } catch {
    return null
  }
}
const isOpen = ref(false)
const tab = ref<string | null>(readLast())
const panels = ref<EdgePanelDef[]>([])

function remember(key: string | null): void {
  try {
    if (key) sessionStorage.setItem(SESSION_KEY, key)
  } catch {
    // a private window: not remembered, nothing else changes
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
  if (tab.value && keys.includes(tab.value)) return
  if (isOpen.value && keys.length) tab.value = keys[0]!
  else {
    if (!keys.length) isOpen.value = false
    tab.value = isOpen.value ? (keys[0] ?? null) : tab.value
  }
}

/** Back to nothing open and no panel (tests) */
export function resetEdgeBar(): void {
  isOpen.value = false
  tab.value = null
  panels.value = []
}

export interface UseEdgeBarReturn {
  /** The panels given for the page on screen */
  panels: typeof panels
  /** There is a bar: at least one panel */
  present: ComputedRef<boolean>
  isOpen: typeof isOpen
  /** The tab open, or the last one used */
  tab: typeof tab
  /** Open a panel (its key), or the last one used; false when it is not given here */
  open: (key?: string) => boolean
  close: () => void
  /** A tab's gesture: open it, or close it when it is the one open */
  toggle: (key: string) => void
}

export function useEdgeBar(): UseEdgeBarReturn {
  const present = computed(() => panels.value.length > 0)
  function open(key?: string): boolean {
    const keys = panels.value.map((p) => p.key)
    const target = key ?? (tab.value && keys.includes(tab.value) ? tab.value : keys[0])
    if (!target || !keys.includes(target)) return false
    tab.value = target
    isOpen.value = true
    remember(target)
    return true
  }
  function close(): void {
    isOpen.value = false
  }
  function toggle(key: string): void {
    if (isOpen.value && tab.value === key) close()
    else open(key)
  }
  return { panels, present, isOpen, tab, open, close, toggle }
}
