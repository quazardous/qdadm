<script setup lang="ts">
/**
 * QdSearchFilter (#5576): one value, chosen in a list whose search box is in
 * the open list, its field not typed into. The filter's fixed `options` (the
 * quick choices) on top, filtered as one types; then the choices searched on
 * the server (`searchOptions` / `searchEndpoint`), by their `group`. The
 * value from the address that is no choice (`unlisted`) shows by its label
 * (`labelFor`), and is never a quick choice.
 *
 * Under the filter contract (QdFilterProps in, `update:modelValue` out).
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, ref, type PropType } from 'vue'
import Select from 'primevue/select'
import { useI18n } from '../../../i18n/useI18n'
import type { FilterChoice, FilterConfig } from '../../../composables/useListPage.types'
import { badgeColor, useFilterModel } from './contract'
import { useRemoteChoices } from './remoteChoices'

const props = defineProps({
  modelValue: { type: null as unknown as PropType<unknown>, default: null },
  filter: { type: Object as PropType<FilterConfig>, required: true },
  options: { type: Array as PropType<FilterChoice[]>, default: () => [] },
  loading: { type: Boolean, default: false },
  atDefault: { type: Boolean, default: true },
})
const emit = defineEmits<{ (e: 'update:modelValue', value: unknown): void }>()
const { tOr } = useI18n()
const model = useFilterModel<unknown>(props, emit)
const remote = useRemoteChoices(() => props.filter)

const same = (a: unknown, b: unknown): boolean => a === b || String(a) === String(b)
type Shown = FilterChoice & { _search: string }

/** The quick choices: the fixed options, never the value added from the address */
const quick = computed<Shown[]>(() =>
  (props.options ?? [])
    .filter((o) => o && !o.unlisted && !o._unlisted && o.value !== null && o.value !== undefined)
    .map((o) => ({ ...o, _search: [o.label, o.badge?.label, o.group].filter(Boolean).join(' ') }))
)
/** The searched ones: always shown (the server matched them), the quick ones not repeated */
const found = computed<Shown[]>(() =>
  remote.results.value
    .filter((r) => !quick.value.some((q) => same(q.value, r.value)))
    .map((r) => ({ ...r, _search: `${remote.query.value} ${r.label}` }))
)

interface Group {
  label: string
  items: Shown[]
}
const groups = computed<Group[]>(() => {
  const out: Group[] = []
  const at = (label: string) => {
    let g = out.find((x) => x.label === label)
    if (!g) out.push((g = { label, items: [] }))
    return g
  }
  for (const o of quick.value) at(o.group ?? '').items.push(o)
  for (const o of found.value) at(o.group ?? tOr('core.filters.found', 'Found')).items.push(o)
  return out.filter((g) => g.items.length)
})
const grouped = computed(() => groups.value.some((g) => g.label))
const flat = computed(() => groups.value.flatMap((g) => g.items))

// The chosen one's label, whatever list it came from
const chosen = ref<FilterChoice | null>(null)
const labelOf = computed(() => {
  const v = model.value
  if (v === null || v === undefined || v === '') return null
  const known = [...(props.options ?? []), ...remote.results.value, ...(chosen.value ? [chosen.value] : [])].find((o) => same(o.value, v))
  return known ?? { label: String(v), value: v }
})
function pick(value: unknown): void {
  chosen.value = flat.value.find((o) => same(o.value, value)) ?? null
  model.value = value ?? null
}

const empty = computed(() => {
  if (remote.searching.value) return tOr('core.filters.searching', 'Searching…')
  if (remote.failed.value) return tOr('core.filters.searchFailed', 'The search failed: {error}', { error: remote.failed.value })
  const min = props.filter.searchMinChars ?? 1
  if (remote.query.value.trim().length < min) return tOr('core.filters.typeToSearch', 'Type to search')
  return tOr('core.filters.nothingFound', 'Nothing found')
})
const style = (tone?: string) => {
  const color = badgeColor(tone)
  return color ? { '--qd-filter-badge-color': color } : undefined
}
</script>

<template>
  <Select
    :model-value="model"
    :options="grouped ? groups : flat"
    :option-group-label="grouped ? 'label' : undefined"
    :option-group-children="grouped ? 'items' : undefined"
    option-label="label"
    option-value="value"
    filter
    :filter-fields="['_search']"
    :filter-placeholder="tOr('core.filters.search', 'Search')"
    reset-filter-on-hide
    :show-clear="labelOf !== null"
    :loading="loading || remote.searching.value"
    :placeholder="filter.placeholder"
    class="qd-search-filter"
    :class="{ 'filter-default': atDefault && labelOf !== null, 'filter-modified': !atDefault }"
    :style="{ minWidth: (filter.width as string) || '180px' }"
    :aria-label="filter.placeholder"
    :data-filter="filter.name"
    @update:model-value="pick"
    @filter="remote.search($event.value ?? '')"
    @hide="remote.search('')"
  >
    <template #value>
      <span v-if="labelOf" class="qd-multi-filter-option">
        <span v-if="labelOf.badge" class="qd-filter-badge" :style="style(labelOf.badge.tone)">{{ labelOf.badge.label }}</span>
        <span>{{ labelOf.label }}</span>
      </span>
      <span v-else class="qd-multi-filter-placeholder">{{ filter.placeholder }}</span>
    </template>
    <template #optiongroup="{ option }">
      <span v-if="option.label" class="qd-search-filter-group">{{ option.label }}</span>
    </template>
    <template #option="{ option }">
      <span class="qd-multi-filter-option">
        <span v-if="option.badge" class="qd-filter-badge" :style="style(option.badge.tone)">{{ option.badge.label }}</span>
        <span>{{ option.label }}</span>
      </span>
    </template>
    <template #emptyfilter>
      <span class="qd-search-filter-empty" data-search-state>{{ empty }}</span>
    </template>
    <template #empty>
      <span class="qd-search-filter-empty" data-search-state>{{ empty }}</span>
    </template>
  </Select>
</template>
