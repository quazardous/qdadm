/**
 * useOptionsLookup - Generic composable for autocomplete/dropdown options
 *
 * Fetches options from entity managers or API endpoints for use in any form field.
 * Two modes:
 * - **Pure mode** (default for string/number arrays): returns raw values directly.
 *   Use with MultiSelect :options or AutoComplete :suggestions on string[] fields.
 * - **Mapped mode** (objects with label/value): returns { label, value } items.
 *   Use when source items are objects and you need label ≠ value.
 *
 * Mapped mode display strategies (displayMode):
 * - **bracket** (default): suggestions show "Label [value]", decode extracts from brackets.
 * - **hidden**: suggestions show only "Label", value is resolved via internal lookup.
 *   If the user types a label not in the list, decode returns the typed string as-is.
 *
 * Usage:
 * ```ts
 * // Pure strings — suggestions are string[]
 * const tags = useOptionsLookup({ endpoint: '/api/admin/tags' })
 *
 * // Mapped mode with bracket display (default)
 * const pools = useOptionsLookup({ entity: 'botPools', label: 'name', value: 'id' })
 * // suggestions = ["Pool Alpha [pool-1]", "Pool Beta [pool-2]"]
 * // pools.decode("Pool Alpha [pool-1]") → "pool-1"
 *
 * // Mapped mode with hidden display — user sees labels only
 * const pools = useOptionsLookup({
 *   entity: 'botPools', label: 'name', value: 'id',
 *   displayMode: 'hidden',
 * })
 * // suggestions = ["Pool Alpha", "Pool Beta"]
 * // pools.decode("Pool Alpha") → "pool-1"
 * // pools.resolve("pool-1") → "Pool Alpha"
 *
 * // Custom encode/decode (overrides displayMode)
 * const custom = useOptionsLookup({
 *   entity: 'users', label: 'username', value: 'id',
 *   encode: (item) => `${item.label} (#${item.value})`,
 *   decode: (str) => { const m = str.match(/#(.+)\)$/); return m?.[1] ?? str },
 * })
 * ```
 */
import { ref, onMounted, type Ref } from 'vue'
import { useOrchestrator } from '../orchestrator/useOrchestrator.js'
import { useApiClient } from '../api/apiClient'

export interface OptionsLookupItem {
  label: string
  value: unknown
}

/** Default encode: "Label [value]" */
function defaultEncode(item: OptionsLookupItem): string {
  return `${item.label} [${item.value}]`
}

/** Default decode: extract value from trailing "[value]" */
function defaultDecode(encoded: string): unknown {
  const match = encoded.match(/\[([^\]]+)\]\s*$/)
  return match ? match[1] : encoded
}

export type OptionsDisplayMode = 'bracket' | 'hidden'

export interface UseOptionsLookupConfig {
  /** Fetch options from an entity manager (via orchestrator) */
  entity?: string
  /** Extract distinct values from a specific field (entity mode only) */
  field?: string
  /**
   * Fetch options from an API endpoint.
   *
   * Routing (#1198): a **relative** endpoint goes through the kernel's
   * default API client when one is registered (`Kernel({ apiClient })`) —
   * base URL + auth applied, no per-call wiring. An **absolute** URL is
   * fetched raw (escape hatch for third-party APIs, combine with `headers`).
   * A relative endpoint with no registered client falls back to a raw fetch
   * (legacy) with a console warning.
   */
  endpoint?: string
  /**
   * Route the endpoint request through the named entity's storage
   * (`storage.request('GET', endpoint)`) instead of the kernel client —
   * explicit refinement for multi-API apps. Takes precedence over the
   * kernel client.
   */
  via?: string
  /** When using endpoint: pick a sub-key from the response data */
  pick?: string
  /** Extra headers for the raw-fetch paths (e.g. Authorization) */
  headers?: Record<string, string> | (() => Record<string, string>)
  /** Static options (no fetch needed) */
  static?: unknown[]
  /** Field to use as display label (default: 'name'). Only for mapped mode. */
  label?: string
  /** Field to use as value (default: 'id'). Only for mapped mode. */
  value?: string
  /**
   * How to display mapped values in autocomplete (default: 'bracket').
   * - 'bracket': "Label [value]" — value visible, decode parses brackets
   * - 'hidden': "Label" — value hidden, decode uses internal label→value lookup
   * Ignored when custom encode/decode are provided.
   */
  displayMode?: OptionsDisplayMode
  /** Custom encode function: item → display string (overrides displayMode) */
  encode?: (item: OptionsLookupItem) => string
  /** Custom decode function: display string → raw value (overrides displayMode) */
  decode?: (encoded: string) => unknown
  /** Post-process mapped options */
  transform?: (items: OptionsLookupItem[]) => OptionsLookupItem[]
  /** Auto-load on mount (default: true) */
  autoLoad?: boolean
  /** Threshold: use autocomplete UI if options exceed this count */
  autocompleteThreshold?: number
}

export interface UseOptionsLookupReturn {
  /** Mapped options ({ label, value }[]) for complex dropdowns */
  options: Ref<OptionsLookupItem[]>
  /** Pure values (string[] or number[]) for simple MultiSelect/AutoComplete */
  values: Ref<unknown[]>
  /** Raw items as fetched (before any mapping) */
  raw: Ref<unknown[]>
  /** Loading state */
  loading: Ref<boolean>
  /** Error message if fetch failed */
  error: Ref<string | null>
  /** Filtered suggestions — always string[] (pure values or encoded strings) */
  suggestions: Ref<string[]>
  /** Whether autocomplete is recommended (options exceed threshold) */
  useAutocomplete: Ref<boolean>
  /** Whether data is pure primitives (strings/numbers) */
  isPure: Ref<boolean>
  /** Filter options by query string (for AutoComplete @complete) */
  search: (query: string) => void
  /** Manually (re)load options */
  load: () => Promise<void>
  /** Decode an encoded display string back to raw value. Identity in pure mode. */
  decode: (encoded: string) => unknown
  /** Encode an item { label, value } to display string. */
  encode: (item: OptionsLookupItem) => string
  /** Resolve a raw value to its encoded display string. Returns String(val) if not found. */
  resolve: (rawValue: unknown) => string
}

export function useOptionsLookup(config: UseOptionsLookupConfig): UseOptionsLookupReturn {
  const options = ref<OptionsLookupItem[]>([])
  const values = ref<unknown[]>([])
  const raw = ref<unknown[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const suggestions = ref<string[]>([])
  const useAutocomplete = ref(false)
  const isPure = ref(false)

  const labelField = config.label ?? 'name'
  const valueField = config.value ?? 'id'
  const threshold = config.autocompleteThreshold ?? 50
  const displayMode = config.displayMode ?? 'bracket'

  // Label→value map for hidden mode decode (rebuilt on processItems)
  let labelToValue = new Map<string, unknown>()

  // Resolve encode/decode based on displayMode (custom overrides all)
  const encodeFn = config.encode ?? (
    displayMode === 'hidden'
      ? (item: OptionsLookupItem) => item.label
      : defaultEncode
  )
  const decodeFn = config.decode ?? (
    displayMode === 'hidden'
      ? (encoded: string) => {
          // Exact match first, then case-insensitive
          if (labelToValue.has(encoded)) return labelToValue.get(encoded)
          const lower = encoded.toLowerCase()
          for (const [label, value] of labelToValue) {
            if (label.toLowerCase() === lower) return value
          }
          return encoded // Not found → return as-is (manual input)
        }
      : defaultDecode
  )

  // Resolve orchestrator lazily (entity mode, or via:'entityName' routing)
  type LookupManager = {
    list: (params?: Record<string, unknown>) => Promise<{ items: unknown[] }>
    storage?: {
      request?: (method: string, path: string, options?: Record<string, unknown>) => Promise<unknown>
    }
  }
  let getManager: ((name: string) => LookupManager) | null = null

  if (config.entity || config.via) {
    try {
      const orc = useOrchestrator()
      // Generic-vs-non-generic: getManager is parameterised by an
      // EntityRecord type variable that the local alias intentionally
      // erases. Bridge through `unknown` so strict TS doesn't reject
      // the cross-shape assignment.
      getManager = orc.getManager as unknown as typeof getManager
    } catch {
      // Orchestrator not available
    }
  }

  // Kernel default API client (Kernel({ apiClient })) — used for relative
  // endpoints so base URL + auth apply without per-call wiring (#1198).
  let apiClient: ReturnType<typeof useApiClient> = null
  if (config.endpoint) {
    try {
      apiClient = useApiClient()
    } catch {
      // Outside a setup/injection context
    }
  }

  // Bare-relative warning: once per composable instance, not per load
  let warnedBareRelative = false

  function warnLookup(msg: string): void {
    console.warn(`[qdadm] useOptionsLookup(endpoint: '${config.endpoint}'): ${msg}`)
  }

  /** Shared normalization for every endpoint path: unwrap data, pick, array-check. */
  function normalizeEndpointPayload(json: unknown): unknown[] {
    let data: unknown = (json as { data?: unknown })?.data ?? json
    if (config.pick && typeof data === 'object' && data !== null && !Array.isArray(data)) {
      data = (data as Record<string, unknown>)[config.pick]
    }
    if (!Array.isArray(data)) {
      warnLookup('response contained no usable array (after data/pick unwrap) — check the endpoint payload shape')
      return []
    }
    return data
  }

  /** Endpoint routing (#1198): via storage > relative→kernel client > raw fetch. */
  async function loadFromEndpoint(): Promise<unknown[]> {
    const endpoint = config.endpoint!
    const isAbsolute = /^https?:\/\//i.test(endpoint)

    // 1. via:'entityName' → that entity's storage (explicit refinement)
    if (config.via && getManager) {
      const storage = getManager(config.via)?.storage
      if (storage?.request) {
        try {
          const json = await storage.request('GET', endpoint)
          return normalizeEndpointPayload(json)
        } catch (err) {
          warnLookup(`request via '${config.via}' storage failed: ${err instanceof Error ? err.message : err}`)
          throw err
        }
      }
      warnLookup(`via: '${config.via}' has no storage.request() — falling back to the default routing`)
    }

    // 2. relative endpoint → kernel default API client (base URL + auth)
    if (!isAbsolute && apiClient) {
      try {
        const { data } = await apiClient.get(endpoint)
        return normalizeEndpointPayload(data)
      } catch (err) {
        warnLookup(`request through the kernel apiClient failed: ${err instanceof Error ? err.message : err}`)
        throw err
      }
    }

    // 3. raw fetch — absolute URL (escape hatch) or legacy relative call
    if (!isAbsolute && !warnedBareRelative) {
      warnedBareRelative = true
      warnLookup(
        'relative endpoint fetched bare — no API base URL or auth header applied. ' +
        'Register Kernel({ apiClient }) (recommended), use via: \'entityName\', or pass an absolute URL + headers.'
      )
    }
    const extraHeaders = typeof config.headers === 'function' ? config.headers() : config.headers
    const response = await fetch(endpoint, {
      credentials: 'include',
      headers: { 'Accept': 'application/json', ...extraHeaders },
    })
    if (!response.ok) {
      const authHint = response.status === 401 || response.status === 403
        ? ' — missing auth? register Kernel({ apiClient }) or pass headers'
        : ''
      warnLookup(`HTTP ${response.status}${authHint}`)
      throw new Error(`HTTP ${response.status}`)
    }
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('json')) {
      warnLookup(
        `response is not JSON (content-type: '${contentType || 'unknown'}') — the relative URL likely resolved ` +
        'to the app origin (HTML page). Register Kernel({ apiClient }) or use an absolute URL.'
      )
    }
    let json: unknown
    try {
      json = await response.json()
    } catch (err) {
      warnLookup(`response body is not parseable JSON: ${err instanceof Error ? err.message : err}`)
      throw err
    }
    return normalizeEndpointPayload(json)
  }

  // Encoded strings cache for mapped mode (rebuilt on processItems)
  let encodedStrings: string[] = []

  function processItems(items: unknown[]): void {
    raw.value = items

    // Detect pure mode: all items are primitives (string/number)
    const allPrimitive = items.length > 0 && items.every(
      (item) => typeof item === 'string' || typeof item === 'number',
    )
    isPure.value = allPrimitive

    if (allPrimitive) {
      // Pure mode — values are the items themselves
      values.value = items
      options.value = items.map((item) => ({ label: String(item), value: item }))
      encodedStrings = items.map(String)
    } else {
      // Mapped mode — extract label/value from objects
      options.value = items.map((item) => {
        const obj = item as Record<string, unknown>
        return {
          label: String(obj[labelField] ?? obj.label ?? obj.name ?? obj[valueField] ?? item),
          value: obj[valueField] ?? obj.value ?? obj.id ?? item,
        }
      })
      values.value = options.value.map((opt) => opt.value)

      if (config.transform) options.value = config.transform(options.value)

      // Pre-compute encoded strings for suggestions
      encodedStrings = options.value.map(encodeFn)

      // Build label→value map for hidden mode decode
      labelToValue = new Map(options.value.map((opt) => [encodeFn(opt), opt.value]))
    }

    useAutocomplete.value = items.length > threshold

    // Pre-fill suggestions so dropdown button works on first click
    suggestions.value = encodedStrings
  }

  async function load(): Promise<void> {
    // Static mode — no fetch
    if (config.static) {
      processItems(config.static)
      return
    }

    loading.value = true
    error.value = null

    try {
      let items: unknown[] = []

      if (config.entity && getManager) {
        const manager = getManager(config.entity)
        const result = await manager.list({ page_size: 10000 })
        const rawItems = result.items ?? []

        // If field is specified, extract distinct values from that field
        if (config.field) {
          const seen = new Set<unknown>()
          for (const item of rawItems) {
            const val = (item as Record<string, unknown>)[config.field]
            if (val != null && !seen.has(val)) {
              seen.add(val)
              items.push(val)
            }
          }
        } else {
          items = rawItems
        }
      } else if (config.endpoint) {
        items = await loadFromEndpoint()
      }

      processItems(items)
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  function search(query: string): void {
    let result: string[]
    if (!query) {
      result = encodedStrings
    } else {
      const q = query.toLowerCase()
      const filtered = encodedStrings.filter(
        (s) => s.toLowerCase().includes(q),
      )
      // When query exactly matches a single option (e.g. dropdown click with
      // current value), show all options so the user can browse alternatives
      const sole = filtered.length === 1 ? filtered[0] : undefined
      result = (sole !== undefined && sole.toLowerCase() === q)
        ? encodedStrings
        : filtered
    }
    // Always assign a new array reference so PrimeVue detects the change
    suggestions.value = [...result]
  }

  function decode(encoded: string): unknown {
    if (isPure.value) return encoded
    return decodeFn(encoded)
  }

  function encode(item: OptionsLookupItem): string {
    return encodeFn(item)
  }

  function resolve(rawValue: unknown): string {
    const opt = options.value.find((o) => o.value === rawValue || String(o.value) === String(rawValue))
    if (!opt) return String(rawValue ?? '')
    if (isPure.value) return opt.label
    return encodeFn(opt)
  }

  if (config.autoLoad !== false) {
    onMounted(() => load())
  }

  return { options, values, raw, loading, error, suggestions, useAutocomplete, isPure, search, load, decode, encode, resolve }
}
