<script setup>
/**
 * PageHeader - Reusable page header with breadcrumb, title and actions
 *
 * Props:
 * - title: Page title (simple string) OR
 * - titleParts: { action, entityName, entityLabel } for decorated rendering
 * - breadcrumb: Array of { label, to?, icon? } - optional breadcrumb items
 *
 * Title rendering:
 * - Simple: "Edit Agent" → <h1>Edit Agent</h1>
 * - Decorated: { action: 'Edit', entityName: 'Agent', entityLabel: 'David' }
 *   → <h1>Edit Agent: <span class="entity-label">David</span></h1>
 *
 * Slots:
 * - subtitle: Optional content next to title
 * - actions: Action buttons on the right
 *
 * Note: When features.breadcrumb is enabled in AppLayout, the layout handles
 * breadcrumb rendering globally. PageHeader only renders its own breadcrumb
 * when the global feature is disabled.
 */
import { computed, inject } from 'vue'
import Breadcrumb from './Breadcrumb.vue'

const features = inject('qdadmFeatures', { breadcrumb: false })

// Auto-injected title from useForm (if available)
const injectedTitleParts = inject('qdadmPageTitleParts', null)

const props = defineProps({
  title: {
    type: String,
    default: null
  },
  titleParts: {
    type: Object,
    default: null
  },
  subtitle: {
    type: String,
    default: null
  },
  breadcrumb: {
    type: Array,
    default: null
  }
})

// Use props first, then injected, then fallback
const effectiveTitleParts = computed(() => {
  return props.titleParts || injectedTitleParts?.value || null
})

// Compute title display
const hasDecoratedTitle = computed(() => {
  return effectiveTitleParts.value?.entityLabel
})

const titleBase = computed(() => {
  if (effectiveTitleParts.value) {
    return `${effectiveTitleParts.value.action} ${effectiveTitleParts.value.entityName}`
  }
  return props.title
})

// Only show PageHeader breadcrumb if global breadcrumb feature is disabled
const showBreadcrumb = computed(() => {
  return props.breadcrumb?.length && !features.breadcrumb
})
</script>

<template>
  <div class="page-header">
    <div class="page-header-content">
      <Breadcrumb v-if="showBreadcrumb" :items="breadcrumb" />
      <div class="page-header-row">
        <div class="page-header-left">
          <div>
            <h1 class="page-title">
              <template v-if="hasDecoratedTitle"><span class="entity-label">{{ effectiveTitleParts.entityLabel }}</span></template>
              <span v-if="effectiveTitleParts" class="action-badge">{{ effectiveTitleParts.action }} {{ effectiveTitleParts.entityName }}</span>
              <template v-if="!effectiveTitleParts">{{ title }}</template>
            </h1>
            <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
          </div>
          <slot name="subtitle" ></slot>
        </div>
        <div class="header-actions">
          <slot name="actions" ></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.page-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.page-subtitle {
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
  color: var(--p-text-secondary);
}

/* Action badge (Edit User / Create Role) - small grey badge */
.action-badge {
  display: inline-block;
  font-size: 0.5em;
  font-weight: 600;
  background: var(--p-surface-200);
  color: var(--p-surface-600);
  padding: 0.25em 0.6em;
  border-radius: 4px;
  margin-left: 0.5em;
  vertical-align: middle;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Entity label in title - main focus */
.entity-label {
  font-weight: 600;
}
</style>
