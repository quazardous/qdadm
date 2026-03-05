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
  /** Fetch options from a raw API endpoint */
  endpoint?: string
  /** When using endpoint: pick a sub-key from the response data */
  pick?: string
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

  // Resolve orchestrator lazily (only if entity mode)
  let getManager: ((name: string) => { list: (params?: Record<string, unknown>) => Promise<{ items: unknown[] }> }) | null = null

  if (config.entity) {
    try {
      const orc = useOrchestrator()
      getManager = orc.getManager as typeof getManager
    } catch {
      // Orchestrator not available
    }
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
        const response = await fetch(config.endpoint, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const json = await response.json()

        let data = json.data ?? json

        if (config.pick && typeof data === 'object' && !Array.isArray(data)) {
          data = (data as Record<string, unknown>)[config.pick]
        }

        items = Array.isArray(data) ? data : []
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
      result = (filtered.length === 1 && filtered[0].toLowerCase() === q)
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
