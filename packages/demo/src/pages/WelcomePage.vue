<script setup>
/**
 * WelcomePage - qdadm Demo
 *
 * Showcases qdadm's modular architecture and key features.
 */
import { usePageTitle, qdadmLogo } from 'qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useRouter } from 'vue-router'

usePageTitle('qdadm Demo')

const router = useRouter()

function openGitHub() {
  window.open('https://github.com/quazardous/qdadm', '_blank')
}

// Killer features
const features = [
  {
    icon: 'pi pi-bolt',
    title: '20 Lines = Full CRUD',
    desc: 'Declare fields + storage, get list/create/edit/delete with search, filters, pagination.'
  },
  {
    icon: 'pi pi-th-large',
    title: 'Modular Architecture',
    desc: 'Kernel + Modules. Plug features in, unplug what you don\'t need. Tree-shakeable.'
  },
  {
    icon: 'pi pi-arrows-alt',
    title: 'Event-Driven',
    desc: 'SignalBus for decoupled communication. Components react without tight coupling.'
  },
  {
    icon: 'pi pi-database',
    title: 'Pluggable Storage',
    desc: 'Same interface, any backend. Switch from localStorage to REST API with zero code changes.'
  },
  {
    icon: 'pi pi-lock',
    title: 'Built-in Security',
    desc: 'Role-based permissions at entity level. Hide buttons, protect routes, filter data.'
  },
  {
    icon: 'pi pi-sliders-h',
    title: 'Debug Tools',
    desc: 'Optional debug bar with collectors for signals, routes, zones, auth state.'
  }
]

// Architecture highlights
const architecture = [
  { name: 'Kernel', desc: 'One-liner bootstrap with Vue, Router, Pinia, PrimeVue wiring' },
  { name: 'Modules', desc: 'Self-contained features with routes, entities, nav items' },
  { name: 'SignalBus', desc: 'Pub/sub events with wildcard subscriptions' },
  { name: 'Zones', desc: 'UI composition slots with weighted blocks' },
  { name: 'Chain', desc: 'Active navigation stack for breadcrumbs and context' },
  { name: 'Hooks', desc: 'Lifecycle extension points for cross-cutting concerns' }
]

// Demo entities grouped by backend/section
const entityGroups = [
  {
    section: 'Library Demo',
    backend: 'MockApiStorage',
    severity: 'info',
    description: 'Full CRUD with permissions and relationships',
    entities: [
      { name: 'Books', route: 'book', icon: 'pi pi-book' },
      { name: 'Genres', route: 'genre', icon: 'pi pi-tags' },
      { name: 'Loans', route: 'loan', icon: 'pi pi-arrow-right-arrow-left' },
      { name: 'Users', route: 'user', icon: 'pi pi-users' }
    ]
  },
  {
    section: 'Browser Storage',
    backend: 'LocalStorage',
    severity: 'secondary',
    description: 'Persistent + volatile storage options',
    entities: [
      { name: 'Favorites', route: 'favorite', icon: 'pi pi-star' },
      { name: 'Settings', route: 'setting', icon: 'pi pi-cog' }
    ]
  },
  {
    section: 'External APIs',
    backend: 'ApiStorage',
    severity: 'success',
    description: 'REST integrations with different pagination styles',
    entities: [
      { name: 'Posts', route: 'post', icon: 'pi pi-file-edit' },
      { name: 'Products', route: 'product', icon: 'pi pi-box' },
      { name: 'Countries', route: 'country', icon: 'pi pi-globe' }
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
      <h1 class="welcome-title">qdadm</h1>
      <p class="welcome-tagline">
        Build admin dashboards in minutes, not days
      </p>
      <p class="welcome-subtitle">
        Vue 3 + PrimeVue framework with modular architecture, pluggable storage, and built-in permissions
      </p>
      <div class="welcome-actions">
        <Button label="Browse Demo" icon="pi pi-play" @click="navigateTo('book')" />
        <Button label="GitHub" icon="pi pi-github" severity="secondary" outlined @click="openGitHub" />
      </div>
    </div>

    <!-- Why qdadm? -->
    <section class="welcome-section">
      <h2>Why qdadm?</h2>
      <div class="features-grid">
        <div v-for="f in features" :key="f.title" class="feature-card">
          <i :class="f.icon" class="feature-icon"></i>
          <div class="feature-content">
            <strong>{{ f.title }}</strong>
            <span>{{ f.desc }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Architecture -->
    <section class="welcome-section">
      <h2>Architecture</h2>
      <div class="arch-grid">
        <div v-for="a in architecture" :key="a.name" class="arch-item">
          <code>{{ a.name }}</code>
          <span>{{ a.desc }}</span>
        </div>
      </div>
    </section>

    <!-- Try it -->
    <section class="welcome-section">
      <h2>Try It</h2>
      <div class="entity-groups">
        <Card v-for="group in entityGroups" :key="group.section" class="entity-group-card">
          <template #title>
            <div class="group-header">
              <span>{{ group.section }}</span>
              <Tag :value="group.backend" :severity="group.severity" size="small" />
            </div>
          </template>
          <template #subtitle>{{ group.description }}</template>
          <template #content>
            <div class="entity-chips">
              <Button
                v-for="entity in group.entities"
                :key="entity.route"
                :label="entity.name"
                :icon="entity.icon"
                severity="secondary"
                outlined
                size="small"
                @click="navigateTo(entity.route)"
              />
            </div>
          </template>
        </Card>
      </div>
    </section>

    <!-- Demo Credentials -->
    <div class="demo-credentials">
      <i class="pi pi-user"></i>
      <span><strong>Login:</strong> admin/admin (admin) · bob/bob · june/june</span>
    </div>
  </div>
</template>

<style scoped>
.welcome-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 1rem 2rem;
}

/* Hero */
.welcome-hero {
  text-align: center;
  padding: 2.5rem 0;
}

.welcome-logo {
  width: 80px;
  height: 80px;
  margin-bottom: 0.5rem;
}

.welcome-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0;
  color: var(--p-primary-600);
}

.welcome-tagline {
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--p-surface-800);
  margin: 0.5rem 0 0.25rem;
}

.welcome-subtitle {
  font-size: 1rem;
  color: var(--p-surface-500);
  margin: 0 0 1.5rem;
}

.welcome-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

/* Sections */
.welcome-section {
  margin-bottom: 2rem;
}

.welcome-section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: var(--p-surface-700);
  border-bottom: 1px solid var(--p-surface-200);
  padding-bottom: 0.5rem;
}

/* Features Grid */
.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.feature-card {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--p-surface-50);
  border-radius: 8px;
  border: 1px solid var(--p-surface-100);
}

.feature-icon {
  font-size: 1.25rem;
  color: var(--p-primary-500);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.feature-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.feature-content strong {
  font-size: 0.9375rem;
  color: var(--p-surface-800);
}

.feature-content span {
  font-size: 0.8125rem;
  color: var(--p-surface-600);
  line-height: 1.4;
}

/* Architecture Grid */
.arch-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.arch-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: var(--p-surface-50);
  border-radius: 6px;
}

.arch-item code {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--p-primary-600);
}

.arch-item span {
  font-size: 0.75rem;
  color: var(--p-surface-600);
  line-height: 1.3;
}

/* Entity Groups */
.entity-groups {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.entity-group-card {
  border: 1px solid var(--p-surface-200);
}

.entity-group-card :deep(.p-card-body) {
  padding: 0.875rem 1rem;
}

.entity-group-card :deep(.p-card-title) {
  font-size: 1rem;
  padding-bottom: 0;
}

.entity-group-card :deep(.p-card-subtitle) {
  font-size: 0.8125rem;
  margin-top: 0.125rem;
}

.entity-group-card :deep(.p-card-content) {
  padding: 0.5rem 0 0 0 !important;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.entity-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Demo Credentials */
.demo-credentials {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  background: var(--p-surface-100);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: var(--p-surface-600);
}

.demo-credentials i {
  color: var(--p-surface-500);
}

/* Responsive */
@media (max-width: 768px) {
  .features-grid {
    grid-template-columns: 1fr;
  }

  .arch-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .welcome-title {
    font-size: 2rem;
  }

  .welcome-tagline {
    font-size: 1.25rem;
  }

  .welcome-actions {
    flex-direction: column;
  }

  .arch-grid {
    grid-template-columns: 1fr;
  }
}
</style>
