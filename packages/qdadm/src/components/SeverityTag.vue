<script setup lang="ts">
/**
 * SeverityTag - Auto-discovers severity from EntityManager
 *
 * Renders a PrimeVue Tag for simple severity strings, or a rich badge
 * with icon (including animated spinners) when the severity map provides
 * a descriptor with an `icon` field.
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
import type { Orchestrator } from '../orchestrator/Orchestrator'
import type { EntityManager } from '../entity/EntityManager'

interface Props {
  /** Entity name (e.g., 'jobs', 'stories') - optional if inside ListPage context */
  entity?: string | null
  /** Field name for severity lookup (e.g., 'status') */
  field: string
  /** Field value */
  value?: string | number | boolean | null
  /** Optional custom label (defaults to value) */
  label?: string | null
  /** Default severity if no mapping found */
  defaultSeverity?: string
}

const props = withDefaults(defineProps<Props>(), {
  entity: null,
  value: null,
  label: null,
  defaultSeverity: 'secondary'
})

const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator', null)
// Auto-discover entity from page context (provided by useListPage, useBareForm, etc.)
const mainEntity = inject<string | null>('mainEntity', null)

const resolvedEntity = computed(() => props.entity || mainEntity)

const manager = computed<EntityManager | null>(() => {
  if (!resolvedEntity.value) return null
  return orchestrator?.get(resolvedEntity.value) ?? null
})

const fieldValue = computed(() => {
  if (props.value === null || props.value === undefined) return ''
  return typeof props.value === 'boolean' ? String(props.value) : props.value
})

const descriptor = computed(() => {
  if (!manager.value?.getSeverityDescriptor) {
    return { severity: manager.value?.getSeverity?.(props.field, fieldValue.value as string | number, props.defaultSeverity) ?? props.defaultSeverity }
  }
  return manager.value.getSeverityDescriptor(props.field, fieldValue.value as string | number, props.defaultSeverity)
})

const severity = computed(() => descriptor.value.severity)

const displayLabel = computed(() => {
  return props.label ?? descriptor.value.label ?? props.value
})

const hasIcon = computed(() => !!descriptor.value.icon)
</script>

<template>
  <!-- Rich badge with icon -->
  <span v-if="hasIcon" class="p-tag p-component" :class="`p-tag-${severity}`">
    <i :class="descriptor.icon" />
    <span class="p-tag-label">{{ displayLabel }}</span>
  </span>
  <!-- Simple PrimeVue Tag -->
  <Tag v-else :value="displayLabel" :severity="severity" />
</template>
