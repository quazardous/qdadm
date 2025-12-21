<script setup>
/**
 * PageLayout - Base layout for dashboard pages
 *
 * Provides:
 * - PageHeader with title and actions
 * - CardsGrid zone (optional)
 * - Main content slot
 *
 * Slots:
 * - #nav: For PageNav component (provides breadcrumb data to AppLayout)
 * - #header-actions: Custom header action buttons
 * - default: Main content
 *
 * Note: Breadcrumb is handled globally by AppLayout.
 * Use PageNav in #nav slot to customize breadcrumb for child routes.
 */
import PageHeader from './PageHeader.vue'
import CardsGrid from '../display/CardsGrid.vue'
import Button from 'primevue/button'

const props = defineProps({
  // Header - use title OR titleParts (for decorated entity label)
  title: { type: String, default: null },
  titleParts: { type: Object, default: null },  // { action, entityName, entityLabel }
  subtitle: { type: String, default: null },
  headerActions: { type: Array, default: () => [] },

  // Cards
  cards: { type: Array, default: () => [] },
  cardsColumns: { type: [Number, String], default: 'auto' }
})

function resolveLabel(label) {
  return typeof label === 'function' ? label() : label
}
</script>

<template>
  <div>
    <!-- Nav slot for PageNav (provides data to AppLayout, renders nothing visible) -->
    <slot name="nav" />

    <PageHeader
      :title="title"
      :title-parts="titleParts"
    >
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
