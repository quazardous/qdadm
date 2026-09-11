/**
 * What the page on screen is doing (#2363), for the debug tools and the MCP's `page_snapshot`.
 *
 * The list, form and show composables register a getter while their page lives. Pages can nest (a list of loans
 * inside a book's show page), so the store is a stack: the innermost page answers, and the outer one answers again
 * once the inner one is gone. Counts and names only — never row contents.
 */

export interface ListPageState {
  kind: 'list'
  entity: string
  rows: number
  total: number
  page: number
  pageSize: number
  sort: { field: string; order: 'asc' | 'desc' } | null
  search: string
  /** Active filters only: empty values are left out. */
  filters: Record<string, unknown>
  selected: number
  loading: boolean
}

export interface FormPageState {
  kind: 'form'
  entity: string
  mode: 'create' | 'edit'
  dirtyFields: string[]
  errors: Record<string, string>
  saving: boolean
  loading: boolean
}

export interface ShowPageState {
  kind: 'show'
  entity: string
  loaded: boolean
  loading: boolean
  error: string | null
}

export type PageState = ListPageState | FormPageState | ShowPageState
export type PageStateGetter = () => PageState

const stack: PageStateGetter[] = []

/** Register the page's state; call the returned function when the page goes away. */
export function registerPageState(getter: PageStateGetter): () => void {
  stack.push(getter)
  return () => {
    const at = stack.lastIndexOf(getter)
    if (at >= 0) stack.splice(at, 1)
  }
}

/** The innermost page's state, or null when no qdadm page is on screen. */
export function currentPageState(): PageState | null {
  const getter = stack[stack.length - 1]
  if (!getter) return null
  try {
    return getter()
  } catch {
    return null
  }
}

/** Active filter values: what a user set, not the empty defaults. */
export function activeFilters(values: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const active: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(values ?? {})) {
    if (value === null || value === undefined || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    active[name] = value
  }
  return active
}
