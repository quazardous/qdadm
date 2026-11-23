/**
 * useListFilters — the filter subsystem of useListPage (#1195, KPI-8).
 *
 * Mechanical extraction: owns the filter state (filtersMap/filterValues),
 * the three option-source modes (optionsEntity / optionsEndpoint /
 * optionsFromCache), session persistence, URL sync and registry auto-load.
 * useListPage composes it back in; behavior is unchanged.
 */
import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { FilterQuery, type QueryOrchestratorLike } from '../query/FilterQuery'
import { FILTER_TYPES } from './useListPage.types'
import type { FilterConfig, FilterOptions, SearchConfig } from './useListPage.types'
import type { RouteStatePersister } from '../routeState'
import {
  SMART_FILTER_THRESHOLD,
  clearSessionFilters,
  setSessionFilters,
  snakeToTitle,
} from './useListPage.utils'

/** Dependencies injected by useListPage. */
export interface UseListFiltersDeps {
  /** Entity name used for the registry lookup. */
  entityName: string
  /** EntityManager (needs .request for optionsEndpoint mode). */
  manager: {
    request: (method: string, endpoint: string, options?: { data?: unknown; params?: Record<string, unknown> }) => Promise<unknown>
    storage?: { supportsPathRequests?: boolean } | null
    /** How its lists write a defaulted filter's empty choice (#5460) */
    filterEmptyValue?: string | number | null
  }
  /** Orchestrator, forwarded to FilterQuery for optionsEntity mode. */
  orchestrator: QueryOrchestratorLike | null | undefined
  /** Loaded list items (source for optionsFromCache mode). */
  items: Ref<unknown[]>
  /** Current page ref — filter changes reset it to 1. */
  page: Ref<number>
  /** Rows per page — persisted alongside the rest (#2146). */
  pageSize: Ref<number>
  /** Active sort field, persisted alongside the rest (#2146). */
  sortField: Ref<string | null>
  /** Active sort direction. */
  sortOrder: Ref<number>
  /**
   * Whether the sort is remembered at all.
   *
   * Its own flag rather than folded into `routeStateWrites`, because it has
   * always been separately switchable and a seam refactor must not quietly
   * take an option away.
   */
  persistSort: boolean
  /** Search query ref (shared with the search subsystem). */
  searchQuery: Ref<string>
  /** Session-restored filter values (already stripped of _search). */
  savedFilters: Record<string, unknown> | null
  persistFilters: boolean
  /** Where this list's state is remembered (#2146). */
  persister: RouteStatePersister | null
  /** This list's namespace, so two lists on one route stop colliding. */
  routeStateScope: string
  /**
   * Whether this list may WRITE its state back.
   *
   * Separate from having a persister because reading and writing were always
   * separate here: `syncUrlParams: false` stopped the query string being
   * written and never stopped it being read, so a hand-typed deep link still
   * restored. Collapsing the two would have changed that quietly.
   */
  routeStateWrites: boolean
  autoLoadFilters: boolean
  filterSessionKey: string
  /** Entity filters registry (injected by the consuming app). */
  entityFilters: Record<string, { search?: SearchConfig; filters?: FilterConfig[] }>
  /** Thunks — resolved lazily, the targets are declared later in useListPage. */
  loadItems: () => void
  setSearch: (searchCfg: Partial<SearchConfig>) => void
}

export interface UseListFiltersReturn {
  filtersMap: Ref<Map<string, FilterConfig>>
  filterValues: Ref<Record<string, unknown>>
  filters: ComputedRef<FilterConfig[]>
  hasActiveFilters: ComputedRef<boolean>
  addFilter: (name: string, filterConfig: FilterOptions) => void
  removeFilter: (name: string) => void
  /** A filter's choices, from the app, at any time (#5457) */
  setFilterOptions: (name: string, options: Array<{ label: string; value: unknown }>) => void
  setFilterValue: (name: string, value: unknown) => void
  updateFilters: (newValues: Record<string, unknown>) => void
  onFiltersChanged: () => void
  clearFilters: () => void
  isFilterAtDefault: (name: string) => boolean
  initFromRegistry: () => void
  loadFilterOptions: () => Promise<void>
  updateCacheBasedFilters: () => Promise<void>
  restoreFilters: () => void
  /** Push filters, search and the page number into the URL (#2113). */
  writeStateToUrl: () => void
  /** The filters and the search, as shown, into the session (#5428) */
  persistSessionFilters: () => void
  /** A stored value read back for a filter: its empty token is present and null (#5460) */
  readStoredFilter: (name: string, raw: unknown) => { present: boolean; value: unknown }
  /** What a filter's value is stored as: its empty token when it has a default (#5460) */
  storedFilterValue: (name: string, value: unknown) => unknown
}

/** A filter of several values (#5467): `multiple`, or the `multiselect` type */
export function isMultiple(def: FilterOptions | undefined | null): boolean {
  return !!def && (def.multiple === true || def.type === 'multiselect')
}

/**
 * The type a filter keeps once its choices are read: a multi-valued filter
 * and one the app draws keep theirs; otherwise the component named, or a
 * dropdown for a few choices and an autocomplete for many.
 */
function typeAfterLoad(def: FilterOptions, few: boolean): FilterOptions['type'] {
  if (isMultiple(def) || (def.component && typeof def.component !== 'string')) return def.type
  return (typeof def.component === 'string' ? def.component : few ? 'dropdown' : 'autocomplete') as FilterOptions['type']
}

/**
 * Several values in one parameter (#5467): comma-joined, readable in a
 * link; a value holding a comma keeps the array (written as JSON).
 */
export function joinValues(values: unknown[]): unknown {
  if (values.some((v) => String(v).includes(','))) return values
  return values.map(String).join(',')
}

/** And back: an array as is, a comma-joined text split, a lone value wrapped; numbers as the URL reads them */
export function splitValues(raw: unknown): unknown[] {
  const one = (v: unknown): unknown => {
    if (typeof v !== 'string' || v === '' || Number.isNaN(Number(v))) return v
    return String(Number(v)) === v ? Number(v) : v
  }
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') return raw.split(',').filter((v) => v !== '').map(one)
  return [raw]
}

export function useListFilters(deps: UseListFiltersDeps): UseListFiltersReturn {
  const {
    entityName,
    manager,
    orchestrator,
    items,
    page,
    searchQuery,
    savedFilters,
    persistFilters,
    persister,
    routeStateScope,
    routeStateWrites,
    pageSize,
    sortField,
    sortOrder,
    persistSort,
    autoLoadFilters,
    filterSessionKey,
    entityFilters,
    loadItems,
    setSearch,
  } = deps

  const filtersMap = ref<Map<string, FilterConfig>>(new Map())
  const filterValues = ref<Record<string, unknown>>(savedFilters || {})

  /** Names the route state already owns — a filter cannot have them (#2113). */
  const RESERVED_QUERY_KEYS = new Set(['page', 'search'])
  const warnedReserved = new Set<string>()

  /**
   * A filter named `page` or `search` silently overwrites the stored key of
   * the same name, and is overwritten back on restore. `search` has behaved
   * this way since the URL sync existed and nobody ever reported it, which
   * says how quiet the failure is; `page` joined it once the page number
   * started being remembered too.
   *
   * SCOPING DID NOT FIX THIS. Prefixing keys by entity separates this list
   * from other lists; it does not separate the list from qdadm's own two
   * keys, which live in the same scope it does — `offers.page` is written by
   * the pager whatever a filter called `page` wants.
   *
   * We name what happens INSTEAD of what was asked, rather than dropping the
   * filter — renaming someone's filter behind their back would be a worse
   * surprise than the collision (ADR 0011).
   */
  function warnIfReservedName(name: string): void {
    if (!RESERVED_QUERY_KEYS.has(name)) return
    // Gated on writing, not on the URL specifically: the collision is with
    // whatever medium this list persists to.
    if (!routeStateWrites) return
    if (warnedReserved.has(name)) return
    warnedReserved.add(name)
    console.warn(
      `[qdadm] Filter "${name}" on "${entityName}" collides with the key of ` +
        `the same name in this list's persisted route state. The list's own ` +
        `${name === 'page' ? 'page number' : 'search query'} wins and this ` +
        `filter will not survive a reload. Rename the filter, or turn the ` +
        `persistence off on this list with syncUrlParams: false.`
    )
  }

  const warnedTypes = new Set<string>()

  /**
   * A filter type qdadm cannot render (#2147).
   *
   * `ListPage` is binary — an autocomplete, or a `Select` for everything
   * else, unknown types included. So an invented type does not fail; it
   * renders as a dropdown with no options, reading "No available options",
   * and the user concludes there is nothing to choose. Reported by a consumer
   * whose two `type: 'text'` filters had never filtered anything.
   *
   * Warned HERE because this is the last place the filter's NAME is known.
   * Three screens later there is only an empty control and no way back to
   * the declaration that caused it.
   */
  function warnIfUnknownType(name: string, type: unknown): void {
    if (type === undefined || type === null) return
    if (FILTER_TYPES.includes(type as (typeof FILTER_TYPES)[number])) return
    const key = `${name}:${String(type)}`
    if (warnedTypes.has(key)) return
    warnedTypes.add(key)
    console.warn(
      `[qdadm] Filter "${name}" on "${entityName}" has type "${String(type)}", ` +
        `which qdadm cannot render. It will fall back to a dropdown, and ` +
        `unless you also give it options that dropdown will be empty — ` +
        `"No available options" — rather than the control you asked for. ` +
        `Known types: ${FILTER_TYPES.join(', ')}.`
    )
  }

  const warnedEndpoints = new Set<string>()

  /**
   * An `optionsEndpoint` filter on a storage that cannot run a path request
   * (#4069) — an `SdkStorage` without its `request` option. The load fails
   * later, behind a dropdown reading "No available options"; said here, by
   * name, where the declaration can still be fixed.
   */
  function warnIfEndpointUnreachable(name: string, filterConfig: FilterOptions): void {
    if (!filterConfig?.optionsEndpoint) return
    if (manager?.storage?.supportsPathRequests !== false) return
    if (warnedEndpoints.has(name)) return
    warnedEndpoints.add(name)
    console.warn(
      `[qdadm] Filter "${name}" on "${entityName}" loads its options from an ` +
        `endpoint, but this entity's storage cannot run a path request, so the ` +
        `dropdown will stay empty. Give the SdkStorage a request option, or ` +
        `pass the filter its options directly.`
    )
  }

  /**
   * Choices with the "All" one at their head (#4692): a select has no other way
   * back to no filter. Not when they hold their own null choice, nor with
   * allLabel: false.
   */
  function withAll(name: string, config: FilterOptions, options: Array<{ label: string; value: unknown }>): Array<{ label: string; value: unknown }> {
    const allLabel = (config as { allLabel?: string | false }).allLabel
    // Not for several values (#5467): choosing none is off
    if (isMultiple(config) || allLabel === false || options.some((o) => (o as { value?: unknown })?.value === null)) return [...options]
    return [
      {
        label: allLabel || config.placeholder || `All ${snakeToTitle(name)}`,
        value: null as unknown,
        ...(!allLabel && !config.placeholder ? { _autoAll: true } : {}),
      },
      ...options,
    ]
  }

  /**
   * A filter's choices, from the app, at any time (#5457): they replace what
   * it had, get the "All" choice as static options do, and are the app's from
   * then on: the cache and endpoint loaders leave them alone.
   */
  function setFilterOptions(name: string, options: Array<{ label: string; value: unknown }>): void {
    const def = filtersMap.value.get(name)
    if (!def) {
      if (import.meta.env.DEV) console.warn(`[qdadm] setFilterOptions: no filter "${name}" on this list`)
      return
    }
    filtersMap.value.set(name, {
      ...def,
      options: withAll(name, def, Array.isArray(options) ? options : []),
      _optionsOwned: true,
      _optionsLoaded: true,
      _optionsLoading: false,
    })
    filtersMap.value = new Map(filtersMap.value)
  }

  // ── A deliberately empty filter (#5460) ───────────────────────────────────
  const unset = (v: unknown): boolean => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
  /** Its default, an empty one (null, [], '') read as none */
  const defaultOf = (def: FilterOptions | undefined): unknown => (def && !unset(def.default) ? def.default : null)
  /** The same value: blanks alike, arrays by their members, '1' and 1 alike (#5467) */
  function sameValue(a: unknown, b: unknown): boolean {
    if (unset(a) && unset(b)) return true
    const list = (v: unknown): string[] => (Array.isArray(v) ? v : [v]).map(String).sort()
    if (Array.isArray(a) || Array.isArray(b)) {
      const x = list(a)
      const y = list(b)
      return x.length === y.length && x.every((v, i) => v === y[i])
    }
    return a === b || (!unset(a) && !unset(b) && String(a) === String(b))
  }

  /**
   * The token a filter's empty choice is stored as, or null when it has no
   * default: there, empty IS the default and stays implicit (a clean link).
   * With a default, an absent filter is read back as that default, so a
   * choice of "none" has to be said.
   */
  function emptyToken(def: FilterOptions | undefined): string | null {
    if (!def || unset(def.default)) return null
    const token = def.emptyValue ?? manager?.filterEmptyValue ?? 'null'
    return String(token)
  }

  /**
   * A stored value read back for a filter: whether the store says anything
   * about it, and what. Its empty token (`null` as the URL decodes it, or
   * the text) means present and null; a blank means absent.
   */
  function readStoredFilter(name: string, raw: unknown): { present: boolean; value: unknown } {
    const token = emptyToken(filtersMap.value.get(name))
    if (token !== null && raw !== undefined && (raw === null ? token === 'null' : String(raw) === token)) return { present: true, value: null }
    if (unset(raw)) return { present: false, value: undefined }
    if (isMultiple(filtersMap.value.get(name))) return { present: true, value: splitValues(raw) }
    return { present: true, value: raw }
  }

  /** What a filter's value is stored as: its empty token when it has a default */
  function storedFilterValue(name: string, value: unknown): unknown {
    // Several values comma-joined (#5467); any other array (a range of the app's) as JSON, as before
    if (!unset(value)) return Array.isArray(value) && isMultiple(filtersMap.value.get(name)) ? joinValues(value) : value
    return emptyToken(filtersMap.value.get(name))
  }

  function addFilter(name: string, filterConfig: FilterOptions): void {
    warnIfReservedName(name)
    warnIfUnknownType(name, filterConfig?.type)
    warnIfEndpointUnreachable(name, filterConfig)
    // Static options get the same "All" choice as loaded ones (#4692)
    const staticOptions = Array.isArray(filterConfig.options) ? filterConfig.options : null
    const withAllOptions = staticOptions !== null ? withAll(name, filterConfig, staticOptions) : null
    filtersMap.value.set(name, {
      name,
      type: 'select',
      placeholder: name,
      // No placeholder given: the field's label, resolved at render (#4692)
      ...(filterConfig.placeholder ? {} : { _autoPlaceholder: true }),
      ...filterConfig,
      ...(withAllOptions ? { options: withAllOptions } : {}),
    })
    if (filterValues.value[name] === undefined) {
      filterValues.value[name] = filterConfig.default ?? null
    }
  }

  function removeFilter(name: string): void {
    filtersMap.value.delete(name)
    delete filterValues.value[name]
  }

  function setFilterValue(name: string, value: unknown): void {
    filterValues.value = { ...filterValues.value, [name]: value }
  }

  function updateFilters(newValues: Record<string, unknown>): void {
    filterValues.value = { ...filterValues.value, ...newValues }
    onFiltersChanged()
  }

  /**
   * Push the list's own state into the URL (#2113).
   *
   * Filters, search AND the page number, each written only when it differs
   * from the default and removed otherwise, so a pristine list leaves a clean
   * URL. `router.replace` rather than `push`: paging is not a history step of
   * its own, but the URL must carry the page at the moment the user leaves
   * for a detail view, so that coming back restores it.
   */
  function writeStateToUrl(): void {
    if (!persister || !routeStateWrites) return

    // Page 1 is the default and stays implicit, exactly like an unset filter:
    // the persister drops null/undefined/'' rather than storing them empty,
    // so a pristine list leaves a clean link.
    //
    // `search` and `page` still share the namespace with the filter names —
    // the scope separates this list from OTHER lists, not from qdadm's own
    // keys — which is why addFilter() still warns about a filter called
    // `page` or `search`.
    // A filter with a default and emptied on purpose: its empty token (#5460)
    const stored: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(filterValues.value)) stored[name] = storedFilterValue(name, value)
    persister.write(routeStateScope, {
      ...stored,
      search: searchQuery.value || null,
      page: page.value > 1 ? page.value : null,
      // Always written, never conditional on a default: rows-per-page is a
      // choice somebody made, and the default is not "unset" — it is what
      // they get back if we forget. The default composition routes it to a
      // cookie, so it does not land in a shareable link.
      pageSize: pageSize.value,
      // Sort goes to the session under the default composition, so it does
      // not reach a link either. `persistSort: false` writes null, which the
      // persister removes — the option has always been able to turn this off
      // and still can.
      //
      // The DIRECTION is stored only when there is a field to apply it to.
      // An order on its own is not partial state, it is meaningless state,
      // and storing it would leave `sortOrder: -1` sitting in every unsorted
      // list's namespace.
      sort: persistSort ? sortField.value : null,
      sortOrder: persistSort && sortField.value ? sortOrder.value : null,
    })
  }

  /** The filters and the search, as shown, into the session */
  function persistSessionFilters(): void {
    if (persistFilters) {
      const toPersist: Record<string, unknown> = {}
      for (const [name, value] of Object.entries(filterValues.value)) {
        const filterDef = filtersMap.value.get(name)
        if (filterDef?.persist === false) continue
        if (!unset(value)) toPersist[name] = value
        // Emptied on purpose, against a default: kept as null (#5460)
        else if (emptyToken(filterDef) !== null) toPersist[name] = null
      }
      if (searchQuery.value) {
        toPersist._search = searchQuery.value
      }
      setSessionFilters(filterSessionKey, toPersist)
    }
  }

  function onFiltersChanged(): void {
    page.value = 1
    loadItems()
    persistSessionFilters()
    writeStateToUrl()
  }

  function clearFilters(): void {
    const cleared: Record<string, unknown> = {}
    for (const [key, filterDef] of filtersMap.value.entries()) {
      cleared[key] = filterDef.default ?? null
    }
    filterValues.value = cleared
    searchQuery.value = ''
    if (persistFilters) {
      clearSessionFilters(filterSessionKey)
    }
    page.value = 1
    if (routeStateWrites) persister?.clear(routeStateScope)
    loadItems()
  }

  const isSet = (v: unknown): boolean => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)

  /**
   * The value a filter filters on is always among its shown choices (#5457):
   * a value from the URL, a link or a card that the choices lack would leave
   * the select blank while it filters. Added as its raw value, to the choices
   * the bar is given only.
   */
  function withActiveValue(filter: FilterConfig): FilterConfig {
    const value = filterValues.value[filter.name]
    if (!Array.isArray(filter.options) || !isSet(value)) return filter
    const known = new Set(filter.options.map((o) => String((o as { value?: unknown })?.value)))
    const missing = (Array.isArray(value) ? value : [value]).filter((v) => isSet(v) && !known.has(String(v)))
    if (!missing.length) return filter
    return { ...filter, options: [...filter.options, ...missing.map((v) => ({ label: String(v), value: v, _unlisted: true }))] }
  }

  const filters = computed(() => Array.from(filtersMap.value.values()).map(withActiveValue))

  /**
   * Check if a filter is at its default value
   * Used for styling: default = blue (info), modified = orange (warning)
   */
  function isFilterAtDefault(name: string): boolean {
    const filterDef = filtersMap.value.get(name)
    if (!filterDef) return true
    return sameValue(filterValues.value[name], defaultOf(filterDef))
  }

  /**
   * Check if any filter is NOT at its default value (or search is active)
   * Useful to show a "clear filters" button only when needed
   */
  const hasActiveFilters = computed(() => {
    if (searchQuery.value) return true
    for (const [name, filterDef] of filtersMap.value.entries()) {
      if (!sameValue(filterValues.value[name], defaultOf(filterDef))) return true
    }
    return false
  })

  function initFromRegistry(): void {
    if (!autoLoadFilters) return

    const entityConfig = entityFilters[entityName]
    if (!entityConfig) return

    if (entityConfig.search) {
      setSearch(entityConfig.search)
    }

    if (entityConfig.filters) {
      for (const filterDef of entityConfig.filters) {
        addFilter(filterDef.name, filterDef)
      }
    }
  }

  /**
   * Fetch the remote options that populate filter dropdowns (#1934 lot 1).
   *
   * The loop used to be sequential: three filters with remote options cost
   * three round trips in a queue, and the rows waited behind the sum. They
   * are independent, so they now go together and cost the slowest.
   *
   * Deduplicated by `optionsEntity` on purpose. Sequential execution had one
   * accidental virtue — two filters on the same entity meant one fetch and
   * one cache hit — and firing them in parallel would turn that into two
   * concurrent fetches. Trading latency for duplicate requests is not a win,
   * so filters sharing an entity are still chained behind one another while
   * different entities run side by side.
   *
   * This no longer invokes `filter:alter`: that hook establishes what the
   * query will ask for, so it belongs with the other query-settling work in
   * `onMounted`, not behind the network (#1934 lot 2).
   */
  // ── Cascading filters (#5427) ──────────────────────────────────────────────
  const blank = (v: unknown): boolean => v === null || v === undefined || v === ''
  const same = (a: unknown, b: unknown): boolean => a === b || (!blank(a) && !blank(b) && String(a) === String(b))
  /** The filter names a filter depends on */
  const dependencies = (def: FilterOptions): string[] => (!def.dependsOn ? [] : Array.isArray(def.dependsOn) ? def.dependsOn : Object.keys(def.dependsOn))
  /** Its dependencies' values, by filter name and as sent (renamed, blanks left out) */
  function dependencyValues(def: FilterOptions): { values: Record<string, unknown>; params: Record<string, unknown> } {
    const values: Record<string, unknown> = {}
    const params: Record<string, unknown> = {}
    for (const name of dependencies(def)) {
      const value = filterValues.value[name]
      values[name] = value ?? null
      if (blank(value)) continue
      const as = Array.isArray(def.dependsOn) ? name : (def.dependsOn as Record<string, string>)[name] || name
      params[as] = value
    }
    return { values, params }
  }
  /** The latest read of each dependent filter's choices: an older answer is ignored */
  const reads = new Map<string, number>()
  let optionsStarted = false

  /** Unknown names and cycles: said once, in development, and that dependsOn ignored */
  function checkDependencies(): void {
    for (const [name, def] of filtersMap.value) {
      if (!def.dependsOn) continue
      const unknown = dependencies(def).filter((d) => !filtersMap.value.has(d))
      const cycle = (() => {
        const seen = new Set<string>()
        const walk = (n: string): boolean => {
          if (n === name && seen.size) return true
          if (seen.has(n)) return false
          seen.add(n)
          return dependencies(filtersMap.value.get(n) ?? {}).some(walk)
        }
        return dependencies(def).some((d) => walk(d))
      })()
      if (!unknown.length && !cycle) continue
      if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV !== false) {
        console.warn(
          unknown.length
            ? `[qdadm] Filter "${name}" on "${entityName}" depends on ${unknown.map((u) => `"${u}"`).join(', ')}, which the list does not declare: its dependsOn is ignored.`
            : `[qdadm] Filter "${name}" on "${entityName}" depends on itself through its dependsOn: ignored.`
        )
      }
      filtersMap.value.set(name, { ...def, dependsOn: undefined })
    }
  }

  /** Read a dependent filter's choices again, the old ones shown meanwhile */
  async function reloadDependent(name: string): Promise<void> {
    const def = filtersMap.value.get(name)
    if (!def) return
    filtersMap.value.set(name, { ...def, _optionsLoading: true })
    filtersMap.value = new Map(filtersMap.value)
    await loadOneFilterOptions(name, filtersMap.value.get(name)!)
    filtersMap.value = new Map(filtersMap.value)
  }

  // One change or several in a tick: each dependent filter whose inputs moved reads again
  watch(
    () =>
      [...filtersMap.value]
        .filter(([, def]) => def.dependsOn)
        .map(([name, def]) => [name, JSON.stringify(dependencies(def).map((d) => filterValues.value[d] ?? null))] as const),
    (now, before) => {
      if (!optionsStarted) return
      const was = new Map(before)
      for (const [name, signature] of now) {
        if (was.has(name) && was.get(name) !== signature) void reloadDependent(name)
      }
    }
  )

  async function loadFilterOptions(): Promise<void> {
    if (!optionsStarted) checkDependencies()
    optionsStarted = true
    const pending = Array.from(filtersMap.value).filter(([, filterDef]) => {
      if (filterDef._optionsOwned) return false
      if (filterDef.options && filterDef.options.length > 1) return false
      if (filterDef.optionsFromCache) return false
      return true
    })

    // One chain per source entity; everything else is a chain of its own.
    const chains = new Map<string, Promise<void>>()

    await Promise.all(
      pending.map(([filterName, filterDef]) => {
        const key = filterDef.optionsEntity ? `entity:${filterDef.optionsEntity}` : `own:${filterName}`
        const previous = chains.get(key) ?? Promise.resolve()
        const next = previous.then(() => loadOneFilterOptions(filterName, filterDef))
        chains.set(key, next)
        return next
      })
    )

    // Trigger Vue reactivity
    filtersMap.value = new Map(filtersMap.value)
  }

  async function loadOneFilterOptions(filterName: string, filterDef: FilterConfig): Promise<void> {
      // The app's own choices (setFilterOptions, #5457): not read again
      if (filtersMap.value.get(filterName)?._optionsOwned) return
      // A dependent filter reads its choices with its dependencies' values (#5427)
      const dependent = dependencies(filterDef).length > 0
      const { values, params } = dependent ? dependencyValues(filterDef) : { values: {}, params: {} }
      const read = dependent ? (reads.get(filterName) ?? 0) + 1 : 0
      if (dependent) reads.set(filterName, read)
      const stale = (): boolean => dependent && reads.get(filterName) !== read
      // The source's label and value fields, kept for the next read
      const sourceLabel = (filterDef.optionLabel ?? filterDef._sourceLabel) as string | undefined
      const sourceValue = (filterDef.optionValue ?? filterDef._sourceValue) as string | undefined
      try {
        let rawOptions: Array<{ label: string; value: unknown }> | null = null

        // A dependent filter on an entity: its list, filtered by the values (no FilterQuery cache)
        if (filterDef.optionsEntity && dependent) {
          const related = orchestrator?.get(filterDef.optionsEntity) as { list: (p: Record<string, unknown>) => Promise<{ items?: unknown[] }> } | undefined
          if (!related) throw new Error(`no entity "${filterDef.optionsEntity}"`)
          const result = await related.list({ page_size: 1000, filters: params })
          rawOptions = (result.items ?? []).map((item) => {
            const row = item as Record<string, unknown>
            return { label: String(row[sourceLabel || 'name'] ?? ''), value: row[sourceValue || 'id'] }
          })
        }
        // Mode 1: optionsEntity - fetch from related EntityManager via FilterQuery
        else if (filterDef.optionsEntity) {
          const filterQuery = new FilterQuery({
            source: 'entity',
            entity: filterDef.optionsEntity,
            label: filterDef.optionLabel || 'name',
            value: filterDef.optionValue || 'id',
          })

          rawOptions = (await filterQuery.getOptions(orchestrator)) as Array<{
            label: string
            value: unknown
          }>
          filterDef._filterQuery = filterQuery
        }
        // Mode 2: optionsEndpoint - fetch from API endpoint
        else if (filterDef.optionsEndpoint) {
          const endpoint =
            filterDef.optionsEndpoint === true
              ? `distinct/${filterName}`
              : filterDef.optionsEndpoint
          const response = dependent
            ? await manager.request('GET', endpoint as string, { params })
            : await manager.request('GET', endpoint as string)
          const data = Array.isArray(response)
            ? response
            : ((response as Record<string, unknown>)?.items as unknown[]) || []
          rawOptions = data.map((opt) => {
            if (typeof opt === 'object' && opt !== null) {
              const o = opt as Record<string, unknown>
              return {
                label: (o.label || o.name || String(o.value ?? o.id)) as string,
                value: o.value ?? o.id,
                // Grouped and badged choices (#5467)
                ...(o.group !== undefined && o.group !== null ? { group: o.group } : {}),
                ...(o.badge ? { badge: o.badge } : {}),
              }
            }
            return { label: snakeToTitle(String(opt)), value: opt }
          })
        }

        // An older read answering late: the latest one decides
        if (stale()) return

        if (rawOptions !== null) {
          const cacheOptions = filterDef.cacheOptions ?? 'auto'
          let shouldCache = cacheOptions === true

          if (cacheOptions === 'auto') {
            shouldCache = rawOptions.length <= SMART_FILTER_THRESHOLD
          }

          const componentType = typeAfterLoad(filterDef, shouldCache)
          const allLabel =
            filterDef.allLabel || filterDef.placeholder || `All ${snakeToTitle(filterName)}`
          // Neither allLabel nor placeholder given: "All <field>" from the catalogue at render (#4692)
          const autoAll = !filterDef.allLabel && !!(filterDef as { _autoPlaceholder?: boolean })._autoPlaceholder
          let finalOptions = isMultiple(filterDef) ? [...rawOptions] : [{ label: allLabel, value: null as unknown, ...(autoAll ? { _autoAll: true } : {}) }, ...rawOptions]

          if (typeof filterDef.processor === 'function') {
            finalOptions = filterDef.processor(finalOptions)
          }

          const updatedFilter: FilterConfig = {
            ...filterDef,
            options: finalOptions,
            type: componentType,
            _cacheOptions: shouldCache,
            _optionsLoaded: shouldCache,
            _optionsLoading: false,
            ...(dependent ? { _sourceLabel: sourceLabel, _sourceValue: sourceValue } : {}),
          }
          delete updatedFilter.optionLabel
          delete updatedFilter.optionValue
          filtersMap.value.set(filterName, updatedFilter)

          // The value picked, against the new choices: cleared if it no longer stands
          if (dependent) await recheckValue(filterName, updatedFilter, rawOptions, values, stale)
        }
      } catch (error) {
        console.warn(`[qdadm] Failed to load options for filter "${filterName}":`, error)
        const current = filtersMap.value.get(filterName)
        if (current?._optionsLoading) filtersMap.value.set(filterName, { ...current, _optionsLoading: false })
      }
  }

  /** A value the new choices no longer hold (or `validate` refuses) is cleared, the usual way (#5427) */
  async function recheckValue(
    name: string,
    def: FilterConfig,
    options: Array<{ label: string; value: unknown }>,
    values: Record<string, unknown>,
    stale: () => boolean
  ): Promise<void> {
    const value = filterValues.value[name]
    if (unset(value) || sameValue(value, def.default)) return
    // Several values (#5467): those still among the choices stay
    if (Array.isArray(value) && !def.validate) {
      const kept = value.filter((v) => options.some((o) => same(o.value, v)))
      if (stale() || kept.length === value.length || !sameValue(filterValues.value[name], value)) return
      filterValues.value = { ...filterValues.value, [name]: kept.length ? kept : defaultOf(def) }
      onFiltersChanged()
      return
    }
    const stands = def.validate ? await def.validate(value, { options, values }) : options.some((o) => same(o.value, value))
    if (stale() || stands || !sameValue(filterValues.value[name], value)) return
    filterValues.value = { ...filterValues.value, [name]: def.default ?? null }
    onFiltersChanged()
  }

  async function updateCacheBasedFilters(): Promise<void> {
    let hasChanges = false

    for (const [filterName, filterDef] of filtersMap.value) {
      if (!filterDef.optionsFromCache) continue
      if (filterDef._optionsLoaded || filterDef._optionsOwned) continue
      // Skip if filter has an explicit query property (advanced usage)
      if (filterDef.query) continue

      // Built always (#5457), kept only when complete: rows that this filter
      // does not narrow. An empty list, or rows already filtered by it, give
      // choices for now (the processor's, the value's), built again next load.
      const complete = items.value.length > 0 && !isSet(filterValues.value[filterName])

      const fieldName =
        typeof filterDef.optionsFromCache === 'string' ? filterDef.optionsFromCache : filterName

      const filterQuery = new FilterQuery({
        source: 'field',
        field: fieldName,
      })

      // Provide a minimal mock manager with cached data for field-based filtering
      filterQuery.setParentManager({
        _cache: items.value,
        list: async () => ({ items: items.value }),
      })

      const rawOptions = (await filterQuery.getOptions()) as Array<{ label: string; value: unknown }>

      const cacheOptions = filterDef.cacheOptions ?? 'auto'
      let shouldCache = true

      if (cacheOptions === 'auto') {
        shouldCache = rawOptions.length <= SMART_FILTER_THRESHOLD
      } else if (cacheOptions === false) {
        shouldCache = false
      }

      const componentType = typeAfterLoad(filterDef, rawOptions.length <= SMART_FILTER_THRESHOLD)

      const allLabel =
        filterDef.allLabel || filterDef.placeholder || `All ${snakeToTitle(filterName)}`
      const fromRows = rawOptions.map((opt) => ({
        label: snakeToTitle(String(opt.label)),
        value: opt.value,
      }))
      let finalOptions = isMultiple(filterDef) ? fromRows : [{ label: allLabel, value: null as unknown }, ...fromRows]

      if (typeof filterDef.processor === 'function') {
        finalOptions = filterDef.processor(finalOptions)
      }

      const updatedFilter: FilterConfig = {
        ...filterDef,
        options: finalOptions,
        type: componentType,
        _cacheOptions: shouldCache,
        _optionsLoaded: complete,
        _filterQuery: filterQuery,
      }

      filtersMap.value.set(filterName, updatedFilter)
      hasChanges = true
    }

    if (hasChanges) {
      filtersMap.value = new Map(filtersMap.value)
    }
  }

  function restoreFilters(): void {
    const stored = persister?.read(routeStateScope)
    if (!stored) return

    // Only keys this list declares as filters: the scope keeps other lists
    // out, but a persister may still hand back something the app put there.
    for (const key of filtersMap.value.keys()) {
      if (stored[key] === undefined) continue
      // Its empty token is a choice, not an absence (#5460)
      const read = readStoredFilter(key, stored[key])
      filterValues.value[key] = read.present ? read.value : stored[key]
    }

    // NOT `typeof === 'string'` (#2147). A term that survives a numeric round
    // trip — an order id, an invoice, a reference — comes back from the URL
    // as a number, and a string-only guard dropped it: the box came back
    // empty and the list unfiltered, so a shared link showed the recipient
    // something other than what the sender searched for.
    //
    // Safe to stringify because the persister no longer coerces lossily: a
    // value that could not be written back as the same text was left as text.
    if (stored.search !== null && stored.search !== undefined && stored.search !== '') {
      searchQuery.value = String(stored.search)
    }

    // The page must be restored HERE, before the first loadItems(): restoring
    // it later would mean a first request for page 1 and a second for the
    // real one (#2113).
    const restoredPage = Number(stored.page)
    if (Number.isInteger(restoredPage) && restoredPage > 0) {
      page.value = restoredPage
    }
  }

  return {
    filtersMap,
    filterValues,
    filters,
    hasActiveFilters,
    addFilter,
    removeFilter,
    setFilterOptions,
    setFilterValue,
    updateFilters,
    onFiltersChanged,
    clearFilters,
    isFilterAtDefault,
    initFromRegistry,
    loadFilterOptions,
    updateCacheBasedFilters,
    restoreFilters,
    writeStateToUrl,
    persistSessionFilters,
    readStoredFilter,
    storedFilterValue,
  }
}
