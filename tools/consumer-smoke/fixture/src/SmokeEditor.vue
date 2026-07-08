<script setup lang="ts">
/**
 * /editors surface (#1024): the JSDoc call shape `mode="tree"` must
 * typecheck (string literal, no vanilla-jsoneditor import — #1253 point 4),
 * and the Mode enum must be importable from the qdadm entry.
 */
import { ref } from 'vue'
import { VanillaJsonEditor, Mode } from '@quazardous/qdadm/editors'

const data = ref<Record<string, unknown>>({ hello: 'world' })
const enumMode = Mode.text
</script>

<template>
  <VanillaJsonEditor v-model="data" mode="tree" />
  <VanillaJsonEditor v-model="data" :mode="enumMode" />
</template>
