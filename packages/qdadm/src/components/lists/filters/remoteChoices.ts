/**
 * A filter's choices searched as one types in the open list (#5576), shared
 * by QdSearchFilter (one value) and QdMultiFilter (several): `searchOptions`
 * called after a pause, from a few characters, for a bounded number; a newer
 * search aborts an older one; a failure is said in the list.
 */
import { onBeforeUnmount, ref } from 'vue'
import type { FilterChoice, FilterConfig } from '../../../composables/useListPage.types'

export const SEARCH_DELAY = 250
export const SEARCH_MIN_CHARS = 1
export const SEARCH_LIMIT = 50

/** The filter searches: it has `searchOptions` (searchEndpoint gives one) */
export const searches = (filter: FilterConfig): boolean => typeof filter.searchOptions === 'function'

/** A search's answer, read as choices: `{ label, value, group?, badge? }`, or plain values */
export function asChoices(found: unknown): FilterChoice[] {
  const list = Array.isArray(found) ? found : Array.isArray((found as { items?: unknown })?.items) ? (found as { items: unknown[] }).items : []
  return list.flatMap((o): FilterChoice[] => {
    if (o === null || o === undefined) return []
    if (typeof o !== 'object') return [{ label: String(o), value: o }]
    const r = o as Record<string, unknown>
    const value = r.value ?? r.id
    if (value === undefined || value === null) return []
    return [{
      label: String(r.label ?? r.name ?? value),
      value,
      ...(r.group !== undefined && r.group !== null ? { group: String(r.group) } : {}),
      ...(r.badge ? { badge: r.badge as FilterChoice['badge'] } : {}),
      ...(typeof r.icon === 'string' && r.icon ? { icon: r.icon } : {}),
    }]
  })
}

export function useRemoteChoices(filter: () => FilterConfig) {
  const results = ref<FilterChoice[]>([])
  const searching = ref(false)
  const failed = ref<string | null>(null)
  /** The text searched, as typed */
  const query = ref('')
  let timer: ReturnType<typeof setTimeout> | null = null
  let current: AbortController | null = null

  function cancel(): void {
    if (timer) clearTimeout(timer)
    timer = null
    current?.abort()
    current = null
  }

  /** What was typed: searched after the pause, or cleared under the minimum */
  function search(text: string): void {
    const f = filter()
    query.value = text
    cancel()
    failed.value = null
    const q = text.trim()
    if (!searches(f) || q.length < (f.searchMinChars ?? SEARCH_MIN_CHARS)) {
      results.value = []
      searching.value = false
      return
    }
    searching.value = true
    timer = setTimeout(async () => {
      timer = null
      const controller = new AbortController()
      current = controller
      const limit = f.searchLimit ?? SEARCH_LIMIT
      try {
        const found = await f.searchOptions!(q, { limit, signal: controller.signal })
        if (controller.signal.aborted) return
        results.value = asChoices(found).slice(0, limit)
      } catch (err) {
        if (controller.signal.aborted) return
        results.value = []
        failed.value = err instanceof Error ? err.message : String(err)
      } finally {
        if (current === controller) {
          current = null
          searching.value = false
        }
      }
    }, f.searchDelay ?? SEARCH_DELAY)
  }

  onBeforeUnmount(cancel)
  return { results, searching, failed, query, search, cancel }
}
