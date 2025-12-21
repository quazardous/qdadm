<script setup>
/**
 * FilterBar - Reusable filter bar with search field
 *
 * Props:
 * - search: Current search value (v-model compatible)
 * - placeholder: Search input placeholder
 *
 * Slots:
 * - default: Custom filters (left side, before search)
 *
 * Emits:
 * - update:search: When search value changes
 */
import { computed } from 'vue'
import InputText from 'primevue/inputtext'
import InputIcon from 'primevue/inputicon'
import IconField from 'primevue/iconfield'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Search...'
  }
})

const emit = defineEmits(['update:modelValue'])

const searchModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>

<template>
  <div class="filter-bar">
    <div class="filter-bar-left">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="searchModel"
          :placeholder="placeholder"
          :class="{ 'filter-active': searchModel }"
        />
      </IconField>
      <slot ></slot>
    </div>
  </div>
</template>
