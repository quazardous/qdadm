<script setup>
/**
 * DashboardPlayground — the same cards in a classic zone and in a dashboard
 * each user arranges (#4320). The cards are the blocks of the ops-dashboard
 * zone (OpsDemoModule): a card is written once and works in both.
 */
import { ref } from 'vue'
import { usePageTitle, CardsDashboard, Zone } from '@quazardous/qdadm'
import SelectButton from 'primevue/selectbutton'

usePageTitle('Dashboard')

const modes = [
  { label: 'Customisable', value: 'cards' },
  { label: 'Classic', value: 'classic' },
]
const mode = ref('cards')
</script>

<template>
  <div class="dashboard-playground">
    <div class="head">
      <p class="hint">
        The same blocks, two ways. In "Customisable", "Customise" lets you reorder the cards (drag the handle, or
        arrow keys on it), pin them at the top or hide them. Sales is required (it cannot be hidden), News is fixed
        (it does not move). The arrangement is kept in this browser, per user.
      </p>
      <SelectButton v-model="mode" :options="modes" option-label="label" option-value="value" :allow-empty="false" />
    </div>
    <CardsDashboard v-if="mode === 'cards'" zone="ops-dashboard" id="ops" min-card-width="16rem" />
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
.classic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr));
  gap: 1rem;
}
</style>
