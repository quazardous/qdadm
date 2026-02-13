<script setup lang="ts">
/**
 * VanillaJsonEditor - JSON editor using vanilla-jsoneditor
 *
 * Provides tree/text/table modes like jsoneditoronline.org
 *
 * Usage:
 * <VanillaJsonEditor v-model="jsonData" mode="tree" />
 */

import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { JSONEditor, type Content, type ContentErrors, type OnChangeStatus, type Mode } from 'vanilla-jsoneditor'

type JsonValue = Record<string, unknown> | unknown[] | string | null

interface Props {
  modelValue?: JsonValue
  mode?: Mode
  height?: string
  readOnly?: boolean
  mainMenuBar?: boolean
  navigationBar?: boolean
  statusBar?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  mode: 'tree' as Mode,
  height: '400px',
  readOnly: false,
  mainMenuBar: true,
  navigationBar: true,
  statusBar: true
})

const emit = defineEmits<{
  'update:modelValue': [value: JsonValue]
  'change': [value: JsonValue]
  'error': [errors: ContentErrors]
}>()

const containerRef = ref<HTMLElement | null>(null)
let editor: JSONEditor | null = null
// Flag to prevent onChange from firing during programmatic updates (instance-specific)
const updatingFromProp = ref<boolean>(false)

// Parse value to ensure it's an object/array
function parseValue(val: JsonValue): Record<string, unknown> | unknown[] {
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
  return val as Record<string, unknown> | unknown[]
}

// Initialize editor
onMounted(() => {
  if (!containerRef.value) return

  const content: Content = {
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
      onChange: (updatedContent: Content, _previousContent: Content, { contentErrors }: OnChangeStatus) => {
        // Skip if this change came from a programmatic prop update
        if (updatingFromProp.value) return

        if (contentErrors) {
          emit('error', contentErrors)
          return
        }

        // Extract JSON from content
        let newValue: JsonValue | undefined
        if ('json' in updatedContent && updatedContent.json !== undefined) {
          newValue = updatedContent.json as JsonValue
        } else if ('text' in updatedContent && updatedContent.text !== undefined) {
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
watch(() => props.modelValue, (newVal: JsonValue | undefined) => {
  if (!editor) return

  const currentContent = editor.get()
  const newParsed = parseValue(newVal ?? null)

  // Only update if different (avoid loops)
  const currentJson = 'json' in currentContent && currentContent.json !== undefined
    ? currentContent.json
    : ('text' in currentContent && currentContent.text ? JSON.parse(currentContent.text) : null)

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
watch(() => props.mode, (newMode: Mode | undefined) => {
  if (editor && newMode) {
    editor.updateProps({ mode: newMode })
  }
})

// Watch readOnly changes
watch(() => props.readOnly, (newReadOnly: boolean) => {
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
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
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
