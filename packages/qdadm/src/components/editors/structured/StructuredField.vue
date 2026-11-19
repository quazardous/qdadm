<script setup lang="ts">
/**
 * StructuredField - a value edited through a structured face or as raw text (#5333)
 *
 * The default slot is the structured face (a form, chips, a picker); a toggle
 * opens the raw face of the same value, in JSON or YAML. Both bind the same
 * v-model.
 *
 *   <StructuredField v-model="scopes" format="yaml">
 *     <PermissionEditor v-model="scopes" :permissions="all" />
 *   </StructuredField>
 *
 * The raw faces are registered by the entries of their optional peers:
 * import '@quazardous/qdadm/editors/json' or '@quazardous/qdadm/editors/yaml'
 * once in the app.
 *
 * Props:
 * - modelValue: the value
 * - rawValue / update:rawValue: a separate binding for the raw face, when its shape differs
 * - format: 'json' (default) or 'yaml'
 * - mode / update:mode: 'structured' or 'raw', controlled
 * - defaultMode: the first face (default 'structured')
 * - rawHeight: the raw editor's height (default 400px)
 * - rawOptions: the format's own options (JSON: { mode: 'text' | 'tree' | 'table' })
 * - label, showToggle
 * - guardInvalid: stay on the raw face while its text is invalid (default true)
 * - invalidMessage: the message then shown (default from the catalogue)
 *
 * Events: update:modelValue, update:rawValue, update:mode, invalid (true / false)
 */
import { ref, computed, watch } from 'vue'
import SelectButton from 'primevue/selectbutton'
import QdMessage from '../../base/QdMessage.vue'
import { useI18n } from '../../../i18n/useI18n'
import { getStructuredFace, type StructuredFormat } from './faces'

export type StructuredViewMode = 'structured' | 'raw'

interface Props {
  modelValue?: unknown
  rawValue?: unknown
  format?: StructuredFormat
  mode?: StructuredViewMode | null
  defaultMode?: StructuredViewMode
  rawHeight?: string
  rawOptions?: Record<string, unknown>
  label?: string | null
  showToggle?: boolean
  guardInvalid?: boolean
  invalidMessage?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  rawValue: undefined,
  format: 'json',
  mode: null,
  defaultMode: 'structured',
  rawHeight: '400px',
  rawOptions: () => ({}),
  label: null,
  showToggle: true,
  guardInvalid: true,
  invalidMessage: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  'update:rawValue': [value: unknown]
  'update:mode': [value: StructuredViewMode]
  invalid: [invalid: boolean]
}>()

const { tOr } = useI18n()

const face = computed(() => getStructuredFace(props.format))
const internalMode = ref<StructuredViewMode>(props.defaultMode)
const invalid = ref(false)

const viewMode = computed<StructuredViewMode>({
  get: () => props.mode ?? internalMode.value,
  set: (next) => {
    // Leaving the raw face with an invalid text would drop what the user typed
    if (props.guardInvalid && invalid.value && viewMode.value === 'raw' && next === 'structured') return
    if (props.mode !== null) emit('update:mode', next)
    else internalMode.value = next
  },
})

watch(
  () => props.mode,
  (next) => {
    if (next) internalMode.value = next
  }
)

const formatLabel = computed(() => (props.format === 'yaml' ? 'YAML' : 'JSON'))
const options = computed(() => [
  { label: tOr('core.structuredField.structured', 'Structured'), value: 'structured' as const, icon: 'pi pi-list' },
  { label: formatLabel.value, value: 'raw' as const, icon: 'pi pi-code' },
])
const message = computed(
  () => props.invalidMessage ?? tOr('core.structuredField.invalid', 'Invalid {format}: fix it before switching views', { format: formatLabel.value })
)

const separateRaw = computed(() => props.rawValue !== undefined)
const rawModel = computed(() => (separateRaw.value ? props.rawValue : props.modelValue))

function onRaw(value: unknown): void {
  if (separateRaw.value) emit('update:rawValue', value)
  else emit('update:modelValue', value)
}

function onInvalid(next: boolean): void {
  if (invalid.value === next) return
  invalid.value = next
  emit('invalid', next)
}

defineExpose({ viewMode, invalid })
</script>

<template>
  <div class="structured-field" :data-format="format">
    <div v-if="showToggle || label" class="field-header">
      <label v-if="label" class="field-label">{{ label }}</label>
      <SelectButton
        v-if="showToggle"
        v-model="viewMode"
        :options="options"
        optionLabel="label"
        optionValue="value"
        :allowEmpty="false"
        class="mode-toggle"
      >
        <template #option="{ option }">
          <i :class="option.icon"></i>
          <span class="toggle-label">{{ option.label }}</span>
        </template>
      </SelectButton>
    </div>

    <div v-if="viewMode === 'raw'" class="raw-view">
      <QdMessage v-if="guardInvalid && invalid" severity="error" :closable="false" class="raw-error">
        {{ message }}
      </QdMessage>
      <component
        :is="face"
        v-if="face"
        :modelValue="rawModel"
        :height="rawHeight"
        :options="rawOptions"
        @update:modelValue="onRaw"
        @invalid="onInvalid"
      />
    </div>

    <div v-else class="structured-view">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.structured-field {
  width: 100%;
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.field-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.mode-toggle {
  flex-shrink: 0;
}

.mode-toggle :deep(.p-button) {
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
}

.mode-toggle :deep(.p-button i) {
  font-size: 0.75rem;
  margin-right: 0.25rem;
}

.toggle-label {
  display: none;
}

@media (min-width: 640px) {
  .toggle-label {
    display: inline;
  }
}

.raw-view {
  margin-top: 0.25rem;
}

.raw-error {
  margin-bottom: 0.5rem;
}
</style>
