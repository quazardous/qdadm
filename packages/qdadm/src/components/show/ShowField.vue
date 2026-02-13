<script setup lang="ts">
/**
 * ShowField - Display field wrapper with label
 *
 * Provides consistent styling for field display in ShowPage.
 * Mirrors FormField but for read-only display.
 *
 * Usage:
 * <ShowField :name="f.name" :label="f.label">
 *   <ShowDisplay :field="f" :value="data[f.name]" />
 * </ShowField>
 *
 * Or with auto-display:
 * <ShowField :field="f" :value="data[f.name]" />
 */
import { computed, type PropType } from 'vue'
import ShowDisplay from './ShowDisplay.vue'

interface FieldConfig {
  name: string
  type?: string
  label?: string
  [key: string]: unknown
}

const props = defineProps({
  // Field config (for auto-display mode)
  field: { type: Object as PropType<FieldConfig | null>, default: null },
  // Value (for auto-display mode)
  value: { type: [String, Number, Boolean, Date, Object, Array], default: null },
  // Manual props (override field config)
  name: { type: String, default: '' },
  label: { type: String, default: '' },
  // Layout options
  horizontal: { type: Boolean, default: false },
  labelWidth: { type: String, default: '120px' }
})

// Resolved name
const fieldName = computed(() => props.name || props.field?.name || '')

// Resolved label
const fieldLabel = computed(() => props.label || props.field?.label || fieldName.value)

// Auto-display mode (when field + value provided, no slot content)
const autoDisplay = computed(() => props.field !== null)
</script>

<template>
  <div
    class="show-field"
    :class="{
      'show-field--horizontal': horizontal
    }"
  >
    <label class="show-field__label" :style="horizontal ? { minWidth: labelWidth } : {}">
      {{ fieldLabel }}
    </label>
    <div class="show-field__value">
      <!-- Slot for custom content -->
      <slot>
        <!-- Auto-display when field is provided -->
        <ShowDisplay v-if="autoDisplay" :field="(field as any)" :value="(value as any)" />
      </slot>
    </div>
  </div>
</template>
