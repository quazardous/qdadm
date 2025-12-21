<script setup>
/**
 * BoolCell - Standardized boolean display for list columns
 *
 * Tristate display:
 * - true: green check
 * - false: red cross
 * - null/undefined: empty
 *
 * Usage:
 * <Column field="read" header="Read">
 *   <template #body="{ data }">
 *     <BoolCell :value="data.read" />
 *   </template>
 * </Column>
 */
defineProps({
  value: {
    type: Boolean,
    default: null
  }
})
</script>

<template>
  <i v-if="value === true" class="pi pi-check" style="color: var(--p-green-500)" />
  <i v-else-if="value === false" class="pi pi-times" style="color: var(--p-red-500)" />
</template>
