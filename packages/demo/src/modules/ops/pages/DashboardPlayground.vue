<script setup>
/**
 * DashboardPlayground — the same cards in a classic zone and in a dashboard
 * each user arranges (#4320). The cards are the blocks of the ops-dashboard
 * zone (OpsDemoModule): a card is written once and works in both.
 *
 * "Customisable, server" keeps the arrangement through a storage the app
 * provides (#4338): here a fake server answering in 600 ms.
 */
import { ref } from 'vue'
import Checkbox from 'primevue/checkbox'
import { usePageTitle, CardsDashboard, Zone } from '@quazardous/qdadm'
import SelectButton from 'primevue/selectbutton'

usePageTitle('Dashboard')

const modes = [
  { label: 'Customisable', value: 'cards' },
  { label: 'Customisable, server', value: 'server' },
  { label: 'Classic', value: 'classic' },
]
const mode = ref('cards')

// A fake server: 600 ms per call, its "database" under its own localStorage prefix
const failSaves = ref(false)
const DB = 'demo.fake-server.'
const later = (fn) => new Promise((resolve, reject) => setTimeout(() => { try { resolve(fn()) } catch (e) { reject(e) } }, 600))
const serverStorage = {
  load: (key) => later(() => JSON.parse(localStorage.getItem(DB + key) ?? 'null')),
  save: (key, arrangement) =>
    later(() => {
      if (failSaves.value) throw new Error('503 Service Unavailable')
      if (arrangement) localStorage.setItem(DB + key, JSON.stringify(arrangement))
      else localStorage.removeItem(DB + key)
    }),
}
</script>

<template>
  <div class="dashboard-playground">
    <div class="head">
      <p class="hint">
        The same blocks, two ways. In "Customisable", "Customise" lets you reorder the cards (drag the handle, or
        arrow keys on it), pin them at the top or hide them. Sales is required (it cannot be hidden), News is fixed
        (it does not move). The arrangement is kept in this browser, per user; "Customisable, server" keeps it
        through a fake server (600 ms per call), saved once when you press Done.
      </p>
      <SelectButton v-model="mode" :options="modes" option-label="label" option-value="value" :allow-empty="false" />
    </div>
    <label v-if="mode === 'server'" class="fail-saves">
      <Checkbox v-model="failSaves" binary input-id="fail-saves" /> The server refuses saves
    </label>
    <CardsDashboard v-if="mode === 'cards'" zone="ops-dashboard" id="ops" min-card-width="16rem" />
    <CardsDashboard v-else-if="mode === 'server'" zone="ops-dashboard" id="ops-server" min-card-width="16rem" :storage="serverStorage" />
    <Zone v-else name="ops-dashboard" class="classic-grid" />
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.hint {
  flex: 1 1 24rem;
  margin: 0;
  color: var(--p-text-muted-color);
}
.fail-saves {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.classic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr));
  gap: 1rem;
}
</style>
