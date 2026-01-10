<script setup>
/**
 * SeverityTag - Auto-discovers severity from EntityManager
 *
 * Entity can be specified explicitly or auto-discovered from list context.
 *
 * @example
 * // Explicit entity
 * <SeverityTag entity="jobs" field="status" :value="job.status" />
 *
 * // Auto-discover from list context (inside ListPage)
 * <SeverityTag field="status" :value="data.status" />
 *
 * // With custom label
 * <SeverityTag entity="stories" field="status" :value="story.status" label="Published" />
 */
import { computed, inject } from 'vue'
import Tag from 'primevue/tag'

const props = defineProps({
  // Entity name (e.g., 'jobs', 'stories') - optional if inside ListPage context
  entity: {
    type: String,
    default: null
  },
  // Field name for severity lookup (e.g., 'status')
  field: {
    type: String,
    required: true
  },
  // Field value
  value: {
    type: [String, Number, Boolean],
    default: null
  },
  // Optional custom label (defaults to value)
  label: {
    type: String,
    default: null
  },
  // Default severity if no mapping found
  defaultSeverity: {
    type: String,
    default: 'secondary'
  }
})

const orchestrator = inject('qdadmOrchestrator')
// Auto-discover entity from page context (provided by useListPage, useBareForm, etc.)
const mainEntity = inject('mainEntity', null)

const resolvedEntity = computed(() => props.entity || mainEntity)

const manager = computed(() => {
  if (!resolvedEntity.value) return null
  return orchestrator?.get(resolvedEntity.value)
})

const severity = computed(() => {
  if (!manager.value) return props.defaultSeverity
  return manager.value.getSeverity(props.field, props.value, props.defaultSeverity)
})

const displayLabel = computed(() => {
  return props.label ?? props.value
})
</script>

<template>
  <Tag :value="displayLabel" :severity="severity" />
</template>
