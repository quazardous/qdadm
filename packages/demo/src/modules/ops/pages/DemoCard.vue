<script setup>
/**
 * DemoCard — one card of the customisable dashboard demo (#4320).
 */
import Card from 'primevue/card'

defineProps({
  title: { type: String, required: true },
  value: { type: String, default: '' },
  text: { type: String, default: '' },
  icon: { type: String, default: 'pi pi-chart-bar' },
})
</script>

<template>
  <Card class="demo-card">
    <template #title>
      <span class="demo-card-title"><i :class="icon" aria-hidden="true"></i> {{ title }}</span>
    </template>
    <template #content>
      <div v-if="value" class="demo-card-value">{{ value }}</div>
      <p class="demo-card-text">{{ text }}</p>
    </template>
  </Card>
</template>

<style scoped>
.demo-card {
  height: 100%;
}
.demo-card-title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
}
.demo-card-value {
  font-size: 1.75rem;
  font-weight: 600;
}
.demo-card-text {
  margin: 0.25rem 0 0;
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}
</style>
