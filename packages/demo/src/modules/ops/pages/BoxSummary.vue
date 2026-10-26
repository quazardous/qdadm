<script setup>
/**
 * BoxSummary — a task kind's own slot in the follow dialog (#4334): shown
 * under the log of a "create box" run.
 */
defineProps({
  run: { type: Object, required: true },
  kind: { type: String, default: null },
  final: { type: Boolean, default: false },
})
</script>

<template>
  <div class="box-summary">
    <i class="pi pi-box" aria-hidden="true"></i>
    <span v-if="!final">The box gets a database, a vhost and a certificate.</span>
    <span v-else-if="run.status === 'succeeded'">The box is up: open it from the Boxes list.</span>
    <span v-else>Nothing was left behind: the box was rolled back.</span>
  </div>
</template>

<style scoped>
.box-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: var(--p-content-hover-background);
  font-size: 0.875rem;
}
</style>
