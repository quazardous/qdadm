<script setup>
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

const props = defineProps({
  modelValue: {
    type: [Object, Array, String, null],
    default: () => ({})
  },
  height: {
    type: String,
    default: '300px'
  }
})

// Parse value if string
const parsedValue = computed(() => {
  if (typeof props.modelValue === 'string') {
    try {
      return JSON.parse(props.modelValue)
    } catch {
      return props.modelValue
    }
  }
  return props.modelValue
})

// Format JSON with syntax highlighting
const formattedJson = computed(() => {
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

<style scoped>
.json-viewer {
  background: var(--p-surface-50);
  border: 1px solid var(--p-surface-200);
  border-radius: 0.375rem;
  overflow: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.json-content {
  padding: 1rem;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

:deep(.json-key) {
  color: #881391;
}

:deep(.json-string) {
  color: #1a1aa6;
}

:deep(.json-number) {
  color: #1c00cf;
}

:deep(.json-boolean) {
  color: #0d22aa;
  font-weight: 500;
}

:deep(.json-null) {
  color: #808080;
  font-style: italic;
}
</style>
