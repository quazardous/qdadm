/**
 * useRun (#5343): the run the current page is walking, if its URL carries
 * `?run=<key>`, and the gestures to walk it.
 *
 * ```ts
 * const run = useRun()
 * // A card's or a list's gesture: open the first item, with the bar
 * await run.start({ entity: 'orders', items: ids, label: 'to process', order: 'by urgency' })
 * // The page's main gesture, once it did its work
 * await run.doneAndNext()
 * ```
 *
 * `QdRunBar` shows it on show and form pages; a page needs nothing else.
 */
import { computed, inject, reactive, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../i18n/useI18n'
import { createOrchestratorToast } from '../composables/useOrchestratorToast'
import type { Orchestrator } from '../orchestrator/Orchestrator'
import {
  createRun,
  loadRun,
  nextPending,
  runIndexOf,
  saveRun,
  type Run,
  type RunInit,
  type RunItem,
  type RunRoute,
} from './run'

// One live object per run, shared by every useRun of the tab: the bar sees
// what the page marks done
const live = new Map<string, Run>()
function sharedRun(key: string | null): Run | null {
  if (!key) return null
  const known = live.get(key)
  if (known) return known
  const loaded = loadRun(key)
  if (!loaded) return null
  const shared = reactive(loaded) as Run
  live.set(key, shared)
  return shared
}

export interface UseRunReturn {
  /** The run this page walks, or null */
  run: Ref<Run | null>
  /** Whether this page walks a run and its item is in it */
  active: ComputedRef<boolean>
  /** The item on screen, and where it is */
  current: ComputedRef<RunItem | null>
  index: ComputedRef<number>
  /** 1-based, for "3 of 14" */
  position: ComputedRef<number>
  total: ComputedRef<number>
  doneCount: ComputedRef<number>
  remaining: ComputedRef<number>
  /** The neighbours, done or not, or null at an end */
  prev: ComputedRef<RunItem | null>
  next: ComputedRef<RunItem | null>
  goPrev: () => Promise<void>
  goNext: () => Promise<void>
  goTo: (index: number) => Promise<void>
  /** Mark the item on screen done (or the one given) */
  markDone: (id?: string | number) => void
  /** Mark it done and open the next one still to do; at the end, say so and go back */
  doneAndNext: () => Promise<void>
  /** Leave the run: back where it started */
  end: () => Promise<void>
  /** Start a run and open its first item */
  start: (init: RunInit) => Promise<void>
  /** Start a run and give the route of its first item, without going there */
  startRun: (init: RunInit) => RouteLocationRaw | null
  /** The route of one of the run's items, with the run kept */
  routeOf: (index: number) => RouteLocationRaw | null
}

export function useRun(): UseRunReturn {
  // Without a router (a page mounted on its own, in a test) there is no run
  const route = useRoute() as ReturnType<typeof useRoute> | undefined
  const router = useRouter() as ReturnType<typeof useRouter> | undefined
  const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator', null)
  const toast = createOrchestratorToast(orchestrator)
  const { t } = useI18n()

  const run = ref<Run | null>(null)
  watch(
    () => route?.query?.run,
    (key) => {
      run.value = sharedRun(typeof key === 'string' ? key : null)
    },
    { immediate: true }
  )

  const index = computed(() => {
    if (!route || !run.value || route.name !== run.value.route.name) return -1
    return runIndexOf(run.value, route.params?.[run.value.route.param] as string | undefined)
  })
  const active = computed(() => index.value >= 0)
  const current = computed(() => (active.value ? run.value!.items[index.value]! : null))
  const total = computed(() => run.value?.items.length ?? 0)
  const position = computed(() => index.value + 1)
  const doneCount = computed(() => run.value?.items.filter((i) => i.done).length ?? 0)
  const remaining = computed(() => total.value - doneCount.value)
  const prev = computed(() => (active.value && index.value > 0 ? run.value!.items[index.value - 1]! : null))
  const next = computed(() => (active.value && index.value < total.value - 1 ? run.value!.items[index.value + 1]! : null))

  function routeOf(i: number): RouteLocationRaw | null {
    const r = run.value
    const item = r?.items[i]
    if (!r || !item) return null
    const params = route?.name === r.route.name ? { ...(route.params as Record<string, string>) } : { ...(r.route.params ?? {}) }
    return { name: r.route.name, params: { ...params, [r.route.param]: item.id }, query: { run: r.key } }
  }

  async function goTo(i: number): Promise<void> {
    const target = routeOf(i)
    if (target) await router?.push(target)
  }
  const goPrev = () => (prev.value ? goTo(index.value - 1) : Promise.resolve())
  const goNext = () => (next.value ? goTo(index.value + 1) : Promise.resolve())

  function markDone(id?: string | number): void {
    const r = run.value
    if (!r) return
    const i = id === undefined ? index.value : runIndexOf(r, id)
    const item = r.items[i]
    if (!item || item.done) return
    item.done = true
    saveRun(r)
  }

  async function end(): Promise<void> {
    const r = run.value
    if (!r) return
    run.value = null
    if (r.returnTo) await router?.push(r.returnTo)
  }

  async function doneAndNext(): Promise<void> {
    const r = run.value
    if (!r) return
    markDone()
    const n = nextPending(r, index.value)
    if (n !== null) return goTo(n)
    toast.add({ severity: 'success', summary: t('core.run.finished', { count: r.items.length }) })
    await end()
  }

  /** The page the entity's items open on: its edit page, else its show page */
  function itemRoute(entity: string): RunRoute | null {
    const manager = orchestrator?.get?.(entity)
    const prefix = manager?.routePrefix
    if (!prefix) return null
    const name = [`${prefix}-edit`, `${prefix}-show`].find((n) => router?.hasRoute(n))
    return name ? { name, param: manager.idField ?? 'id' } : null
  }

  function startRun(init: RunInit): RouteLocationRaw | null {
    const target = init.route ?? itemRoute(init.entity)
    if (!target) {
      console.warn(`[qdadm] useRun: no page to open "${init.entity}" items on; pass route: { name, param }`)
      return null
    }
    // Back where the run was started: this page, without its own run
    const { run: _ownRun, ...query } = route?.query ?? {}
    const here: RouteLocationRaw | undefined = route ? { path: route.path, query } : undefined
    const created = createRun(init, target, here)
    if (!created.items.length) return null
    saveRun(created)
    const shared = reactive(created) as Run
    live.set(created.key, shared)
    run.value = shared
    const first = init.start !== undefined ? runIndexOf(created, init.start) : -1
    const i = first >= 0 ? first : 0
    const item = created.items[i]!
    return { name: target.name, params: { ...(target.params ?? {}), [target.param]: item.id }, query: { run: created.key } }
  }

  async function start(init: RunInit): Promise<void> {
    const target = startRun(init)
    if (target) await router?.push(target)
  }

  return {
    run,
    active,
    current,
    index,
    position,
    total,
    doneCount,
    remaining,
    prev,
    next,
    goPrev,
    goNext,
    goTo,
    markDone,
    doneAndNext,
    end,
    start,
    startRun,
    routeOf,
  }
}
