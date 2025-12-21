<script setup>
/**
 * VanillaJsonEditor - JSON editor using vanilla-jsoneditor
 *
 * Provides tree/text/table modes like jsoneditoronline.org
 *
 * Usage:
 * <VanillaJsonEditor v-model="jsonData" mode="tree" />
 */

import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { JSONEditor } from 'vanilla-jsoneditor'

const props = defineProps({
  modelValue: {
    type: [Object, Array, String, null],
    default: () => ({})
  },
  mode: {
    type: String,
    default: 'tree', // 'tree', 'text', 'table'
    validator: (v) => ['tree', 'text', 'table'].includes(v)
  },
  height: {
    type: String,
    default: '400px'
  },
  readOnly: {
    type: Boolean,
    default: false
  },
  mainMenuBar: {
    type: Boolean,
    default: true
  },
  navigationBar: {
    type: Boolean,
    default: true
  },
  statusBar: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'change', 'error'])

const containerRef = ref(null)
let editor = null
// Flag to prevent onChange from firing during programmatic updates (instance-specific)
const updatingFromProp = ref(false)

// Parse value to ensure it's an object/array
function parseValue(val) {
  if (val === null || val === undefined) {
    return {}
  }
  if (typeof val === 'string') {
    try {
      return JSON.parse(val)
    } catch {
      return {}
    }
  }
  return val
}

// Initialize editor
onMounted(() => {
  if (!containerRef.value) return

  const content = {
    json: parseValue(props.modelValue)
  }

  editor = new JSONEditor({
    target: containerRef.value,
    props: {
      content,
      mode: props.mode,
      readOnly: props.readOnly,
      mainMenuBar: props.mainMenuBar,
      navigationBar: props.navigationBar,
      statusBar: props.statusBar,
      onChange: (updatedContent, previousContent, { contentErrors, patchResult: _patchResult }) => {
        // Skip if this change came from a programmatic prop update
        if (updatingFromProp.value) return

        if (contentErrors) {
          emit('error', contentErrors)
          return
        }

        // Extract JSON from content
        let newValue
        if (updatedContent.json !== undefined) {
          newValue = updatedContent.json
        } else if (updatedContent.text !== undefined) {
          try {
            newValue = JSON.parse(updatedContent.text)
          } catch {
            // Invalid JSON in text mode, don't emit
            return
          }
        }

        if (newValue !== undefined) {
          emit('update:modelValue', newValue)
          emit('change', newValue)
        }
      }
    }
  })
})

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  if (!editor) return

  const currentContent = editor.get()
  const newParsed = parseValue(newVal)

  // Only update if different (avoid loops)
  const currentJson = currentContent.json !== undefined
    ? currentContent.json
    : (currentContent.text ? JSON.parse(currentContent.text) : null)

  if (JSON.stringify(currentJson) !== JSON.stringify(newParsed)) {
    // Set flag to prevent onChange from emitting during this update
    updatingFromProp.value = true
    editor.set({ json: newParsed })
    // Reset flag after the update is processed
    nextTick(() => {
      updatingFromProp.value = false
    })
  }
}, { deep: true })

// Watch mode changes
watch(() => props.mode, (newMode) => {
  if (editor) {
    editor.updateProps({ mode: newMode })
  }
})

// Watch readOnly changes
watch(() => props.readOnly, (newReadOnly) => {
  if (editor) {
    editor.updateProps({ readOnly: newReadOnly })
  }
})

// Cleanup
onUnmounted(() => {
  if (editor) {
    editor.destroy()
    editor = null
  }
})
</script>

<template>
  <div class="vanilla-json-editor" :style="{ height }">
    <div ref="containerRef" class="editor-container"></div>
  </div>
</template>

<style scoped>
.vanilla-json-editor {
  width: 100%;
  border: 1px solid var(--p-surface-300);
  border-radius: 0.375rem;
  overflow: hidden;
}

.editor-container {
  height: 100%;
}

/* Override some vanilla-jsoneditor styles for dark mode compatibility */
:deep(.jse-main) {
  --jse-theme-color: var(--p-primary-color, #10b981);
  --jse-theme-color-highlight: var(--p-primary-100, #d1fae5);
}
</style>
