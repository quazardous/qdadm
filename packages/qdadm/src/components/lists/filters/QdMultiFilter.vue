<script setup lang="ts">
/**
 * QdMultiFilter (#5467): a filter of several values, under the filter
 * contract (QdFilterProps in, `update:modelValue` out).
 *
 * - Its choices under their `group` headings, in the order the groups first
 *   appear (the ungrouped first, under no heading); a heading toggles all of
 *   its choices.
 * - A choice's `badge` ({ label, tone }) before its label, in the list and
 *   in the closed filter.
 * - Closed: what is chosen, as badges (or labels), up to 3, then « +N »; all
 *   of it in the tooltip.
 * - A search past 8 choices, on the label, the badge and the group.
 * - Its list as tall as the window allows when it opens (#5470), or
 *   `filter.scrollHeight`.
 *
 * Runtime props, not `defineProps<QdFilterProps>()` (#5469): qdadm ships its
 * .vue sources, and a type imported from another file makes the app's build
 * load TypeScript to resolve it, which a JavaScript app does not have.
 */
import { computed, ref, type PropType } from 'vue'
import MultiSelect from 'primevue/multiselect'
import { useI18n } from '../../../i18n/useI18n'
import type { FilterChoice, FilterConfig } from '../../../composables/useListPage.types'
import { badgeColor, panelListHeight, useFilterModel } from './contract'

// The filter contract's props (QdFilterProps), declared at runtime
const props = defineProps({
  modelValue: { type: null as unknown as PropType<unknown>, default: null },
  filter: { type: Object as PropType<FilterConfig>, required: true },
  options: { type: Array as PropType<FilterChoice[]>, default: () => [] },
  loading: { type: Boolean, default: false },
  atDefault: { type: Boolean, default: true },
})
const emit = defineEmits<{ (e: 'update:modelValue', value: unknown): void }>()
const { tOr } = useI18n()

const model = useFilterModel<unknown[] | null>(props, emit)
const chosen = computed<unknown[]>(() => (Array.isArray(model.value) ? model.value : []))

/** How many choices before the search box shows */
const SEARCH_PAST = 8
const SHOWN = 3

const choices = computed<FilterChoice[]>(() =>
  (props.options ?? []).filter((o) => o && o.value !== null && o.value !== undefined)
)
const grouped = computed(() => choices.value.some((o) => o.group))

interface Group {
  label: string
  items: Array<FilterChoice & { _search: string }>
}
/** The groups, in the order they first appear; the ungrouped first, under no heading */
const groups = computed<Group[]>(() => {
  const byLabel = new Map<string, Group>()
  const loose: Group = { label: '', items: [] }
  for (const o of choices.value) {
    const item = { ...o, _search: [o.label, o.badge?.label, o.group].filter(Boolean).join(' ') }
    if (!o.group) {
      loose.items.push(item)
      continue
    }
    if (!byLabel.has(o.group)) byLabel.set(o.group, { label: o.group, items: [] })
    byLabel.get(o.group)!.items.push(item)
  }
  return [...(loose.items.length ? [loose] : []), ...byLabel.values()]
})
const flat = computed(() => groups.value.flatMap((g) => g.items))

const same = (a: unknown, b: unknown): boolean => a === b || String(a) === String(b)
const choiceOf = (v: unknown): FilterChoice | undefined => choices.value.find((o) => same(o.value, v))

/** A heading: all its choices on, or all off when they all are */
function toggleGroup(group: Group): void {
  const values = group.items.map((i) => i.value)
  const all = values.every((v) => chosen.value.some((c) => same(c, v)))
  const rest = chosen.value.filter((c) => !values.some((v) => same(c, v)))
  model.value = all ? rest : [...rest, ...values]
}
const groupState = (group: Group): 'all' | 'some' | 'none' => {
  const n = group.items.filter((i) => chosen.value.some((c) => same(c, i.value))).length
  return n === 0 ? 'none' : n === group.items.length ? 'all' : 'some'
}

/** The closed filter: the first few chosen, then how many more */
const shownChosen = computed(() => chosen.value.slice(0, SHOWN).map((v) => ({ value: v, choice: choiceOf(v) })))
const more = computed(() => Math.max(0, chosen.value.length - SHOWN))
const allChosen = computed(() =>
  chosen.value.map((v) => {
    const c = choiceOf(v)
    return c ? [c.badge?.label, c.label].filter(Boolean).join(' ') : String(v)
  }).join(', ')
)

/** The list's height: the filter's own, else fitted to the window as the panel opens (#5470) */
const select = ref<{ $el?: HTMLElement } | null>(null)
const fitted = ref('14rem')
const listHeight = computed(() => (props.filter.scrollHeight as string | undefined) || fitted.value)
function fit(): void {
  const el = select.value?.$el
  if (props.filter.scrollHeight || !el || typeof window === 'undefined') return
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  fitted.value = `${panelListHeight(el.getBoundingClientRect(), window.innerHeight, { rem, search: flat.value.length > SEARCH_PAST })}px`
}

const style = (tone?: string) => {
  const color = badgeColor(tone)
  return color ? { '--qd-filter-badge-color': color } : undefined
}
</script>

<template>
  <MultiSelect
    ref="select"
    v-model="model"
    :options="grouped ? groups : flat"
    :option-group-label="grouped ? 'label' : undefined"
    :option-group-children="grouped ? 'items' : undefined"
    option-label="label"
    option-value="value"
    :filter="flat.length > SEARCH_PAST"
    :filter-fields="['_search']"
    :placeholder="filter.placeholder"
    :loading="loading"
    :show-toggle-all="false"
    :scroll-height="listHeight"
    overlay-class="qd-multi-filter-panel"
    class="qd-multi-filter"
    :class="{ 'filter-default': atDefault && chosen.length > 0, 'filter-modified': !atDefault }"
    :style="{ minWidth: (filter.width as string) || '180px' }"
    :aria-label="filter.placeholder"
    :title="allChosen || undefined"
    :data-filter="filter.name"
    @before-show="fit"
  >
    <template #value>
      <span v-if="!chosen.length" class="qd-multi-filter-placeholder">{{ filter.placeholder }}</span>
      <span v-else class="qd-multi-filter-chosen">
        <template v-for="c in shownChosen" :key="String(c.value)">
          <span v-if="c.choice?.badge" class="qd-filter-badge" :style="style(c.choice.badge.tone)">{{ c.choice.badge.label }}</span>
          <span v-else class="qd-multi-filter-chip">{{ c.choice?.label ?? String(c.value) }}</span>
        </template>
        <span v-if="more" class="qd-multi-filter-more">{{ tOr('core.filters.more', '+{count}', { count: more }) }}</span>
      </span>
    </template>
    <template #optiongroup="{ option }">
      <button
        v-if="option.label"
        type="button"
        class="qd-multi-filter-group"
        :data-state="groupState(option)"
        :aria-pressed="groupState(option) === 'all' ? 'true' : groupState(option) === 'some' ? 'mixed' : 'false'"
        :title="tOr('core.filters.toggleGroup', 'All of {group}', { group: option.label })"
        @click.stop="toggleGroup(option)"
      >
        {{ option.label }}
      </button>
    </template>
    <template #option="{ option }">
      <span class="qd-multi-filter-option">
        <span v-if="option.badge" class="qd-filter-badge" :style="style(option.badge.tone)">{{ option.badge.label }}</span>
        <span>{{ option.label }}</span>
      </span>
    </template>
  </MultiSelect>
</template>
