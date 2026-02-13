<script setup lang="ts">
/**
 * NotFoundPage - Default 404 page
 *
 * Simple page with link to home. Can be replaced via pages.notFound option.
 */
import { computed, type ComputedRef } from 'vue'
import { useRouter, type RouteRecordName } from 'vue-router'

const router = useRouter()

const homeRoute: ComputedRef<RouteRecordName | string> = computed(() => {
  // Find home route (first route or named 'home'/'dashboard')
  const routes = router.getRoutes()
  const home = routes.find(r => r.name === 'home' || r.name === 'dashboard')
  return home?.name || '/'
})

function goHome(): void {
  if (typeof homeRoute.value === 'string' && homeRoute.value.startsWith('/')) {
    router.push(homeRoute.value)
  } else {
    router.push({ name: homeRoute.value })
  }
}
</script>

<template>
  <div class="not-found-page">
    <div class="not-found-content">
      <div class="not-found-code">404</div>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist or has been moved.</p>
      <button class="home-link" @click="goHome">
        <i class="pi pi-home"></i>
        Back to Home
      </button>
    </div>
  </div>
</template>

<style scoped>
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--p-surface-ground, #f8fafc);
}

.not-found-content {
  text-align: center;
  padding: 2rem;
}

.not-found-code {
  font-size: 8rem;
  font-weight: 700;
  color: var(--p-primary-color, #3b82f6);
  line-height: 1;
  margin-bottom: 1rem;
  opacity: 0.8;
}

h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--p-text-color, #1e293b);
  margin: 0 0 0.5rem 0;
}

p {
  color: var(--p-text-muted-color, #64748b);
  margin: 0 0 2rem 0;
}

.home-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--p-primary-color, #3b82f6);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.home-link:hover {
  background: var(--p-primary-600, #2563eb);
}
</style>
