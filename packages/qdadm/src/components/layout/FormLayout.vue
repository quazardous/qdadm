<script setup>
/**
 * FormLayout - Second level of the 3-level layout inheritance chain
 *
 * Extends BaseLayout by providing content to the `main` zone, and defines
 * form-specific zones within that main area:
 * - form-header: Title, back button, status indicators
 * - form-fields: Main form fields area
 * - form-tabs: Optional tabbed sections
 * - actions: Save, cancel, delete buttons
 *
 * Inheritance pattern (Twig-style):
 *   BaseLayout renders all standard zones (header, menu, footer, main...)
 *   -> FormLayout fills the main zone with form structure
 *   -> Entity pages (BooksEditPage.vue) fill form zones with entity fields
 *
 * Usage:
 * <FormLayout>
 *   <template #form-fields>
 *     <FormField v-model="data.title" name="title" />
 *   </template>
 *   <template #actions>
 *     <Button @click="save">Save</Button>
 *   </template>
 * </FormLayout>
 *
 * Or using Zone API for extension points:
 * <FormLayout />  <!-- Renders zones from registry -->
 */
import { useSlots, provide, computed } from 'vue'
import BaseLayout from './BaseLayout.vue'
import Zone from './Zone.vue'
import { FORM_ZONES } from '../../zones/zones'

// Default components for form zones
import DefaultFormActions from './defaults/DefaultFormActions.vue'

const props = defineProps({
  /**
   * Form loading state (displays spinner instead of fields)
   */
  loading: {
    type: Boolean,
    default: false
  },
  /**
   * Form saving state (passed to actions)
   */
  saving: {
    type: Boolean,
    default: false
  },
  /**
   * Form has unsaved changes (passed to actions)
   */
  dirty: {
    type: Boolean,
    default: false
  },
  /**
   * Edit mode (changes action button labels)
   */
  isEdit: {
    type: Boolean,
    default: false
  },
  /**
   * Whether to wrap form in a card component
   */
  cardWrapper: {
    type: Boolean,
    default: true
  },
  /**
   * Whether to show the actions zone
   */
  showActions: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['save', 'saveAndClose', 'cancel', 'delete'])

const slots = useSlots()

// Check which slots are provided by the parent
const hasFormHeaderSlot = computed(() => !!slots['form-header'])
const hasFormFieldsSlot = computed(() => !!slots['form-fields'])
const hasFormTabsSlot = computed(() => !!slots['form-tabs'])
const hasActionsSlot = computed(() => !!slots.actions)

// Provide form state to child zones (DefaultFormActions needs these)
provide('qdadmFormState', computed(() => ({
  loading: props.loading,
  saving: props.saving,
  dirty: props.dirty,
  isEdit: props.isEdit
})))

// Provide form events for child zones to emit
provide('qdadmFormEmit', {
  save: () => emit('save'),
  saveAndClose: () => emit('saveAndClose'),
  cancel: () => emit('cancel'),
  delete: () => emit('delete')
})
</script>

<template>
  <BaseLayout>
    <template #main>
      <div class="form-layout" :class="{ loading }">
        <!-- Form Header Zone: title, back button, status indicators -->
        <div class="form-header-zone">
          <Zone :name="FORM_ZONES.FORM_HEADER">
            <template v-if="hasFormHeaderSlot">
              <slot name="form-header" />
            </template>
          </Zone>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="form-loading-state">
          <i class="pi pi-spin pi-spinner loading-spinner"></i>
        </div>

        <!-- Form Content -->
        <template v-else>
          <!-- Card wrapper or direct content -->
          <div v-if="cardWrapper" class="form-card">
            <!-- Form Fields Zone: main form fields area -->
            <div class="form-fields-zone">
              <Zone :name="FORM_ZONES.FORM_FIELDS">
                <template v-if="hasFormFieldsSlot">
                  <slot name="form-fields" />
                </template>
              </Zone>
            </div>

            <!-- Form Tabs Zone: optional tabbed sections -->
            <div v-if="hasFormTabsSlot" class="form-tabs-zone">
              <Zone :name="FORM_ZONES.FORM_TABS">
                <slot name="form-tabs" />
              </Zone>
            </div>

            <!-- Actions Zone: save, cancel, delete buttons -->
            <div v-if="showActions" class="form-actions-zone">
              <!-- Slot override takes priority over Zone -->
              <template v-if="hasActionsSlot">
                <slot name="actions" />
              </template>
              <!-- Otherwise use Zone with default component -->
              <Zone
                v-else
                :name="FORM_ZONES.ACTIONS"
                :default-component="DefaultFormActions"
              />
            </div>
          </div>

          <!-- Without card wrapper -->
          <template v-else>
            <!-- Form Fields Zone -->
            <div class="form-fields-zone">
              <Zone :name="FORM_ZONES.FORM_FIELDS">
                <template v-if="hasFormFieldsSlot">
                  <slot name="form-fields" />
                </template>
              </Zone>
            </div>

            <!-- Form Tabs Zone -->
            <div v-if="hasFormTabsSlot" class="form-tabs-zone">
              <Zone :name="FORM_ZONES.FORM_TABS">
                <slot name="form-tabs" />
              </Zone>
            </div>

            <!-- Actions Zone -->
            <div v-if="showActions" class="form-actions-zone">
              <!-- Slot override takes priority over Zone -->
              <template v-if="hasActionsSlot">
                <slot name="actions" />
              </template>
              <!-- Otherwise use Zone with default component -->
              <Zone
                v-else
                :name="FORM_ZONES.ACTIONS"
                :default-component="DefaultFormActions"
              />
            </div>
          </template>
        </template>
      </div>
    </template>
  </BaseLayout>
</template>

<style scoped>
.form-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-layout.loading {
  min-height: 300px;
}

.form-loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem;
  flex: 1;
}

.loading-spinner {
  font-size: 2rem;
  color: var(--p-primary-500);
}

.form-card {
  background: var(--p-surface-0);
  border-radius: var(--p-border-radius);
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.form-header-zone {
  /* Form header inherits page header styles */
}

.form-fields-zone {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-tabs-zone {
  margin-top: 1rem;
}

.form-actions-zone {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--p-surface-200);
}

/* Dark mode support */
.dark-mode .form-card {
  background: var(--p-surface-800);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.dark-mode .form-actions-zone {
  border-top-color: var(--p-surface-700);
}
</style>
