<script setup>
/**
 * YearRangeFilter - a filter of the app's own, under the filter contract (#5467)
 *
 * It receives the value, the filter, the choices and the state, and gives
 * back `update:modelValue`: here `[from, to]`, or null when both are empty.
 * The list does the rest: the load, the address, the session, Clear.
 */
import { computed } from 'vue'
import InputNumber from 'primevue/inputnumber'
import { useFilterModel } from '@quazardous/qdadm'

const props = defineProps(['modelValue', 'filter', 'options', 'loading', 'atDefault'])
const emit = defineEmits(['update:modelValue'])
const value = useFilterModel(props, emit)

const from = computed(() => (Array.isArray(value.value) ? value.value[0] ?? null : null))
const to = computed(() => (Array.isArray(value.value) ? value.value[1] ?? null : null))
function set(a, b) {
  value.value = a === null && b === null ? null : [a, b]
}
</script>

<script>
// The value in words, for "Save this search" and a run's filter
export default {
  describe: (v) => (Array.isArray(v) ? `${v[0] ?? '…'}–${v[1] ?? '…'}` : undefined),
}
</script>

<template>
  <span class="year-range-filter" :class="{ 'filter-modified': !atDefault }" role="group" :aria-label="filter.placeholder">
    <InputNumber :model-value="from" :use-grouping="false" placeholder="From" input-class="year-range-input" aria-label="From year" @update:model-value="set($event, to)" />
    <span aria-hidden="true">–</span>
    <InputNumber :model-value="to" :use-grouping="false" placeholder="To" input-class="year-range-input" aria-label="To year" @update:model-value="set(from, $event)" />
  </span>
</template>

<style scoped>
.year-range-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.year-range-filter :deep(.year-range-input) {
  width: 5.5rem;
}
</style>
