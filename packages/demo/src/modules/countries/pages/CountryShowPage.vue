<script setup>
/**
 * CountryShowPage - REST Countries detail page using ShowPage builder
 *
 * Demonstrates the #media slot for custom visual content (flag + name).
 * Also shows how to handle complex nested data with custom rendering.
 */
import { computed } from 'vue'
import { useEntityItemShowPage, ShowPage, ShowField, PageNav } from 'qdadm'
import Tag from 'primevue/tag'

const show = useEntityItemShowPage({ entity: 'countries' })

// Generate fields from schema but exclude those we handle manually
show.generateFields({ exclude: ['flag', 'name', 'capital'] })

// Customize fields
show.updateField('cca3', {
  type: 'badge',
  label: 'Country Code',
  severity: 'info',
})

show.updateField('region', {
  type: 'badge',
})

show.updateField('population', {
  type: 'number',
  locale: 'en-US',
})

// Add back action
show.addBackAction({ route: 'country' })

// Helper functions
function formatCapital(capitals) {
  if (!Array.isArray(capitals) || capitals.length === 0) return '-'
  return capitals.join(', ')
}

// Computed for complex nested data
const languages = computed(() => {
  const langs = show.data.value?.languages
  if (!langs || typeof langs !== 'object') return []
  return Object.entries(langs).map(([code, name]) => ({ code, name }))
})

const currencies = computed(() => {
  const curs = show.data.value?.currencies
  if (!curs || typeof curs !== 'object') return []
  return Object.entries(curs).map(([code, info]) => ({
    code,
    name: info.name,
    symbol: info.symbol
  }))
})

const borders = computed(() => show.data.value?.borders || [])
const timezones = computed(() => show.data.value?.timezones || [])
</script>

<template>
  <ShowPage v-bind="show.props.value" v-on="show.events" media-width="200px">
    <template #nav>
      <PageNav />
    </template>

    <!-- Media zone: Flag + Names -->
    <template #media>
      <div class="country-media">
        <span class="country-flag">{{ show.data.value?.flag }}</span>
        <h2 class="country-name">{{ show.data.value?.name?.common }}</h2>
        <p class="country-official">{{ show.data.value?.name?.official }}</p>
      </div>
    </template>

    <template #fields>
      <!-- Auto-generated fields (cca3, region, subregion, population) -->
      <ShowField
        v-for="f in show.fields.value"
        :key="f.name"
        :field="f"
        :value="show.data.value?.[f.name]"
        horizontal
        label-width="120px"
      />

      <!-- Custom field: Capital (array) -->
      <ShowField label="Capital" horizontal label-width="120px">
        {{ formatCapital(show.data.value?.capital) }}
      </ShowField>

      <!-- Custom field: Languages (object) -->
      <ShowField v-if="languages.length" label="Languages" horizontal label-width="120px">
        <div class="tags-row">
          <Tag
            v-for="lang in languages"
            :key="lang.code"
            :value="lang.name"
            severity="secondary"
          />
        </div>
      </ShowField>

      <!-- Custom field: Currencies (object) -->
      <ShowField v-if="currencies.length" label="Currencies" horizontal label-width="120px">
        <span v-for="(cur, idx) in currencies" :key="cur.code">
          {{ cur.name }} ({{ cur.symbol || cur.code }}){{ idx < currencies.length - 1 ? ', ' : '' }}
        </span>
      </ShowField>

      <!-- Custom field: Timezones (array) -->
      <ShowField v-if="timezones.length" label="Timezones" horizontal label-width="120px">
        {{ timezones.join(', ') }}
      </ShowField>

      <!-- Custom field: Borders (array) -->
      <ShowField v-if="borders.length" label="Borders" horizontal label-width="120px">
        <div class="tags-row">
          <Tag
            v-for="border in borders"
            :key="border"
            :value="border"
            severity="secondary"
          />
        </div>
      </ShowField>
    </template>
  </ShowPage>
</template>

<style scoped>
.country-media {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.country-flag {
  font-size: 5rem;
  line-height: 1;
}

.country-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  text-align: center;
}

.country-official {
  margin: 0;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
  text-align: center;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
</style>
