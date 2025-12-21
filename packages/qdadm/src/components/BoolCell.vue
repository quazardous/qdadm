<script setup>
/**
 * BoolCell - Standardized boolean display for list columns
 *
 * Tristate display:
 * - true / "true" / 1: green check
 * - false / "false" / 0: red cross
 * - null/undefined: empty
 *
 * Usage:
 * <Column field="read" header="Read">
 *   <template #body="{ data }">
 *     <BoolCell :value="data.read" />
 *   </template>
 * </Column>
 */
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: [Boolean, String, Number],
    default: null
  }
})

const isTrue = computed(() => props.value === true || props.value === 'true' || props.value === 1)
const isFalse = computed(() => props.value === false || props.value === 'false' || props.value === 0)
</script>

<template>
  <i v-if="isTrue" class="pi pi-check" style="color: var(--p-green-500)" />
  <i v-else-if="isFalse" class="pi pi-times" style="color: var(--p-red-500)" />
</template>
