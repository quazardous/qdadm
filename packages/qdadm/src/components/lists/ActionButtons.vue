<script setup lang="ts">
/**
 * ActionButtons - Renders action buttons from useTableActions
 *
 * Props:
 * - actions: Array of action objects from getActions(row)
 *
 * Each action object should have:
 * - icon: PrimeVue icon class
 * - tooltip: Tooltip text
 * - severity: Button severity
 * - handler: Click handler function
 * - isDisabled: Boolean disabled state
 */
import Button from 'primevue/button'

interface Action {
  name: string
  icon?: string
  tooltip?: string
  severity: string
  handler: () => void | Promise<void>
  isDisabled?: boolean
}

interface Props {
  actions: Action[]
}

defineProps<Props>()
</script>

<template>
  <div class="table-actions">
    <Button
      v-for="action in actions"
      :key="action.name"
      :icon="action.icon"
      :severity="action.severity"
      text
      rounded
      :disabled="action.isDisabled"
      @click="action.handler"
      v-tooltip.top="action.tooltip"
    />
  </div>
</template>

<!-- Styles in main.css: .table-actions -->
