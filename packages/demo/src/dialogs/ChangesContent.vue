<script setup>
/**
 * ChangesContent - an app's own content handler for the rich dialog (#5445),
 * registered as 'demo.changes' in main.js: a block { kind: 'demo.changes',
 * items: [{ tag, text }] } becomes a list of tagged changes.
 */
import Tag from 'primevue/tag'

defineProps({ block: { type: Object, required: true } })
const severity = { new: 'success', fix: 'warn', change: 'info' }
</script>

<template>
  <ul class="demo-changes">
    <li v-for="(item, i) in block.items" :key="i">
      <Tag :value="item.tag" :severity="severity[item.tag] ?? 'secondary'" />
      <span>{{ item.text }}</span>
    </li>
  </ul>
</template>

<style scoped>
.demo-changes {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.demo-changes li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
</style>
