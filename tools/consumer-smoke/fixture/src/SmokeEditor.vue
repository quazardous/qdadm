<script setup lang="ts">
/**
 * /editors surface (#1024): the JSDoc call shape `mode="tree"` must
 * typecheck (string literal, no vanilla-jsoneditor import — #1253 point 4),
 * and the Mode enum must be importable from the qdadm entry.
 * JsonStructuredField.jsonMode must accept the same literals (#1280).
 */
import { ref } from 'vue'
import { VanillaJsonEditor, JsonStructuredField, Mode } from '@quazardous/qdadm/editors'

const data = ref<Record<string, unknown>>({ hello: 'world' })
const enumMode = Mode.text
</script>

<template>
  <VanillaJsonEditor v-model="data" mode="tree" />
  <VanillaJsonEditor v-model="data" :mode="enumMode" />
  <JsonStructuredField v-model="data" json-mode="text" />
  <JsonStructuredField v-model="data" :json-mode="enumMode" />
</template>
