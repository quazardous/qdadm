<script setup>
/**
 * WelcomePage - Multi-Backend Demo home page
 *
 * Showcases qdadm's storage abstraction with six different backends:
 * - MockApiStorage (localStorage persistence)
 * - ApiStorage (JSONPlaceholder REST API)
 * - DummyJsonStorage (DummyJSON API with limit/skip pagination)
 * - RestCountriesStorage (REST Countries API with client-side pagination)
 * - LocalStorage (browser localStorage for persistent local data)
 * - MemoryStorage (volatile in-memory storage)
 */
import { usePageTitle, qdadmLogo } from 'qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import { useRouter } from 'vue-router'

usePageTitle('Multi-Backend Demo')

const router = useRouter()

function openGitHub() {
  window.open('https://github.com/quazardous/qdadm', '_blank')
}

// Storage backends available in qdadm
const backends = [
  {
    name: 'MockApiStorage',
    type: 'localStorage',
    description: 'In-memory with localStorage persistence. Ideal for demos and prototyping.',
    features: ['Fixtures seeding', 'Persists across refresh', 'Full CRUD simulation']
  },
  {
    name: 'LocalStorage',
    type: 'localStorage',
    description: 'Pure browser localStorage. Data persists across sessions.',
    features: ['No network calls', 'Persistent storage', 'Full CRUD support']
  },
  {
    name: 'MemoryStorage',
    type: 'volatile',
    description: 'In-memory only. Data lost on page refresh.',
    features: ['Session-scoped', 'No persistence', 'Initial data seeding']
  },
  {
    name: 'ApiStorage',
    type: 'REST API',
    description: 'HTTP client for REST APIs. Connects to any backend with standard conventions.',
    features: ['Axios-based', 'Pagination support', 'Custom response mapping']
  },
  {
    name: 'DummyJsonStorage',
    type: 'REST API',
    description: 'Extended ApiStorage for APIs with limit/skip pagination.',
    features: ['limit/skip pagination', 'Response key mapping', 'Custom list() override']
  },
  {
    name: 'RestCountriesStorage',
    type: 'REST API',
    description: 'Extended ApiStorage with client-side pagination and caching.',
    features: ['Client-side pagination', '5-minute cache', 'Custom ID field (cca3)']
  }
]

// Demo entities grouped by backend/section
const entityGroups = [
  {
    section: 'Library',
    backend: 'MockApiStorage',
    severity: 'info',
    description: 'Full CRUD with permissions, relationships, and fixtures',
    entities: [
      { name: 'Books', route: 'book', icon: 'pi pi-book', desc: 'CRUD with genre filter, admin-only delete' },
      { name: 'Genres', route: 'genre', icon: 'pi pi-tags', desc: 'Parent entity with child route to filtered books' },
      { name: 'Loans', route: 'loan', icon: 'pi pi-arrow-right-arrow-left', desc: 'Ownership-based access, enrichment pattern' },
      { name: 'Users', route: 'user', icon: 'pi pi-users', desc: 'Admin-only access for user management' }
    ]
  },
  {
    section: 'Local Storage',
    backend: 'LocalStorage',
    severity: 'secondary',
    description: 'Persistent browser storage - survives page refresh and sessions',
    entities: [
      { name: 'Favorites', route: 'favorite', icon: 'pi pi-star', desc: 'Bookmarks stored in browser localStorage' }
    ]
  },
  {
    section: 'Memory Storage',
    backend: 'MemoryStorage',
    severity: 'contrast',
    description: 'Volatile storage - data lost on page refresh',
    entities: [
      { name: 'Settings', route: 'setting', icon: 'pi pi-cog', desc: 'Key/value pairs for session configuration' }
    ]
  },
  {
    section: 'JSONPlaceholder',
    backend: 'ApiStorage',
    severity: 'success',
    description: 'Read-only integration with external REST API',
    entities: [
      { name: 'JP Users', route: 'jp_user', icon: 'pi pi-users', desc: 'External users with detail page' },
      { name: 'Posts', route: 'post', icon: 'pi pi-file-edit', desc: 'Posts with author relationship' },
      { name: 'Todos', route: 'todo', icon: 'pi pi-check-square', desc: 'Simple todo list with completion toggle' }
    ]
  },
  {
    section: 'DummyJSON',
    backend: 'DummyJsonStorage',
    severity: 'warn',
    description: 'Different pagination style (limit/skip)',
    entities: [
      { name: 'Products', route: 'product', icon: 'pi pi-box', desc: 'Products with thumbnails, price, category' }
    ]
  },
  {
    section: 'REST Countries',
    backend: 'RestCountriesStorage',
    severity: 'danger',
    description: 'Client-side pagination with caching for large datasets',
    entities: [
      { name: 'Countries', route: 'country', icon: 'pi pi-globe', desc: '250 countries with flag, capital, region' }
    ]
  }
]

function navigateTo(route) {
  router.push({ name: route })
}
</script>

<template>
  <div class="welcome-page">
    <!-- Hero Section -->
    <div class="welcome-hero">
      <img :src="qdadmLogo" alt="qdadm" class="welcome-logo" />
      <h1 class="welcome-title">qdadm Multi-Backend Demo</h1>
      <p class="welcome-tagline">
        Vue 3 admin framework with pluggable storage backends
      </p>
      <div class="welcome-actions">
        <Button label="Browse Books" icon="pi pi-book" @click="navigateTo('book')" />
        <Button label="View on GitHub" icon="pi pi-github" severity="secondary" outlined @click="openGitHub" />
      </div>
    </div>

    <!-- What is qdadm? -->
    <section class="welcome-section">
      <h2>What is qdadm?</h2>
      <p>
        <strong>qdadm</strong> is a declarative admin dashboard framework for Vue 3 with PrimeVue.
        Define entities with fields and storage, get full CRUD with search, filters, pagination,
        and permissions in ~20 lines of code.
      </p>
      <div class="highlight-box">
        <i class="pi pi-lightbulb"></i>
        <span>
          <strong>Key concept:</strong> Pages only know entity names. Storage is invisible.
          Switch from localStorage to REST API with zero page changes.
        </span>
      </div>
    </section>

    <!-- Storage Backends -->
    <section class="welcome-section">
      <h2>Storage Backends</h2>
      <p class="section-intro">
        qdadm abstracts storage behind EntityManager. Same CRUD interface, different implementations.
      </p>
      <DataTable :value="backends" class="backends-table" stripedRows>
        <Column field="name" header="Backend">
          <template #body="{ data }">
            <code class="backend-name">{{ data.name }}</code>
          </template>
        </Column>
        <Column field="type" header="Type">
          <template #body="{ data }">
            <Tag :value="data.type" :severity="data.type === 'localStorage' ? 'info' : data.type === 'volatile' ? 'warn' : 'success'" />
          </template>
        </Column>
        <Column field="description" header="Description" />
        <Column header="Features">
          <template #body="{ data }">
            <ul class="feature-list">
              <li v-for="f in data.features" :key="f">{{ f }}</li>
            </ul>
          </template>
        </Column>
      </DataTable>
    </section>

    <!-- Demo Entities -->
    <section class="welcome-section">
      <h2>Demo Entities</h2>
      <p class="section-intro">
        This demo showcases six different storage backends with various entity types and permission models.
      </p>

      <div class="entity-groups">
        <Card v-for="group in entityGroups" :key="group.section" class="entity-group-card">
          <template #title>
            <div class="group-header">
              <span>{{ group.section }}</span>
              <Tag :value="group.backend" :severity="group.severity" />
            </div>
          </template>
          <template #subtitle>
            {{ group.description }}
          </template>
          <template #content>
            <div class="entity-cards">
              <div
                v-for="entity in group.entities"
                :key="entity.route"
                class="entity-card"
                @click="navigateTo(entity.route)"
              >
                <i :class="entity.icon" class="entity-icon"></i>
                <div class="entity-info">
                  <strong>{{ entity.name }}</strong>
                  <span>{{ entity.desc }}</span>
                </div>
                <i class="pi pi-chevron-right entity-arrow"></i>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </section>

    <!-- Demo Credentials -->
    <div class="demo-credentials">
      <i class="pi pi-info-circle"></i>
      <div>
        <strong>Demo credentials:</strong>
        <span>admin / admin (admin role), bob / bob or june / june (regular users)</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-page {
  max-width: 960px;
  margin: 0 auto;
  padding-bottom: 2rem;
}

/* Hero Section */
.welcome-hero {
  text-align: center;
  padding: 2rem 0 2.5rem;
}

.welcome-logo {
  width: 100px;
  height: 100px;
  margin-bottom: 0.75rem;
}

.welcome-title {
  font-size: 2.25rem;
  font-weight: 700;
  margin: 0;
  color: var(--p-primary-600);
}

.welcome-tagline {
  font-size: 1.125rem;
  color: var(--p-surface-600);
  margin: 0.5rem 0 1.5rem;
}

.welcome-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

/* Sections */
.welcome-section {
  margin-bottom: 2rem;
}

.welcome-section h2 {
  font-size: 1.375rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  color: var(--p-surface-800);
}

.welcome-section p {
  color: var(--p-surface-700);
  line-height: 1.6;
  margin: 0 0 1rem;
}

.section-intro {
  color: var(--p-surface-600);
  margin-bottom: 1rem;
}

/* Highlight Box */
.highlight-box {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  background: var(--p-primary-50);
  border: 1px solid var(--p-primary-200);
  border-radius: 8px;
  padding: 1rem;
}

.highlight-box i {
  color: var(--p-primary-500);
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.highlight-box span {
  color: var(--p-surface-700);
  line-height: 1.5;
}

/* Backends Table */
.backends-table {
  margin-top: 0.5rem;
}

.backend-name {
  background: var(--p-surface-100);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--p-surface-800);
}

.feature-list {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
  color: var(--p-surface-600);
}

.feature-list li {
  margin-bottom: 0.25rem;
}

.feature-list li:last-child {
  margin-bottom: 0;
}

/* Entity Groups */
.entity-groups {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.entity-group-card {
  border: 1px solid var(--p-surface-200);
}

.entity-group-card :deep(.p-card-title) {
  font-size: 1.125rem;
  padding-bottom: 0;
}

.entity-group-card :deep(.p-card-subtitle) {
  font-size: 0.875rem;
  color: var(--p-surface-600);
}

.entity-group-card :deep(.p-card-body) {
  padding: 1rem 1.25rem;
}

.entity-group-card :deep(.p-card-content) {
  padding: 0;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Entity Cards */
.entity-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.entity-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--p-surface-50);
  border: 1px solid var(--p-surface-200);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.entity-card:hover {
  background: var(--p-surface-100);
  border-color: var(--p-primary-300);
}

.entity-icon {
  font-size: 1.25rem;
  color: var(--p-primary-500);
  width: 2rem;
  text-align: center;
  flex-shrink: 0;
}

.entity-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.entity-info strong {
  font-size: 0.9375rem;
  color: var(--p-surface-800);
}

.entity-info span {
  font-size: 0.8125rem;
  color: var(--p-surface-600);
}

.entity-arrow {
  color: var(--p-surface-400);
  font-size: 0.875rem;
}

.entity-card:hover .entity-arrow {
  color: var(--p-primary-500);
}

/* Demo Credentials */
.demo-credentials {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  background: var(--p-blue-50);
  border: 1px solid var(--p-blue-200);
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.demo-credentials i {
  color: var(--p-blue-500);
  font-size: 1.25rem;
  flex-shrink: 0;
}

.demo-credentials div {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.demo-credentials strong {
  color: var(--p-surface-800);
}

.demo-credentials span {
  font-size: 0.875rem;
  color: var(--p-surface-600);
}

/* Responsive */
@media (max-width: 640px) {
  .welcome-title {
    font-size: 1.75rem;
  }

  .welcome-actions {
    flex-direction: column;
  }

  .entity-card {
    flex-wrap: wrap;
  }

  .entity-info {
    flex-basis: calc(100% - 3rem);
  }

  .entity-arrow {
    display: none;
  }
}
</style>
