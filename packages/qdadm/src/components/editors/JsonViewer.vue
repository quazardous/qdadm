<script setup lang="ts">
/**
 * JsonViewer - Reusable JSON viewer component
 *
 * Simple formatted JSON display with syntax highlighting.
 *
 * Usage:
 * <JsonViewer :model-value="jsonData" height="300px" />
 */

import { computed } from 'vue'
import { highlightJson } from '../../composables/useJsonSyntax'

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null

interface Props {
  modelValue?: JsonValue
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  height: '300px'
})

// Parse value if string
const parsedValue = computed<JsonValue>(() => {
  if (typeof props.modelValue === 'string') {
    try {
      return JSON.parse(props.modelValue) as JsonValue
    } catch {
      return props.modelValue
    }
  }
  return props.modelValue
})

// Format JSON with syntax highlighting
const formattedJson = computed<string>(() => {
  if (parsedValue.value === null || parsedValue.value === undefined) {
    return '<span class="json-null">null</span>'
  }
  return highlightJson(JSON.stringify(parsedValue.value, null, 2))
})
</script>

<template>
  <div class="json-viewer" :style="{ maxHeight: height }">
    <pre class="json-content" v-html="formattedJson"></pre>
  </div>
</template>
