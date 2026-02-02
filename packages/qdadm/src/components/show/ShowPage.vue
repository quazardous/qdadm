<script setup lang="ts">
/**
 * ShowPage - Unified show/detail page component
 *
 * Renders a complete read-only detail page with:
 * - PageHeader with title and action buttons
 * - Loading and error states
 * - Optional media zone (for images, avatars, flags)
 * - Field content via slots
 * - Action footer (edit, delete, back)
 *
 * Props come from useEntityItemShowPage composable:
 *
 * ```vue
 * const show = useEntityItemShowPage({ entity: 'books' })
 * show.generateFields()
 * show.addEditAction()
 * show.addBackAction()
 *
 * <ShowPage v-bind="show.props.value" v-on="show.events">
 *   <template #media>
 *     <img :src="show.data.value?.thumbnail" />
 *   </template>
 *   <template #fields>
 *     <ShowField v-for="f in show.fields.value" :key="f.name" :field="f" :value="show.data.value[f.name]" />
 *   </template>
 * </ShowPage>
 * ```
 *
 * Slots:
 * - #nav: PageNav for breadcrumb customization
 * - #toolbar: Custom toolbar actions (between header and content)
 * - #header-actions: Custom header action buttons
 * - #media: Media zone (image, avatar, flag) - renders in left column
 * - #fields: Field content (required) - renders in right column (or full width if no media)
 * - #footer: Custom footer (replaces ShowActions if provided)
 * - #error: Custom error display
 * - #loading: Custom loading display
 */
import { computed, type PropType } from 'vue'
import PageHeader from '../layout/PageHeader.vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ShowGroups from './ShowGroups.vue'

/**
 * Page title parts for PageHeader
 */
interface PageTitleParts {
  action: string
  entityName: string | undefined
  entityLabel: string | undefined
}

/**
 * Action configuration
 */
interface ResolvedAction {
  name: string
  label: string
  icon?: string
  severity?: string
  isLoading: boolean
  isDisabled: boolean
  onClick: () => void | Promise<void>
}

/**
 * Resolved field config
 */
interface ResolvedFieldConfig {
  name: string
  type: string
  label: string
  [key: string]: unknown
}

/**
 * Fetch error type
 */
interface FetchError {
  message?: string
  detail?: string
}

/**
 * Field group structure
 */
interface FieldGroup {
  name: string
  label: string
  fields: ResolvedFieldConfig[]
  children: FieldGroup[]
  parent?: string
}

/**
 * Layout mode for groups
 */
type LayoutMode = 'flat' | 'sections' | 'cards' | 'tabs' | 'accordion'

const props = defineProps({
  // State
  loading: { type: Boolean, default: false },

  // Title (use title OR titleParts)
  title: { type: String as PropType<string | null>, default: null },
  titleParts: { type: Object as PropType<PageTitleParts | null>, default: null },

  // Fields (for auto-rendering - optional, can use #fields slot instead)
  fields: { type: Array as PropType<ResolvedFieldConfig[]>, default: () => [] },

  // Groups (hierarchical field organization)
  groups: { type: Array as PropType<FieldGroup[]>, default: () => [] },

  // Data (entity data for field values)
  data: { type: Object as PropType<Record<string, unknown> | null>, default: null },

  // Actions (from builder.actions)
  actions: { type: Array as PropType<ResolvedAction[]>, default: () => [] },

  // Error for fetch failures
  fetchError: { type: [String, Object] as PropType<string | FetchError | null>, default: null },

  // UI options
  showActions: { type: Boolean, default: true },
  cardWrapper: { type: Boolean, default: true },
  horizontalFields: { type: Boolean, default: true },
  labelWidth: { type: String, default: '140px' },
  // Media zone options
  mediaWidth: { type: String, default: '200px' },

  // Group layout mode: flat, sections, cards, tabs, accordion
  layout: { type: String as PropType<LayoutMode>, default: 'flat' },

  // Child group layout mode (for nested groups)
  childLayout: { type: String as PropType<LayoutMode>, default: 'sections' }
})

// Check if media slot is used
const slots = defineSlots<{
  nav?: () => unknown
  toolbar?: () => unknown
  'header-actions'?: () => unknown
  media?: () => unknown
  fields?: () => unknown
  groups?: () => unknown
  footer?: () => unknown
  error?: (props: { error: unknown }) => unknown
  loading?: () => unknown
}>()

// Determine if we should use group rendering
const useGroupLayout = computed(() => {
  // Use groups if: layout is not flat, or groups are explicitly defined (not just _default)
  const hasRealGroups = props.groups.length > 0 && !(props.groups.length === 1 && props.groups[0]?.name === '_default')
  return hasRealGroups && props.layout !== 'flat'
})

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'back'): void
}>()

// Header actions: actions that go in the header (e.g., edit)
const headerActions = computed<ResolvedAction[]>(() =>
  props.actions.filter((a: ResolvedAction) => ['edit'].includes(a.name))
)

// Footer actions: actions that go in the footer (e.g., back, delete)
const footerActions = computed<ResolvedAction[]>(() =>
  props.actions.filter((a: ResolvedAction) => !['edit'].includes(a.name))
)

// Get error message from fetchError
const fetchErrorMessage = computed<string | null>(() => {
  if (!props.fetchError) return null
  if (typeof props.fetchError === 'string') return props.fetchError
  return props.fetchError.message || props.fetchError.detail || 'Failed to load entity'
})
</script>

<template>
  <div class="show-page">
    <!-- Nav slot for PageNav (child routes) -->
    <slot name="nav" />

    <PageHeader :title="title" :title-parts="titleParts">
      <template #actions>
        <slot name="header-actions" />
        <!-- Header actions from builder (e.g., edit) -->
        <Button
          v-for="action in headerActions"
          :key="action.name"
          :label="action.label"
          :icon="action.icon"
          :severity="(action.severity as any)"
          :loading="action.isLoading"
          :disabled="action.isDisabled"
          @click="action.onClick"
        />
      </template>
    </PageHeader>

    <!-- Toolbar slot (between header and content) -->
    <slot name="toolbar" />

    <!-- Loading State -->
    <template v-if="loading">
      <slot name="loading">
        <div class="loading-state">
          <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
        </div>
      </slot>
    </template>

    <!-- Error State (fetch error) -->
    <template v-else-if="fetchError">
      <slot name="error" :error="fetchError">
        <Message severity="error" :closable="false" class="show-error-message">
          {{ fetchErrorMessage }}
        </Message>
      </slot>
    </template>

    <!-- Content -->
    <template v-else>
      <!-- Card wrapper or direct content -->
      <Card v-if="cardWrapper">
        <template #content>
          <!-- Grid layout with optional media zone -->
          <div
            class="show-content"
            :class="{ 'show-content--with-media': slots.media }"
            :style="slots.media ? { '--media-width': mediaWidth } : {}"
          >
            <!-- Media zone (optional) -->
            <div v-if="slots.media" class="show-media">
              <slot name="media" />
            </div>

            <!-- Fields/Groups zone -->
            <div class="show-fields" :class="{ 'show-fields--horizontal': horizontalFields && !useGroupLayout }">
              <!-- Group layout mode -->
              <template v-if="useGroupLayout">
                <slot name="groups">
                  <ShowGroups
                    :groups="groups"
                    :data="data"
                    :layout="layout"
                    :child-layout="childLayout"
                    :horizontal="horizontalFields"
                    :label-width="labelWidth"
                  />
                </slot>
              </template>
              <!-- Flat fields mode (default) -->
              <template v-else>
                <slot name="fields" />
              </template>
            </div>
          </div>

          <!-- Footer Actions -->
          <template v-if="showActions && footerActions.length > 0">
            <slot name="footer">
              <div class="show-actions">
                <Button
                  v-for="action in footerActions"
                  :key="action.name"
                  :label="action.label"
                  :icon="action.icon"
                  :severity="(action.severity as any)"
                  :loading="action.isLoading"
                  :disabled="action.isDisabled"
                  @click="action.onClick"
                />
              </div>
            </slot>
          </template>
        </template>
      </Card>

      <template v-else>
        <!-- Grid layout with optional media zone -->
        <div
          class="show-content"
          :class="{ 'show-content--with-media': slots.media }"
          :style="slots.media ? { '--media-width': mediaWidth } : {}"
        >
          <!-- Media zone (optional) -->
          <div v-if="slots.media" class="show-media">
            <slot name="media" />
          </div>

          <!-- Fields/Groups zone -->
          <div class="show-fields" :class="{ 'show-fields--horizontal': horizontalFields && !useGroupLayout }">
            <!-- Group layout mode -->
            <template v-if="useGroupLayout">
              <slot name="groups">
                <ShowGroups
                  :groups="groups"
                  :data="data"
                  :layout="layout"
                  :child-layout="childLayout"
                  :horizontal="horizontalFields"
                  :label-width="labelWidth"
                />
              </slot>
            </template>
            <!-- Flat fields mode (default) -->
            <template v-else>
              <slot name="fields" />
            </template>
          </div>
        </div>

        <!-- Footer Actions -->
        <template v-if="showActions && footerActions.length > 0">
          <slot name="footer">
            <div class="show-actions">
              <Button
                v-for="action in footerActions"
                :key="action.name"
                :label="action.label"
                :icon="action.icon"
                :severity="(action.severity as any)"
                :loading="action.isLoading"
                :disabled="action.isDisabled"
                @click="action.onClick"
              />
            </div>
          </slot>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.show-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.show-error-message {
  margin: 1rem 0;
}

/* Content grid layout */
.show-content {
  display: block;
}

.show-content--with-media {
  display: grid;
  grid-template-columns: var(--media-width, 200px) 1fr;
  gap: 2rem;
}

@media (max-width: 768px) {
  .show-content--with-media {
    grid-template-columns: 1fr;
  }
}

/* Media zone */
.show-media {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* Fields zone */
.show-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.show-fields--horizontal :deep(.show-field) {
  flex-direction: row;
  align-items: flex-start;
  border-bottom: 1px solid var(--p-surface-200, #e2e8f0);
  padding-bottom: 0.75rem;
}

.show-fields--horizontal :deep(.show-field:last-child) {
  border-bottom: none;
}

.show-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--p-surface-200, #e2e8f0);
}
</style>
