<script setup lang="ts">
/**
 * JsonStructuredField - StructuredField with a JSON raw face (#5333)
 *
 * The structured face is the slot; a toggle opens the same value as JSON.
 *
 *   <JsonStructuredField v-model="myData">
 *     <MyStructuredEditor v-model="myData" />
 *   </JsonStructuredField>
 *
 * Its props are StructuredField's under their JSON names: jsonValue
 * (rawValue), mode 'json' (raw), jsonHeight, jsonMode ('text' | 'tree' |
 * 'table'), guardInvalidJson, invalidJsonMessage; `json-error` is `invalid`.
 * For YAML, use StructuredField with format="yaml".
 */
import { computed } from 'vue'
import StructuredField from './structured/StructuredField.vue'
import './structured/registerJson'
import type { Mode } from 'vanilla-jsoneditor'

type JsonValue = Record<string, unknown> | unknown[] | string | null
type ViewMode = 'structured' | 'json'

interface Props {
  modelValue?: JsonValue
  jsonValue?: JsonValue | null
  mode?: ViewMode | null
  label?: string | null
  jsonHeight?: string
  jsonMode?: Mode | 'tree' | 'text' | 'table'
  defaultMode?: ViewMode
  showToggle?: boolean
  guardInvalidJson?: boolean
  invalidJsonMessage?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  jsonValue: null,
  mode: null,
  label: null,
  jsonHeight: '400px',
  jsonMode: 'text',
  defaultMode: 'structured',
  showToggle: true,
  guardInvalidJson: true,
  invalidJsonMessage: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: JsonValue]
  'update:jsonValue': [value: JsonValue]
  'update:mode': [value: ViewMode]
  'json-error': [hasError: boolean]
}>()

const toRaw = (m: ViewMode | null) => (m === null ? null : m === 'json' ? 'raw' : 'structured')
const rawOptions = computed(() => ({ mode: props.jsonMode }))
</script>

<template>
  <StructuredField
    class="json-structured-field"
    format="json"
    :modelValue="modelValue"
    :rawValue="jsonValue !== null ? jsonValue : undefined"
    :mode="toRaw(mode)"
    :defaultMode="toRaw(defaultMode)!"
    :label="label"
    :rawHeight="jsonHeight"
    :rawOptions="rawOptions"
    :showToggle="showToggle"
    :guardInvalid="guardInvalidJson"
    :invalidMessage="invalidJsonMessage"
    @update:modelValue="emit('update:modelValue', $event as JsonValue)"
    @update:rawValue="emit('update:jsonValue', $event as JsonValue)"
    @update:mode="emit('update:mode', $event === 'raw' ? 'json' : 'structured')"
    @invalid="emit('json-error', $event)"
  >
    <slot></slot>
  </StructuredField>
</template>
