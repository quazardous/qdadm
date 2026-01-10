<script setup>
/**
 * CountriesPage - REST Countries list page
 *
 * Displays countries fetched from REST Countries API.
 * Features:
 * - Client-side pagination (API returns full dataset)
 * - Search by name, code, region, capital
 * - Flag emoji display
 * - Population formatting
 * - View country detail action
 *
 * Note: REST Countries API is read-only.
 */

import { useListPage, ListPage } from 'qdadm'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import { useFavoriteAction } from '@/composables/useFavoriteAction'

// ============ LIST BUILDER ============
const list = useListPage({ entity: 'countries' })

// ============ FAVORITE ACTION ============
useFavoriteAction(list, 'country', { labelField: (c) => c.name?.common || c.cca3 })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search countries...',
  fields: ['name.common', 'cca3', 'region', 'capital']
})

// ============ ROW ACTIONS ============
list.addViewAction()

// ============ FORMATTERS ============
function formatPopulation(pop) {
  if (typeof pop !== 'number') return '-'
  return new Intl.NumberFormat('en-US').format(pop)
}

function formatCapital(capitals) {
  if (!Array.isArray(capitals) || capitals.length === 0) return '-'
  return capitals.join(', ')
}

function getRegionSeverity(region) {
  const severities = {
    'Africa': 'warn',
    'Americas': 'success',
    'Asia': 'danger',
    'Europe': 'info',
    'Oceania': 'secondary',
    'Antarctic': 'contrast'
  }
  return severities[region] || 'secondary'
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column header="Flag" style="width: 60px">
        <template #body="{ data }">
          <span class="country-flag">{{ data.flag }}</span>
        </template>
      </Column>
      <Column field="name.common" header="Name" sortable>
        <template #body="{ data }">
          {{ data.name?.common || '-' }}
        </template>
      </Column>
      <Column field="cca3" header="Code" sortable style="width: 80px" />
      <Column field="capital" header="Capital" style="width: 180px">
        <template #body="{ data }">
          {{ formatCapital(data.capital) }}
        </template>
      </Column>
      <Column field="region" header="Region" sortable style="width: 120px">
        <template #body="{ data }">
          <Tag v-if="data.region" :value="data.region" :severity="getRegionSeverity(data.region)" />
          <span v-else>-</span>
        </template>
      </Column>
      <Column field="population" header="Population" sortable style="width: 130px">
        <template #body="{ data }">
          {{ formatPopulation(data.population) }}
        </template>
      </Column>
    </template>
  </ListPage>
</template>

<style scoped>
.country-flag {
  font-size: 1.5rem;
}
</style>
