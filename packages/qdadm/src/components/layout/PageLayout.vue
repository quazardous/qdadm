<script setup>
/**
 * PageLayout - Base layout for dashboard pages
 *
 * Provides:
 * - Auto-generated breadcrumb
 * - PageHeader with title and actions
 * - CardsGrid zone (optional)
 * - Main content slot
 *
 * Use this for custom pages that don't follow the standard list pattern.
 * For CRUD list pages, use ListPage instead.
 *
 * Note: UnsavedChangesDialog is rendered automatically by AppLayout
 * via provide/inject from useBareForm/useForm.
 */
import { toRef } from 'vue'
import PageHeader from './PageHeader.vue'
import CardsGrid from '../display/CardsGrid.vue'
import Button from 'primevue/button'
import { useBreadcrumb } from '../../composables/useBreadcrumb'

const props = defineProps({
  // Header - use title OR titleParts (for decorated entity label)
  title: { type: String, default: null },
  titleParts: { type: Object, default: null },  // { action, entityName, entityLabel }
  subtitle: { type: String, default: null },
  headerActions: { type: Array, default: () => [] },
  breadcrumb: { type: Array, default: null },  // Override auto breadcrumb

  // Entity data for dynamic breadcrumb labels
  entity: { type: Object, default: null },
  manager: { type: Object, default: null },  // EntityManager - provides labelField automatically

  // Cards
  cards: { type: Array, default: () => [] },
  cardsColumns: { type: [Number, String], default: 'auto' }
})

// Auto-generate breadcrumb from route, using entity data for labels
// getEntityLabel from manager handles both string field and callback
const { breadcrumbItems } = useBreadcrumb({
  entity: toRef(() => props.entity),  // Make reactive
  getEntityLabel: props.manager
    ? (e) => props.manager.getEntityLabel(e)
    : (e) => e?.name || null  // Fallback if no manager
})

function resolveLabel(label) {
  return typeof label === 'function' ? label() : label
}
</script>

<template>
  <div>
    <PageHeader :title="title" :title-parts="titleParts" :breadcrumb="props.breadcrumb || breadcrumbItems">
      <template #subtitle>
        <slot name="subtitle">
          <span v-if="subtitle" class="page-subtitle">{{ subtitle }}</span>
        </slot>
      </template>
      <template #actions>
        <slot name="header-actions" ></slot>
        <Button
          v-for="action in headerActions"
          :key="action.name"
          :label="resolveLabel(action.label)"
          :icon="action.icon"
          :severity="action.severity"
          :loading="action.isLoading"
          @click="action.onClick"
        />
      </template>
    </PageHeader>

    <!-- Cards Zone -->
    <CardsGrid v-if="cards.length > 0" :cards="cards" :columns="cardsColumns">
      <template v-for="(_, slotName) in $slots" :key="slotName" #[slotName]="slotProps">
        <slot :name="slotName" v-bind="slotProps" ></slot>
      </template>
    </CardsGrid>

    <!-- Main Content -->
    <slot ></slot>
  </div>
</template>

<style scoped>
.page-subtitle {
  color: var(--p-surface-500);
  font-size: 0.9rem;
  margin-left: 1rem;
}
</style>
