/**
 * useAsyncRead - one asynchronous read of a page, and its waiting state (#4665)
 *
 * A page reads several things at once (the server's state, the refs, the
 * builds). Until a read arrives, it must show that it is waiting, not an empty
 * zone, and never a false state such as "no backup" in red.
 *
 * ```ts
 * const backups = useAsyncRead(() => api.get('/backups').then((r) => r.data))
 * // backups.data.value: undefined until the first answer, then the answer, null and [] included
 * // backups.ready.value: true after the first success, for good
 * // backups.pending.value: loading or not ready yet, for :disabled on a gesture that needs it
 * // backups.load(): read again (a retry after an error, a refresh)
 * ```
 *
 * - `loading` is true from creation when the read starts at once: the first
 *   render already shows the wait.
 * - The latest call wins: an earlier answer arriving late is dropped.
 * - A failure stops `loading`, sets `error` (a readable message) and keeps the
 *   last good `data`.
 *
 * QdPending (a badge) and QdPendingZone (an area) take it as `:read`.
 */

import { computed, ref, shallowRef, type ComputedRef, type Ref, type ShallowRef } from 'vue'

export interface UseAsyncReadOptions {
  /** Read at once, from setup. Default true. */
  immediate?: boolean
}

export interface UseAsyncReadReturn<T> {
  /** `undefined` until the first answer; then the last good answer. */
  data: ShallowRef<T | undefined>
  /** Why the last read failed, or null. */
  error: Ref<string | null>
  /** A read is in flight. */
  loading: Ref<boolean>
  /** At least one read succeeded: `data` is an answer, even null or empty. */
  ready: Ref<boolean>
  /** Loading, or nothing read yet: a gesture that needs the data waits. */
  pending: ComputedRef<boolean>
  /** Read (again); resolves with the answer, or undefined when it failed or a newer read took over. */
  load: () => Promise<T | undefined>
}

/** A readable message from whatever a loader threw. */
export function readErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name
  if (typeof err === 'string') return err
  const message = (err as { message?: unknown } | null)?.message
  if (typeof message === 'string' && message) return message
  try {
    return JSON.stringify(err) ?? String(err)
  } catch {
    return String(err)
  }
}

export function useAsyncRead<T>(loader: () => Promise<T> | T, options: UseAsyncReadOptions = {}): UseAsyncReadReturn<T> {
  const { immediate = true } = options

  const data = shallowRef<T | undefined>(undefined)
  const error = ref<string | null>(null)
  const loading = ref(false)
  const ready = ref(false)
  const pending = computed(() => loading.value || !ready.value)

  let latest = 0

  async function load(): Promise<T | undefined> {
    const call = ++latest
    loading.value = true
    try {
      const answer = await loader()
      if (call !== latest) return undefined
      data.value = answer
      error.value = null
      ready.value = true
      return answer
    } catch (err) {
      if (call === latest) error.value = readErrorMessage(err)
      return undefined
    } finally {
      if (call === latest) loading.value = false
    }
  }

  if (immediate) void load()

  return { data, error, loading, ready, pending, load }
}
