<script setup>
/**
 * ObjectTree - VSCode-style collapsible object explorer
 *
 * Renders objects/arrays as a tree with collapsible nodes.
 * Primitive values are shown inline, objects/arrays are expandable.
 */
import { ref, computed } from 'vue'

const props = defineProps({
  data: { type: [Object, Array, String, Number, Boolean, null], default: null },
  depth: { type: Number, default: 0 },
  maxDepth: { type: Number, default: 10 },
  name: { type: String, default: null },
  defaultExpanded: { type: Boolean, default: false }
})

const expanded = ref(props.defaultExpanded && props.depth < 2)

const isObject = computed(() => props.data !== null && typeof props.data === 'object')
const isArray = computed(() => Array.isArray(props.data))
const isEmpty = computed(() => {
  if (!isObject.value) return false
  return isArray.value ? props.data.length === 0 : Object.keys(props.data).length === 0
})

const keys = computed(() => {
  if (!isObject.value) return []
  return Object.keys(props.data).slice(0, 100)
})

const preview = computed(() => {
  if (!isObject.value) return ''
  if (isArray.value) {
    return `Array(${props.data.length})`
  }
  const keyCount = Object.keys(props.data).length
  const firstKeys = Object.keys(props.data).slice(0, 3).join(', ')
  return keyCount <= 3 ? `{${firstKeys}}` : `{${firstKeys}, ...}`
})

const valueClass = computed(() => {
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

function formatValue(val) {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (typeof val === 'string') {
    const truncated = val.length > 100 ? val.slice(0, 100) + '...' : val
    return `"${truncated}"`
  }
  if (typeof val === 'function') return 'ƒ()'
  return String(val)
}

function toggleExpand() {
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
          :data="data[key]"
          :name="key"
          :depth="depth + 1"
          :maxDepth="maxDepth"
        />
        <div v-if="Object.keys(data).length > 100" class="obj-truncated">
          ... {{ Object.keys(data).length - 100 }} more
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

<style scoped>
.obj-node {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.4;
}

.obj-line {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 1px 0;
  cursor: default;
  white-space: nowrap;
}

.obj-line:hover {
  background: rgba(255, 255, 255, 0.05);
}

.obj-toggle {
  color: #71717a;
  font-size: 10px;
  width: 12px;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.1s;
  display: inline-block;
}

.obj-toggle.obj-expanded {
  transform: rotate(90deg);
}

.obj-key {
  color: #a78bfa;
}

.obj-preview {
  color: #71717a;
  font-style: italic;
}

.obj-empty {
  color: #71717a;
}

.obj-children {
  border-left: 1px solid #3f3f46;
  margin-left: 5px;
}

.obj-string {
  color: #fbbf24;
}

.obj-number {
  color: #34d399;
}

.obj-boolean {
  color: #60a5fa;
}

.obj-null, .obj-undefined {
  color: #71717a;
  font-style: italic;
}

.obj-function {
  color: #c084fc;
  font-style: italic;
}

.obj-truncated, .obj-max-depth {
  color: #71717a;
  font-style: italic;
  padding-left: 16px;
}
</style>
