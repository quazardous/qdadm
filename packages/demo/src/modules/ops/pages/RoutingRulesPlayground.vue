<script setup>
/**
 * Routing rules (#5581): YamlConfigEditor with its « Rules » view, the rules
 * built by clicking on the YAML itself (its comments kept), and a live trial
 * beside it, read from the text being edited (update:text).
 */
import { ref } from 'vue'
import { PageLayout, QdButton } from '@quazardous/qdadm'
import { YamlConfigEditor } from '@quazardous/qdadm/editors/yaml'
import { fakeRulesAdapter, VOCABULARY, trial, resetRoutingRules } from '../fakeRoutingRules'

const results = ref(null)
const key = ref(0)
function onText(text) {
  results.value = trial(text)
}
function reset() {
  resetRoutingRules()
  key.value++
}
</script>

<template>
  <PageLayout title="Routing rules">
    <p class="lead">
      The rules are YAML with comments. The « Rules » view builds them by clicking, on the same document: a change
      touches only its line, and the comments stay. The trial on the right follows the text as it is edited.
    </p>
    <div class="layout">
      <YamlConfigEditor :key="key" :adapter="fakeRulesAdapter" :rules="{ vocabulary: VOCABULARY }" height="32rem" @update:text="onText" @loaded="onText($event.yaml)" />
      <aside class="trial" aria-label="Live trial">
        <h2>Live trial</h2>
        <p v-if="!results" class="muted">The rules do not read: fix the YAML.</p>
        <table v-else>
          <thead><tr><th>Event</th><th>Rule</th><th>Route</th></tr></thead>
          <tbody>
            <tr v-for="r in results" :key="r.event.id" :data-trial="r.event.id">
              <td>#{{ r.event.id }} {{ r.event.channel }}</td>
              <td>{{ r.rule ?? '—' }}</td>
              <td>{{ r.route ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
        <QdButton label="Start over" severity="secondary" text size="small" @click="reset" />
      </aside>
    </div>
  </PageLayout>
</template>

<style scoped>
.lead { max-width: 60rem; }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 20rem; gap: 1.25rem; align-items: start; }
.trial table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.trial th, .trial td { padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--p-content-border-color, #e2e8f0); text-align: left; }
.trial h2 { font-size: 1rem; margin: 0 0 0.5rem; }
.muted { color: var(--p-text-muted-color, #64748b); }
@media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
</style>
