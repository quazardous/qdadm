<script setup>
/**
 * CountryDetailPage - REST Countries detail page
 *
 * Displays full country information from REST Countries API.
 * Features:
 * - Flag emoji and country name
 * - Geographic info (region, subregion, capital)
 * - Demographics (population)
 * - Country code (cca3)
 * - Read-only view
 */

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { PageLayout, usePageTitle, useEntityItemPage } from 'qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'
import { InfoBanner } from 'qdadm/components'
import Tag from 'primevue/tag'

const router = useRouter()

// Use useEntityItemPage for country loading + breadcrumb
const { data: country, loading, error } = useEntityItemPage({ entity: 'countries' })

// Page title
const pageTitle = computed(() => {
  if (country.value) {
    return country.value.name?.common || country.value.cca3
  }
  return 'Country Details'
})

usePageTitle(pageTitle)

function goBack() {
  router.push({ name: 'country' })
}

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
  <PageLayout>
    <div class="country-detail-page">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
      </div>

      <!-- Error State -->
      <InfoBanner v-else-if="error" severity="error" :closable="false">
        {{ error }}
      </InfoBanner>

      <!-- Country Details -->
      <div v-else-if="country" class="country-content">
        <!-- Main Info Card -->
        <Card>
          <template #content>
            <div class="country-main">
              <!-- Flag Section -->
              <div class="country-flag-section">
                <span class="country-flag-large">{{ country.flag }}</span>
                <h2 class="country-name">{{ country.name?.common }}</h2>
                <p class="country-official-name">{{ country.name?.official }}</p>
              </div>

              <!-- Details -->
              <div class="country-info">
                <div class="detail-row">
                  <span class="detail-label">Country Code</span>
                  <span class="detail-value">
                    <Tag :value="country.cca3" severity="info" />
                  </span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Region</span>
                  <span class="detail-value">
                    <Tag v-if="country.region" :value="country.region" :severity="getRegionSeverity(country.region)" />
                    <span v-else>-</span>
                  </span>
                </div>

                <div v-if="country.subregion" class="detail-row">
                  <span class="detail-label">Subregion</span>
                  <span class="detail-value">{{ country.subregion }}</span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Capital</span>
                  <span class="detail-value">{{ formatCapital(country.capital) }}</span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Population</span>
                  <span class="detail-value population">{{ formatPopulation(country.population) }}</span>
                </div>

                <div v-if="country.languages" class="detail-row">
                  <span class="detail-label">Languages</span>
                  <span class="detail-value">
                    <Tag
                      v-for="(lang, code) in country.languages"
                      :key="code"
                      :value="lang"
                      severity="secondary"
                      class="language-tag"
                    />
                  </span>
                </div>

                <div v-if="country.currencies" class="detail-row">
                  <span class="detail-label">Currencies</span>
                  <span class="detail-value">
                    <span v-for="(currency, code) in country.currencies" :key="code" class="currency-item">
                      {{ currency.name }} ({{ currency.symbol || code }})
                    </span>
                  </span>
                </div>

                <div v-if="country.timezones?.length" class="detail-row">
                  <span class="detail-label">Timezones</span>
                  <span class="detail-value">{{ country.timezones.join(', ') }}</span>
                </div>

                <div v-if="country.borders?.length" class="detail-row">
                  <span class="detail-label">Borders</span>
                  <span class="detail-value">
                    <Tag
                      v-for="border in country.borders"
                      :key="border"
                      :value="border"
                      severity="secondary"
                      class="border-tag"
                    />
                  </span>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <div class="detail-actions">
          <Button
            label="Back to List"
            icon="pi pi-arrow-left"
            severity="secondary"
            @click="goBack"
          />
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
.country-detail-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.country-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.country-main {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 2rem;
}

@media (max-width: 768px) {
  .country-main {
    grid-template-columns: 1fr;
  }
}

.country-flag-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.country-flag-large {
  font-size: 6rem;
  line-height: 1;
  margin-bottom: 1rem;
}

.country-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.country-official-name {
  margin: 0.25rem 0 0 0;
  font-size: 0.9rem;
  color: var(--p-surface-500);
}

.country-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  border-bottom: 1px solid var(--p-surface-200);
  padding-bottom: 0.75rem;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-weight: 600;
  color: var(--p-surface-600);
  min-width: 120px;
}

.detail-value {
  color: var(--p-surface-800);
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.population {
  font-weight: 500;
}

.language-tag,
.border-tag {
  margin-right: 0.25rem;
}

.currency-item:not(:last-child)::after {
  content: ', ';
}

.detail-actions {
  margin-top: 0.5rem;
}
</style>
