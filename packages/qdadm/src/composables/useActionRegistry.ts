/**
 * Generic action registry (#1193) — the map + ordered add/remove/resolve
 * skeleton was rebuilt in useListPage, useEntityItemFormPage and
 * useEntityItemShowPage; only the resolution context differs, so the
 * consumer supplies `resolve(action, ctx)` and calls `resolveAll(ctx)`.
 */
import { ref, type Ref } from 'vue'

export interface UseActionRegistryOptions<A extends { name: string }, Ctx, R> {
  /** Defaults merged under every added action (e.g. { severity: 'secondary' }). */
  defaults?: Partial<A>
  /**
   * Resolve one action against the consumer's context. Return null to
   * filter it out (visibility check lives here).
   */
  resolve: (action: A, ctx: Ctx) => R | null
}

export interface UseActionRegistryReturn<A extends { name: string }, Ctx, R> {
  /** Raw registered actions, insertion-ordered (exposed for advanced consumers). */
  actionsMap: Ref<Map<string, A>>
  /** Registration order — kept explicit so external entries (e.g. lazy actions) can share it. */
  order: Ref<string[]>
  add(action: A): void
  remove(name: string): void
  has(name: string): boolean
  /** Drop every registered action (order included). */
  clear(): void
  /** Resolve every registered action in order, dropping nulls. */
  resolveAll(ctx: Ctx): R[]
  /** Resolve a single registered action by name (null if absent or filtered). */
  resolveOne(name: string, ctx: Ctx): R | null
}

export function useActionRegistry<A extends { name: string }, Ctx = void, R = A>(
  options: UseActionRegistryOptions<A, Ctx, R>
): UseActionRegistryReturn<A, Ctx, R> {
  const { defaults, resolve } = options
  const actionsMap = ref(new Map()) as Ref<Map<string, A>>
  const order = ref<string[]>([])

  function add(action: A): void {
    actionsMap.value.set(action.name, { ...defaults, ...action })
    if (!order.value.includes(action.name)) {
      order.value.push(action.name)
    }
  }

  function remove(name: string): void {
    actionsMap.value.delete(name)
    const idx = order.value.indexOf(name)
    if (idx !== -1) order.value.splice(idx, 1)
  }

  function has(name: string): boolean {
    return actionsMap.value.has(name)
  }

  function clear(): void {
    actionsMap.value.clear()
    order.value = []
  }

  function resolveAll(ctx: Ctx): R[] {
    const resolved: R[] = []
    for (const name of order.value) {
      const action = actionsMap.value.get(name)
      if (!action) continue
      const r = resolve(action, ctx)
      if (r !== null) resolved.push(r)
    }
    return resolved
  }

  function resolveOne(name: string, ctx: Ctx): R | null {
    const action = actionsMap.value.get(name)
    if (!action) return null
    return resolve(action, ctx)
  }

  return { actionsMap, order, add, remove, has, clear, resolveAll, resolveOne }
}
