<script setup lang="ts">
/**
 * CardShell — conditional Card wrapper (#1193).
 *
 * ShowPage and FormPage duplicated their entire content body twice (once
 * inside <Card><template #content>, once bare). Wrapping the single body
 * in this shell keeps the slots in the host component (no forwarding).
 */
import Card from 'primevue/card'

defineProps<{
  /** Wrap the default slot in a PrimeVue Card (#content). */
  card?: boolean
}>()
</script>

<template>
  <Card v-if="card">
    <template #content>
      <slot />
    </template>
  </Card>
  <template v-else>
    <slot />
  </template>
</template>
