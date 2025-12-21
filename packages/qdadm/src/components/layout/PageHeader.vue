<script setup>
/**
 * PageHeader - Reusable page header with title and actions
 *
 * Props:
 * - title: Page title (simple string) OR
 * - titleParts: { action, entityName, entityLabel } for decorated rendering
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
 * Note: Breadcrumb is handled globally by AppLayout.
 */
import { computed, inject } from 'vue'

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
</script>

<template>
  <div class="page-header">
    <div class="page-header-content">
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
  min-height: 2.5rem; /* Consistent height with or without action buttons */
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
