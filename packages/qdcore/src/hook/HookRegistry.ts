/**
 * HookRegistry - Drupal-inspired hook system.
 *
 * Provides a hook-based extension API built on QuarKernel's signal bus.
 * Two hook types:
 * - Lifecycle hooks: fire-and-forget, no return value expected (via invoke())
 * - Alter hooks: chained transforms, each handler receives previous output (via alter())
 *
 * Hook naming convention: colon-delimited (e.g., 'entity:presave', 'list:alter')
 *
 * Handler signature: (event, listenerContext) => void | Promise<void>
 * - event.data contains the context/data passed to invoke()/alter()
 * - event.name is the hook name
 * - listenerContext provides utilities (id, cancel, emit, etc.)
 *
 * Framework-agnostic; no qdadm or qdcms specifics.
 *
 * @example
 * // Register lifecycle hook (fire-and-forget)
 * hooks.register('entity:presave', async (event) => {
 *   event.data.entity.updated_at = Date.now()
 * }, { priority: 10 })
 *
 * // Register alter hook (transform chain)
 * hooks.register('list:alter', (config) => {
 *   config.columns.push({ field: 'custom' })
 *   return config
 * })
 *
 * // Invoke
 * await hooks.invoke('entity:presave', { entity, manager })
 * const altered = await hooks.alter('list:alter', baseConfig)
 */

import { createKernel, type ListenerOptions } from '@quazardous/quarkernel'

// Local minimal kernel surface — see SignalBus.ts for the rationale (vue-tsc
// flakes on quarkernel 2.3's bundled `.d.ts` re-export chain through
// workspace symlinks).
interface QuarKernel {
  on: (eventName: string, listener: (event: { name: string; data: unknown }) => unknown, options?: ListenerOptions) => () => void
  emitSerial: (eventName: string, data?: unknown) => Promise<unknown>
  clearExecutionErrors: () => void
  getExecutionErrors: () => Array<{ listenerId: string; error: Error }>
  debug: (enabled: boolean) => void
}

const DEFAULT_PRIORITY = 50

export const HOOK_PRIORITY = {
  FIRST: 100,
  HIGH: 75,
  NORMAL: 50,
  LOW: 25,
  LAST: 0,
} as const

export type HookHandler<T = unknown> = (data: T) => T | void | Promise<T | void>

export interface HookRegistrationOptions {
  priority?: number
  id?: string
  after?: string | string[]
  once?: boolean
}

interface HookEntry {
  handler: HookHandler
  priority: number
  id?: string
  after?: string | string[]
  once: boolean
  unbind: () => void
}

interface HookEntryWithDeps extends HookEntry {
  afterArray: string[]
}

export interface HookRegistryOptions {
  /**
   * Pre-built quarkernel instance to share with another bus (e.g. SignalBus).
   * Accepts any quarkernel-shaped object; cast internally.
   */
  kernel?: unknown
  debug?: boolean
}

export interface InvokeOptions {
  throwOnError?: boolean
}

export interface AlterOptions {
  immutable?: boolean
}

export class HookRegistry {
  private _kernel: QuarKernel
  private _hooks: Map<string, HookEntry[]>

  constructor(options: HookRegistryOptions = {}) {
    this._kernel = (options.kernel ??
      createKernel({
        delimiter: ':',
        wildcard: true,
        errorBoundary: true,
        debug: options.debug ?? false,
      })) as unknown as QuarKernel
    this._hooks = new Map()
  }

  register(name: string, handler: HookHandler, options: HookRegistrationOptions = {}): () => void {
    const { priority = DEFAULT_PRIORITY, id, after, once = false } = options

    const kernelOptions: ListenerOptions = { priority, once }
    if (id) kernelOptions.id = id
    if (after) kernelOptions.after = after

    const unbind = this._kernel.on(name, handler as never, kernelOptions)

    if (!this._hooks.has(name)) {
      this._hooks.set(name, [])
    }

    const hookEntry: HookEntry = { handler, priority, id, after, once, unbind }
    this._hooks.get(name)!.push(hookEntry)

    return () => {
      unbind()
      const hooks = this._hooks.get(name)
      if (hooks) {
        const idx = hooks.indexOf(hookEntry)
        if (idx !== -1) hooks.splice(idx, 1)
        if (hooks.length === 0) this._hooks.delete(name)
      }
    }
  }

  async invoke(name: string, context: unknown = {}, options: InvokeOptions = {}): Promise<void> {
    const { throwOnError = false } = options

    this._kernel.clearExecutionErrors()
    await this._kernel.emitSerial(name, context)

    if (throwOnError) {
      const errors = this._kernel.getExecutionErrors()
      if (errors.length > 0) {
        const errorMessages = errors.map(
          (e: { listenerId: string; error: Error }) => `[${e.listenerId}] ${e.error.message}`
        )
        throw new AggregateError(
          errors.map((e: { error: Error }) => e.error),
          `Hook "${name}" handlers failed:\n  ${errorMessages.join('\n  ')}`
        )
      }
    }
  }

  async alter<T>(name: string, data: T, options: AlterOptions = {}): Promise<T> {
    const { immutable = false } = options

    if (!this.hasHook(name)) return data

    const handlers = this._hooks.get(name) || []
    const sortedHandlers = this._sortByDependencies(handlers)

    let result: T = data
    for (const entry of sortedHandlers) {
      const input = immutable ? this._cloneData(result) : result
      const handlerResult = await entry.handler(input)
      if (handlerResult !== undefined) {
        result = handlerResult as T
      }
    }

    return result
  }

  private _cloneData<T>(val: T): T {
    if (val === null || val === undefined) return val
    if (typeof val !== 'object') return val
    return structuredClone(val)
  }

  private _sortByDependencies(handlers: HookEntry[]): HookEntryWithDeps[] {
    const hasDependencies = handlers.some(
      (h) => h.after && (typeof h.after === 'string' || (Array.isArray(h.after) && h.after.length > 0))
    )

    const entriesWithDeps: HookEntryWithDeps[] = handlers.map((h) => ({
      ...h,
      afterArray: h.after ? (Array.isArray(h.after) ? h.after : [h.after]) : [],
    }))

    if (!hasDependencies) {
      return entriesWithDeps.sort((a, b) => b.priority - a.priority)
    }

    const handlerIds = new Set(entriesWithDeps.filter((e) => e.id).map((e) => e.id))

    for (const entry of entriesWithDeps) {
      entry.afterArray = entry.afterArray.filter((dep) => handlerIds.has(dep))
    }

    const levelMap = new Map<HookEntryWithDeps, number>()
    const assignLevel = (entry: HookEntryWithDeps, visited: Set<HookEntryWithDeps> = new Set()): number => {
      if (levelMap.has(entry)) return levelMap.get(entry)!
      if (visited.has(entry)) return 0
      visited.add(entry)

      if (entry.afterArray.length === 0) {
        levelMap.set(entry, 0)
        return 0
      }

      let maxDepLevel = 0
      for (const depId of entry.afterArray) {
        const depEntry = entriesWithDeps.find((e) => e.id === depId)
        if (depEntry) {
          const depLevel = assignLevel(depEntry, new Set(visited))
          maxDepLevel = Math.max(maxDepLevel, depLevel)
        }
      }

      const level = maxDepLevel + 1
      levelMap.set(entry, level)
      return level
    }

    entriesWithDeps.forEach((e) => assignLevel(e))

    return [...entriesWithDeps].sort((a, b) => {
      const levelA = levelMap.get(a) ?? 0
      const levelB = levelMap.get(b) ?? 0
      if (levelA !== levelB) return levelA - levelB
      return b.priority - a.priority
    })
  }

  getRegisteredHooks(): string[] {
    return Array.from(this._hooks.keys())
  }

  getHandlerCount(name?: string): number {
    if (name) return this._hooks.get(name)?.length ?? 0
    let total = 0
    for (const handlers of this._hooks.values()) total += handlers.length
    return total
  }

  hasHook(name: string): boolean {
    return this._hooks.has(name) && this._hooks.get(name)!.length > 0
  }

  dispose(): void {
    for (const handlers of this._hooks.values()) {
      for (const entry of handlers) entry.unbind()
    }
    this._hooks.clear()
  }

  debug(enabled: boolean): void {
    this._kernel.debug(enabled)
  }
}

export function createHookRegistry(options: HookRegistryOptions = {}): HookRegistry {
  return new HookRegistry(options)
}
