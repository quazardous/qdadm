<script setup>
/**
 * WelcomePage - Demo home page with qdadm presentation
 */
import { usePageTitle, qdadmLogo } from 'qdadm'
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

usePageTitle('Welcome')

const router = useRouter()

function openGitHub() {
  window.open('https://github.com/quazardous/qdadm', '_blank')
}

const features = [
  { icon: 'pi pi-box', title: 'Entity Managers', desc: 'CRUD operations with permissions, caching, and validation' },
  { icon: 'pi pi-list', title: 'List Pages', desc: 'Sortable tables with filters, search, pagination, and bulk actions' },
  { icon: 'pi pi-pencil', title: 'Form Builder', desc: 'Auto-generated forms with dirty state tracking and unsaved changes guard' },
  { icon: 'pi pi-shield', title: 'Permissions', desc: 'Row-level and entity-level access control (canRead, canCreate, canUpdate, canDelete)' },
  { icon: 'pi pi-sitemap', title: 'Child Routes', desc: 'Navigate to filtered child entity lists with auto-breadcrumbs' },
  { icon: 'pi pi-cog', title: 'Module System', desc: 'Auto-discovery of routes and navigation from modules' }
]
</script>

<template>
  <div class="welcome-page">
    <div class="welcome-hero">
      <img :src="qdadmLogo" alt="qdadm" class="welcome-logo" />
      <h1 class="welcome-title">qdadm</h1>
      <p class="welcome-tagline">Vue 3 framework for admin dashboards with PrimeVue</p>
      <div class="welcome-actions">
        <Button label="Browse Books" icon="pi pi-book" @click="router.push({ name: 'book' })" />
        <Button label="View on GitHub" icon="pi pi-github" severity="secondary" outlined
          @click="openGitHub" />
      </div>
    </div>

    <div class="welcome-features">
      <h2>Features</h2>
      <div class="features-grid">
        <div v-for="feature in features" :key="feature.title" class="feature-card">
          <i :class="feature.icon" class="feature-icon"></i>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.desc }}</p>
        </div>
      </div>
    </div>

    <div class="welcome-demo">
      <h2>This Demo</h2>
      <p>
        The <strong>Book Manager</strong> demo showcases qdadm capabilities with a library management system:
      </p>
      <ul>
        <li><strong>Books</strong> - Full CRUD with genre filter (everyone can edit, admin-only delete)</li>
        <li><strong>Genres</strong> - Parent entity with child route to filtered books</li>
        <li><strong>Loans</strong> - Ownership-based access (users see only their loans)</li>
        <li><strong>Users</strong> - Admin-only access for user management</li>
      </ul>
      <p class="demo-credentials">
        <strong>Demo credentials:</strong> admin / admin (admin), bob / bob or june / june (regular users)
      </p>
    </div>
  </div>
</template>

<style scoped>
.welcome-page {
  max-width: 900px;
  margin: 0 auto;
}

.welcome-hero {
  text-align: center;
  padding: 2rem 0 3rem;
}

.welcome-logo {
  width: 120px;
  height: 120px;
  margin-bottom: 1rem;
}

.welcome-title {
  font-size: 3rem;
  font-weight: 800;
  margin: 0;
  color: var(--p-primary-600);
}

.welcome-tagline {
  font-size: 1.25rem;
  color: var(--p-surface-600);
  margin: 0.5rem 0 2rem;
}

.welcome-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.welcome-features {
  margin-bottom: 3rem;
}

.welcome-features h2,
.welcome-demo h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: var(--p-surface-700);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.feature-card {
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  padding: 1.25rem;
}

.feature-icon {
  font-size: 1.5rem;
  color: var(--p-primary-500);
  margin-bottom: 0.5rem;
}

.feature-card h3 {
  font-size: 1rem;
  margin: 0 0 0.5rem;
  color: var(--p-surface-800);
}

.feature-card p {
  font-size: 0.875rem;
  color: var(--p-surface-600);
  margin: 0;
  line-height: 1.4;
}

.welcome-demo {
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  padding: 1.5rem;
}

.welcome-demo p {
  margin: 0 0 1rem;
  color: var(--p-surface-700);
}

.welcome-demo ul {
  margin: 0 0 1rem;
  padding-left: 1.5rem;
}

.welcome-demo li {
  margin-bottom: 0.5rem;
  color: var(--p-surface-700);
}

.demo-credentials {
  background: var(--p-blue-50);
  border-left: 3px solid var(--p-blue-500);
  padding: 0.75rem 1rem;
  margin: 1rem 0 0 !important;
  border-radius: 0 4px 4px 0;
}
</style>
