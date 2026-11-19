<script setup lang="ts">
/**
 * The YAML face of StructuredField (#5333), on VanillaYamlEditor's text view.
 * Registered by '@quazardous/qdadm/editors/yaml'.
 *
 * The value is written as YAML when it changes from outside, and read back
 * from each valid text: comments typed in the text do not survive a trip
 * through the structured face, which knows only the value.
 */
import { ref, watch } from 'vue'
import { parseYaml } from '@quazardous/vanilla-yamleditor'
import VanillaYamlEditor from '../yaml/VanillaYamlEditor.vue'

const props = withDefaults(
  defineProps<{
    modelValue?: unknown
    height?: string
    options?: Record<string, unknown>
  }>(),
  { height: '400px', options: () => ({}) }
)

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  invalid: [invalid: boolean]
}>()

/** A value as YAML text, through the peer's own YAML document */
function toYaml(value: unknown): string {
  if (value === null || value === undefined) return ''
  const { doc } = parseYaml('')
  doc.contents = doc.createNode(value) as typeof doc.contents
  return String(doc)
}

const text = ref(toYaml(props.modelValue))
// The value this face last sent up, so its echo does not rewrite the text
let sent: unknown = Symbol('none')

watch(
  () => props.modelValue,
  (value) => {
    if (value === sent) return
    text.value = toYaml(value)
  },
  { deep: true }
)

function onText(next: string): void {
  text.value = next
  const parsed = parseYaml(next)
  if (parsed.errors.length) {
    emit('invalid', true)
    return
  }
  emit('invalid', false)
  sent = parsed.value ?? null
  emit('update:modelValue', sent)
}
</script>

<template>
  <VanillaYamlEditor
    :modelValue="text"
    :modes="['text']"
    :modeSwitch="false"
    :height="height"
    @update:modelValue="onText"
  />
</template>
