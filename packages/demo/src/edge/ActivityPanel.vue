<script setup>
/** The demo's global edge panel (#5506): what happened lately; opening it marks it seen */
import { onMounted } from 'vue'
import { activity, unseenActivity } from './panels'

onMounted(() => (unseenActivity.value = 0))
</script>

<template>
  <ul class="edge-demo-list">
    <li v-for="(a, i) in activity" :key="i"><span class="edge-demo-at">{{ a.at }}</span> {{ a.text }}</li>
  </ul>
</template>

<style scoped>
.edge-demo-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.edge-demo-at {
  font-variant-numeric: tabular-nums;
  opacity: 0.65;
  margin-right: 0.4rem;
}
</style>
