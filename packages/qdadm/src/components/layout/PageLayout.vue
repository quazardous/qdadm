<script setup lang="ts">
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

interface TitleParts {
  action?: string
  entityName?: string
  entityLabel?: string
}

interface HeaderAction {
  name: string
  label: string | (() => string)
  icon?: string
  severity?: string
  isLoading?: boolean
  onClick: () => void
}

type Severity = 'success' | 'danger' | 'warning' | 'info'

interface Card {
  name: string
  value?: string | number
  label?: string
  severity?: Severity
  icon?: string
  custom?: boolean
  class?: string
  onClick?: () => void
}

interface Props {
  /** Page title (use title OR titleParts) */
  title?: string
  /** Title parts for decorated entity label */
  titleParts?: TitleParts
  /** Page subtitle */
  subtitle?: string
  /** Header action buttons */
  headerActions?: HeaderAction[]
  /** Cards configuration */
  cards?: Card[]
  /** Number of card columns or 'auto' */
  cardsColumns?: number | 'auto'
}

withDefaults(defineProps<Props>(), {
  headerActions: () => [],
  cards: () => [],
  cardsColumns: 'auto'
})

function resolveLabel(label: string | (() => string)): string {
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
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
.page-subtitle {
  color: var(--p-surface-500);
  font-size: 0.9rem;
  margin-left: 1rem;
}
</style>
