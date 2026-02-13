<script setup lang="ts">
/**
 * PageHeader - Reusable page header with title and actions
 *
 * Props:
 * - title: Page title (simple string) OR
 * - titleParts: { action, entityName, entityLabel } for decorated rendering
 * - badges: Custom badges from entity manager [{ label, severity }]
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
import { computed, inject, type Ref } from 'vue'
import Tag from 'primevue/tag'

interface TitleParts {
  simple?: string
  action?: string
  entityName?: string
  entityLabel?: string
}

interface BadgeConfig {
  label: string
  severity?: string
}

interface Props {
  title?: string | null
  titleParts?: TitleParts | null
  subtitle?: string | null
  badges?: BadgeConfig[]
}

const props = withDefaults(defineProps<Props>(), {
  title: null,
  titleParts: null,
  subtitle: null,
  badges: () => []
})

// Auto-injected title from useForm (if available)
const injectedTitleParts = inject<Ref<TitleParts | null> | null>('qdadmPageTitleParts', null)

// Use props first, then injected, then fallback
const effectiveTitleParts = computed((): TitleParts | null => {
  return props.titleParts || injectedTitleParts?.value || null
})

// Simple title from usePageTitle('My Title')
const simpleTitle = computed((): string | undefined => effectiveTitleParts.value?.simple)

// Compute title display
const hasDecoratedTitle = computed((): boolean => {
  return !!effectiveTitleParts.value?.entityLabel
})
</script>

<template>
  <div class="page-header">
    <div class="page-header-content">
      <div class="page-header-row">
        <div class="page-header-left">
          <div>
            <h1 class="page-title">
              <template v-if="simpleTitle">{{ simpleTitle }}</template>
              <template v-else-if="effectiveTitleParts">
                <span v-if="hasDecoratedTitle" class="entity-label">{{ effectiveTitleParts.entityLabel }}</span>
                <span v-else>{{ effectiveTitleParts.action }} {{ effectiveTitleParts.entityName }}</span>
              </template>
              <Tag
                v-for="badge in badges"
                :key="badge.label"
                :value="badge.label"
                :severity="(badge.severity as any) || 'secondary'"
                class="entity-badge"
              />
              <template v-if="!effectiveTitleParts && !simpleTitle">{{ title }}</template>
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
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
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

/* Action badge (View Bot / Edit Country) - small grey badge, before title */
.action-badge {
  display: inline-block;
  font-size: 0.5em;
  font-weight: 600;
  background: var(--p-surface-200);
  color: var(--p-surface-600);
  padding: 0.25em 0.6em;
  border-radius: 4px;
  margin-right: 0.5em;
  vertical-align: middle;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Entity badges from manager callback */
.entity-badge {
  vertical-align: middle;
  margin-left: 0.4em;
  font-size: 0.5em;
}

/* Entity label in title - main focus */
.entity-label {
  font-weight: 600;
}
</style>
