<script setup lang="ts">
/**
 * ObjectTree - VSCode-style collapsible object explorer
 *
 * Renders objects/arrays as a tree with collapsible nodes.
 * Primitive values are shown inline, objects/arrays are expandable.
 */
import { ref, computed } from 'vue'

type DataValue = Record<string, unknown> | unknown[] | string | number | boolean | null | undefined

const props = withDefaults(defineProps<{
  data?: DataValue
  depth?: number
  maxDepth?: number
  name?: string | null
  defaultExpanded?: boolean
}>(), {
  data: null,
  depth: 0,
  maxDepth: 10,
  name: null,
  defaultExpanded: false
})

const expanded = ref<boolean>(props.defaultExpanded && props.depth < 2)

const isObject = computed<boolean>(() => props.data !== null && typeof props.data === 'object')
const isArray = computed<boolean>(() => Array.isArray(props.data))
const isEmpty = computed<boolean>(() => {
  if (!isObject.value) return false
  return isArray.value ? (props.data as unknown[]).length === 0 : Object.keys(props.data as object).length === 0
})

const keys = computed<string[]>(() => {
  if (!isObject.value) return []
  return Object.keys(props.data as object).slice(0, 100)
})

const preview = computed<string>(() => {
  if (!isObject.value) return ''
  if (isArray.value) {
    return `Array(${(props.data as unknown[]).length})`
  }
  const dataObj = props.data as Record<string, unknown>
  const keyCount = Object.keys(dataObj).length
  const firstKeys = Object.keys(dataObj).slice(0, 3).join(', ')
  return keyCount <= 3 ? `{${firstKeys}}` : `{${firstKeys}, ...}`
})

const valueClass = computed<string>(() => {
  if (props.data === null) return 'obj-null'
  if (props.data === undefined) return 'obj-undefined'
  switch (typeof props.data) {
    case 'string': return 'obj-string'
    case 'number': return 'obj-number'
    case 'boolean': return 'obj-boolean'
    case 'function': return 'obj-function'
    default: return ''
  }
})

function formatValue(val: DataValue): string {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (typeof val === 'string') {
    const truncated = val.length > 100 ? val.slice(0, 100) + '...' : val
    return `"${truncated}"`
  }
  if (typeof val === 'function') return 'ƒ()'
  return String(val)
}

function toggleExpand(): void {
  if (isObject.value && !isEmpty.value) {
    expanded.value = !expanded.value
  }
}
</script>

<template>
  <div class="obj-node" :style="{ paddingLeft: depth > 0 ? '12px' : '0' }">
    <!-- Expandable object/array -->
    <template v-if="isObject && !isEmpty">
      <div class="obj-line" @click="toggleExpand">
        <span class="obj-toggle" :class="{ 'obj-expanded': expanded }">▶</span>
        <span v-if="name !== null" class="obj-key">{{ name }}:</span>
        <span class="obj-preview">{{ preview }}</span>
      </div>
      <div v-if="expanded && depth < maxDepth" class="obj-children">
        <ObjectTree
          v-for="key in keys"
          :key="key"
          :data="data && typeof data === 'object' ? (data as any)[key] : undefined"
          :name="key"
          :depth="depth + 1"
          :maxDepth="maxDepth"
        />
        <div v-if="data && typeof data === 'object' && Object.keys(data).length > 100" class="obj-truncated">
          ... {{ Object.keys(data as object).length - 100 }} more
        </div>
      </div>
      <div v-else-if="expanded" class="obj-max-depth">[Max depth]</div>
    </template>

    <!-- Empty object/array -->
    <template v-else-if="isObject && isEmpty">
      <div class="obj-line">
        <span v-if="name !== null" class="obj-key">{{ name }}:</span>
        <span class="obj-empty">{{ isArray ? '[]' : '{}' }}</span>
      </div>
    </template>

    <!-- Primitive value -->
    <template v-else>
      <div class="obj-line">
        <span v-if="name !== null" class="obj-key">{{ name }}:</span>
        <span :class="valueClass">{{ formatValue(data) }}</span>
      </div>
    </template>
  </div>
</template>

