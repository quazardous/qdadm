<script setup>
/**
 * FormPage - Unified form page component
 *
 * Renders a complete CRUD form page with:
 * - PageHeader with title and action buttons
 * - Loading and error states
 * - Form content via slots
 * - FormActions footer
 * - UnsavedChangesDialog integration
 *
 * Props come from useEntityItemFormPage composable:
 *
 * ```vue
 * const form = useEntityItemFormPage({ entity: 'books' })
 * form.generateFields()
 * form.addSaveAction()
 *
 * <FormPage v-bind="form.props.value" v-on="form.events">
 *   <template #fields>
 *     <FormField v-model="form.data.title" name="title" />
 *   </template>
 * </FormPage>
 * ```
 *
 * Slots:
 * - #nav: PageNav for breadcrumb customization
 * - #toolbar: Custom toolbar actions (between header and form)
 * - #header-actions: Custom header action buttons
 * - #fields: Form fields content (required)
 * - #footer: Custom footer (replaces FormActions if provided)
 * - #error: Custom error display
 * - #loading: Custom loading display
 */
import { computed } from 'vue'
import PageHeader from '../layout/PageHeader.vue'
import FormActions from './FormActions.vue'
import UnsavedChangesDialog from '../dialogs/UnsavedChangesDialog.vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Message from 'primevue/message'

const props = defineProps({
  // Mode
  isEdit: { type: Boolean, default: false },
  mode: { type: String, default: 'create' },

  // State
  loading: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  dirty: { type: Boolean, default: false },

  // Title (use title OR titleParts)
  title: { type: String, default: null },
  titleParts: { type: Object, default: null },

  // Fields (for auto-rendering - optional, can use #fields slot instead)
  fields: { type: Array, default: () => [] },

  // Actions (from builder.actions)
  actions: { type: Array, default: () => [] },

  // Validation state
  errors: { type: Object, default: () => ({}) },
  hasErrors: { type: Boolean, default: false },
  errorSummary: { type: Array, default: null },
  submitted: { type: Boolean, default: false },

  // Guard dialog (from useUnsavedChangesGuard)
  guardDialog: { type: Object, default: null },

  // Error for fetch failures (separate from validation errors)
  fetchError: { type: [String, Object], default: null },

  // UI options
  showFormActions: { type: Boolean, default: true },
  showSaveAndClose: { type: Boolean, default: true },
  cardWrapper: { type: Boolean, default: true }
})

const emit = defineEmits(['save', 'saveAndClose', 'cancel', 'delete'])

// Computed: has any action buttons to show
const hasActions = computed(() => props.actions.length > 0)

// Get action by name
function getAction(name) {
  return props.actions.find(a => a.name === name)
}

// Check if action exists and is visible
function hasAction(name) {
  return props.actions.some(a => a.name === name)
}

// Extract specific actions for FormActions component
const saveAction = computed(() => getAction('save'))
const deleteAction = computed(() => getAction('delete'))
const cancelAction = computed(() => getAction('cancel'))

// Header actions: all actions except save, delete, cancel (those go in footer)
const headerActions = computed(() =>
  props.actions.filter(a => !['save', 'delete', 'cancel'].includes(a.name))
)

// Get error message from fetchError
const fetchErrorMessage = computed(() => {
  if (!props.fetchError) return null
  if (typeof props.fetchError === 'string') return props.fetchError
  return props.fetchError.message || props.fetchError.detail || 'Failed to load entity'
})

// Guard dialog handlers
function onGuardSaveAndLeave() {
  if (props.guardDialog?.onSave) {
    props.guardDialog.onSave()
  }
}

function onGuardLeave() {
  if (props.guardDialog?.onLeave) {
    props.guardDialog.onLeave()
  }
}

function onGuardStay() {
  if (props.guardDialog?.onStay) {
    props.guardDialog.onStay()
  }
}
</script>

<template>
  <div class="form-page">
    <!-- Nav slot for PageNav (child routes) -->
    <slot name="nav" />

    <PageHeader :title="title" :title-parts="titleParts">
      <template #actions>
        <slot name="header-actions" />
        <!-- Header actions from builder (excludes save/delete/cancel) -->
        <Button
          v-for="action in headerActions"
          :key="action.name"
          :label="action.label"
          :icon="action.icon"
          :severity="action.severity"
          :loading="action.isLoading"
          :disabled="action.isDisabled"
          @click="action.onClick"
        />
      </template>
    </PageHeader>

    <!-- Toolbar slot (between header and form) -->
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
        <Message severity="error" :closable="false" class="form-error-message">
          {{ fetchErrorMessage }}
        </Message>
      </slot>
    </template>

    <!-- Form Content -->
    <template v-else>
      <!-- Validation Error Summary -->
      <Message
        v-if="errorSummary && errorSummary.length > 0"
        severity="warn"
        :closable="false"
        class="validation-summary"
      >
        <ul class="validation-errors">
          <li v-for="error in errorSummary" :key="error.field">
            <strong>{{ error.label }}:</strong> {{ error.message }}
          </li>
        </ul>
      </Message>

      <!-- Card wrapper or direct content -->
      <Card v-if="cardWrapper">
        <template #content>
          <slot name="fields" />

          <!-- Form Actions (in footer) -->
          <template v-if="showFormActions">
            <slot name="footer">
              <FormActions
                :isEdit="isEdit"
                :saving="saving"
                :dirty="dirty"
                :showSaveAndClose="showSaveAndClose"
                @save="emit('save')"
                @saveAndClose="emit('saveAndClose')"
                @cancel="emit('cancel')"
              />
            </slot>
          </template>
        </template>
      </Card>

      <template v-else>
        <slot name="fields" />

        <!-- Form Actions (in footer) -->
        <template v-if="showFormActions">
          <slot name="footer">
            <FormActions
              :isEdit="isEdit"
              :saving="saving"
              :dirty="dirty"
              :showSaveAndClose="showSaveAndClose"
              @save="emit('save')"
              @saveAndClose="emit('saveAndClose')"
              @cancel="emit('cancel')"
            />
          </slot>
        </template>
      </template>
    </template>

    <!-- Unsaved Changes Dialog -->
    <UnsavedChangesDialog
      v-if="guardDialog"
      :visible="guardDialog.visible.value"
      :saving="saving"
      :hasOnSave="!!guardDialog.onSave"
      @saveAndLeave="onGuardSaveAndLeave"
      @leave="onGuardLeave"
      @stay="onGuardStay"
    />
  </div>
</template>

<style scoped>
.form-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.form-error-message {
  margin: 1rem 0;
}

.validation-summary {
  margin-bottom: 1rem;
}

.validation-errors {
  margin: 0;
  padding-left: 1.5rem;
}

.validation-errors li {
  margin: 0.25rem 0;
}
</style>
