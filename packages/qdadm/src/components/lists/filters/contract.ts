/**
 * The filter contract (#5467): what a filter's component receives from the
 * list, and what it gives back. qdadm's own filters and an app's follow it.
 *
 * ```vue
 * <script setup>
 * import { useFilterModel } from '@quazardous/qdadm'
 * const props = defineProps(['modelValue', 'filter', 'options', 'loading', 'atDefault'])
 * const emit = defineEmits(['update:modelValue'])
 * const value = useFilterModel(props, emit)   // read it, set it: the list does the rest
 * </script>
 * ```
 *
 * The component never touches the list, the route or the storage: the load,
 * the address, the session, the links, the active count and Clear are the
 * list's. It gives back a value of the declared shape: an array (or `[]` /
 * `null` for none) for a `multiple` filter; otherwise one value, whatever
 * it holds (a scalar, or a pair such as a range `[from, to]`), or `null`.
 */
import { computed, type WritableComputedRef } from 'vue'
import type { FilterChoice, FilterConfig } from '../../../composables/useListPage.types'
import { runToneColor } from '../../../run/run'

/** What a filter's component receives */
export interface QdFilterProps {
  /** The value: an array for a `multiple` filter (`[]` when none), else one value (any shape: a scalar, a range) or `null` */
  modelValue: unknown
  /** The filter as declared, resolved: name, placeholder, multiple, its own keys */
  filter: FilterConfig
  /** The choices as shown: translated, the value filtered on kept, with `group` and `badge` */
  options: FilterChoice[]
  /** Its choices are being read */
  loading: boolean
  /** The value is the filter's default */
  atDefault: boolean
}

/** What it gives back */
export interface QdFilterEmits {
  (e: 'update:modelValue', value: unknown): void
}

/** The value as a ref: reading it reads the prop, setting it emits `update:modelValue` */
export function useFilterModel<V = unknown>(props: { modelValue: unknown }, emit: (e: 'update:modelValue', value: unknown) => void): WritableComputedRef<V> {
  return computed<V>({
    get: () => props.modelValue as V,
    set: (value) => emit('update:modelValue', value),
  })
}

/**
 * A value given back, to the declared shape: a filter of several values
 * takes an array, so a single value is wrapped. One value may be anything
 * (a range is one value), `undefined` read as none. Returns what was wrong,
 * for the list to say in development.
 */
export function shapeFilterValue(multiple: boolean, value: unknown): { value: unknown; problem: string | null } {
  if (value === undefined) return { value: multiple ? [] : null, problem: null }
  if (multiple && value !== null && !Array.isArray(value)) {
    return { value: [value], problem: 'gave a single value to a filter of several values; wrapped in an array' }
  }
  return { value: multiple ? (value ?? []) : value, problem: null }
}

/** A badge's colour: a tone name or alias as the run strip reads it (#5455), else a CSS colour as is */
export function badgeColor(tone: string | null | undefined): string | null {
  if (!tone) return null
  const named = runToneColor(tone)
  // A name the app has no --qd-tone-<name> for falls back to the word, a CSS colour name
  return named ? named.replace(/\)$/, `, ${tone})`) : tone
}
