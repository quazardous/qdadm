<script setup>
/**
 * Log rules (#5587): YamlConfigEditor with its « Builder » view, the whole
 * document built from its JSON Schema: two sections (preprocessing, rules),
 * fields by type, a key table, an all / any tree, and one widget of the
 * page's own (`x-widget: regex`). qdadm knows none of these keys.
 */
import { ref } from 'vue'
import { PageLayout, QdButton } from '@quazardous/qdadm'
import { YamlConfigEditor } from '@quazardous/qdadm/editors/yaml'
import { fakeLogRulesAdapter, resetLogRules } from '../fakeLogRules'
import RegexField from './RegexField.vue'

const key = ref(0)
const builder = { handlers: { regex: RegexField } }
function reset() {
  resetLogRules()
  key.value++
}
</script>

<template>
  <PageLayout title="Log rules">
    <p class="lead">
      The « Builder » view reads the document's structure from its JSON Schema: each list is a section, each item a card,
      each field drawn by its type. The regular expression is a widget of this page, named by the schema
      (<code>x-widget: regex</code>). Every click is a patch of the YAML: the comments stay.
    </p>
    <YamlConfigEditor :key="key" :adapter="fakeLogRulesAdapter" :builder="builder" height="32rem" />
    <QdButton label="Reset the demo document" icon="pi pi-refresh" severity="secondary" text size="small" @click="reset" />
  </PageLayout>
</template>

<style scoped>
.lead { margin: 0 0 1rem; max-width: 60rem; }
</style>
