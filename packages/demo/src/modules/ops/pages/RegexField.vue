<script setup>
/**
 * The page's own handler for `x-widget: regex` (#5587): the expression, and a
 * sample line tried against it, its named groups shown. qdadm draws it where
 * the schema asks; it writes its value with `update`.
 */
import { computed, ref } from 'vue'

const props = defineProps({ value: { type: null, default: '' }, path: { type: Array, required: true }, schema: { type: Object, default: () => ({}) }, readOnly: Boolean })
const emit = defineEmits(['update'])
const sample = ref('connexion sftp refusée : sync_acme.sh')
const result = computed(() => {
  try {
    // Python's (?P<name>…) read as JavaScript's (?<name>…)
    const m = new RegExp(String(props.value ?? '').replace(/\(\?P</g, '(?<')).exec(sample.value)
    return m ? { ok: true, groups: m.groups ?? {} } : { ok: false }
  } catch (err) {
    return { error: err.message }
  }
})
</script>

<template>
  <div class="regex-field" data-regex-field>
    <input class="p-inputtext p-component" :value="value ?? ''" :disabled="readOnly" aria-label="Regular expression" spellcheck="false" @change="emit('update', $event.target.value)" />
    <div class="regex-try">
      <input v-model="sample" class="p-inputtext p-component" aria-label="A sample line" />
      <span v-if="result.error" class="bad" data-regex-result="error">{{ result.error }}</span>
      <span v-else-if="result.ok" class="good" data-regex-result="match">
        <i class="pi pi-check" aria-hidden="true"></i>
        <template v-for="(v, k) in result.groups" :key="k"> {{ k }} = {{ v }}</template>
      </span>
      <span v-else class="bad" data-regex-result="none">no match</span>
    </div>
  </div>
</template>

<style scoped>
.regex-field { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-width: 0; }
.regex-field input { font-family: var(--qd-font-mono, monospace); width: 100%; }
.regex-try { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.regex-try input { flex: 1; min-width: 12rem; font-family: inherit; }
.good { color: var(--p-green-600, #16a34a); }
.bad { color: var(--p-red-600, #dc2626); }
</style>
