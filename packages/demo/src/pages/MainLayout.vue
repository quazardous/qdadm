<script setup>
/**
 * MainLayout - Authenticated app layout with UserImpersonator
 *
 * Custom layout that extends qdadm's AppLayout with a UserImpersonator
 * component for demonstrating permission-based UI changes.
 *
 * The UserImpersonator allows admins to switch to another user's view
 * to test how the UI adapts based on their permissions.
 */

import { ref, watch, onMounted, onUnmounted, computed, inject, provide, useSlots } from 'vue'
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import {
  useNavigation,
  useApp,
  useAuth,
  useGuardDialog,
  useNavContext,
  UnsavedChangesDialog,
  qdadmLogo,
  version as qdadmVersion
} from 'qdadm'
import Button from 'primevue/button'
import Breadcrumb from 'primevue/breadcrumb'
import UserImpersonator from '../components/UserImpersonator.vue'

const features = inject('qdadmFeatures', { poweredBy: true, breadcrumb: true })
const orchestrator = inject('qdadmOrchestrator')

// Guard dialog from shared store (registered by useBareForm/useForm when a form is active)
const guardDialog = useGuardDialog()

const router = useRouter()
const route = useRoute()
const app = useApp()
const { navSections, isNavActive, sectionHasActiveItem, handleNavClick } = useNavigation()
const { isAuthenticated, user, logout, authEnabled } = useAuth()

// Impersonation state detection
const AUTH_STORAGE_KEY = 'qdadm_demo_auth'
const isImpersonating = ref(false)
const originalUsername = ref(null)

function checkImpersonationState() {
  try {
    const auth = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}')
    isImpersonating.value = !!auth.originalUser
    originalUsername.value = auth.originalUser?.username || null
  } catch {
    isImpersonating.value = false
    originalUsername.value = null
  }
}

// LocalStorage key for collapsed sections state (namespaced by app)
const STORAGE_KEY = computed(() => `${app.shortName.toLowerCase()}_nav_collapsed`)

// Collapsed sections state (section title -> boolean)
const collapsedSections = ref({})

// Mobile sidebar state
const sidebarOpen = ref(false)
const MOBILE_BREAKPOINT = 768

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar() {
  sidebarOpen.value = false
}

// Check if we're on mobile
function isMobile() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

// Close sidebar on resize to desktop
function handleResize() {
  if (!isMobile() && sidebarOpen.value) {
    sidebarOpen.value = false
  }
}

/**
 * Load collapsed state from localStorage
 */
function loadCollapsedState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY.value)
    if (stored) {
      collapsedSections.value = JSON.parse(stored)
    }
  } catch (e) {
    console.warn('Failed to load nav state:', e)
  }
}

/**
 * Save collapsed state to localStorage
 */
function saveCollapsedState() {
  try {
    localStorage.setItem(STORAGE_KEY.value, JSON.stringify(collapsedSections.value))
  } catch (e) {
    console.warn('Failed to save nav state:', e)
  }
}

/**
 * Toggle section collapsed state
 */
function toggleSection(sectionTitle) {
  collapsedSections.value[sectionTitle] = !collapsedSections.value[sectionTitle]
  saveCollapsedState()
}

/**
 * Check if section should be shown expanded
 * - Never collapsed if it contains active item
 * - Otherwise respect user preference
 */
function isSectionExpanded(section) {
  if (sectionHasActiveItem(section)) {
    return true
  }
  return !collapsedSections.value[section.title]
}

// Load state on mount + setup resize listener
onMounted(() => {
  loadCollapsedState()
  checkImpersonationState()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// Auto-expand section when navigating to an item in it + close mobile sidebar
watch(() => route.path, () => {
  // Close mobile sidebar on navigation
  closeSidebar()

  for (const section of navSections.value) {
    if (sectionHasActiveItem(section) && collapsedSections.value[section.title]) {
      // Auto-expand but don't save (user can collapse again if they want)
      collapsedSections.value[section.title] = false
    }
  }
})

const userInitials = computed(() => {
  const username = user.value?.username
  if (!username) return '?'
  return username.substring(0, 2).toUpperCase()
})

const userDisplayName = computed(() => {
  return user.value?.username || user.value?.name || 'User'
})

const userSubtitle = computed(() => {
  return user.value?.email || user.value?.role || ''
})

function handleLogout() {
  const currentUser = user.value // capture before logout
  logout()
  // Business signal: auth:logout
  orchestrator?.signals?.emit('auth:logout', { user: currentUser })
  router.push({ name: 'login' })
}

// Check if slot content is provided
const slots = useSlots()
const hasSlotContent = computed(() => !!slots.default)

// Navigation context (breadcrumb + navlinks from route config)
const { breadcrumb: defaultBreadcrumb, navlinks: defaultNavlinks } = useNavContext()

// Allow child pages to override breadcrumb/navlinks via provide/inject
const breadcrumbOverride = ref(null)
const navlinksOverride = ref(null)
provide('qdadmBreadcrumbOverride', breadcrumbOverride)
provide('qdadmNavlinksOverride', navlinksOverride)

// Use override if provided, otherwise default from useNavContext
const breadcrumbItems = computed(() => breadcrumbOverride.value || defaultBreadcrumb.value)
const navlinks = computed(() => navlinksOverride.value || defaultNavlinks.value)

// Show breadcrumb if enabled, has items, and not on home page
const showBreadcrumb = computed(() => {
  if (!features.breadcrumb || breadcrumbItems.value.length === 0) return false
  // Don't show on home page (just "Dashboard" with no parents)
  if (route.name === 'dashboard') return false
  return true
})
</script>

<template>
  <div class="app-layout">
    <!-- Mobile overlay -->
    <div
      class="sidebar-overlay"
      :class="{ 'sidebar-overlay--visible': sidebarOpen }"
      @click="closeSidebar"
    ></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar--open': sidebarOpen }">
      <div class="sidebar-header">
        <div class="sidebar-header-top">
          <img v-if="app.logo" :src="app.logo" :alt="app.name" class="sidebar-logo" />
          <h1 v-else>{{ app.name }}</h1>
        </div>
        <span v-if="app.version" class="version">v{{ app.version }}</span>
      </div>

      <nav class="sidebar-nav">
        <div v-for="section in navSections" :key="section.title" class="nav-section">
          <div
            class="nav-section-title"
            :class="{ 'nav-section-active': sectionHasActiveItem(section) }"
            @click="toggleSection(section.title)"
          >
            <span>{{ section.title }}</span>
            <i
              class="nav-section-chevron pi"
              :class="isSectionExpanded(section) ? 'pi-chevron-down' : 'pi-chevron-right'"
            ></i>
          </div>
          <div class="nav-section-items" :class="{ 'nav-section-collapsed': !isSectionExpanded(section) }">
            <RouterLink
              v-for="item in section.items"
              :key="item.route"
              :to="{ name: item.route }"
              class="nav-item"
              :class="{ 'nav-item-active': isNavActive(item) }"
              @click="handleNavClick($event, item)"
            >
              <i :class="item.icon"></i>
              <span>{{ item.label }}</span>
            </RouterLink>
          </div>
        </div>
      </nav>

      <!-- User Impersonator for demo (admin can switch to another user's view) -->
      <UserImpersonator />

      <div v-if="authEnabled" class="sidebar-footer">
        <div class="user-info" :class="{ 'user-info--impersonating': isImpersonating }">
          <div class="user-avatar" :class="{ 'user-avatar--impersonating': isImpersonating }">
            {{ userInitials }}
          </div>
          <div class="user-details">
            <div class="user-name">{{ userDisplayName }}</div>
            <div class="user-role">
              <template v-if="isImpersonating">
                <i class="pi pi-user-edit" style="font-size: 0.7rem"></i>
                as {{ originalUsername }}
              </template>
              <template v-else>
                {{ userSubtitle }}
              </template>
            </div>
          </div>
          <Button
            icon="pi pi-sign-out"
            severity="secondary"
            text
            rounded
            @click="handleLogout"
            v-tooltip.top="'Logout'"
          />
        </div>
      </div>

      <div v-if="features.poweredBy" class="powered-by">
        <img :src="qdadmLogo" alt="qdadm" class="powered-by-logo" />
        <span class="powered-by-text">
          powered by <strong>qdadm</strong> v{{ qdadmVersion }}
        </span>
      </div>
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <!-- Mobile header bar -->
      <div class="mobile-header">
        <Button
          icon="pi pi-bars"
          severity="secondary"
          text
          class="hamburger-btn"
          @click="toggleSidebar"
          aria-label="Toggle menu"
        />
        <span class="mobile-header-title">{{ app.name }}</span>
      </div>

      <!-- Breadcrumb + Navlinks bar -->
      <div v-if="showBreadcrumb" class="layout-nav-bar">
        <Breadcrumb :model="breadcrumbItems" class="layout-breadcrumb">
          <template #item="{ item }">
            <RouterLink v-if="item.to" :to="item.to" class="breadcrumb-link">
              <i v-if="item.icon" :class="item.icon"></i>
              <span>{{ item.label }}</span>
            </RouterLink>
            <span v-else class="breadcrumb-current">
              <i v-if="item.icon" :class="item.icon"></i>
              <span>{{ item.label }}</span>
            </span>
          </template>
        </Breadcrumb>

        <!-- Navlinks (provided by PageNav for child routes) -->
        <div v-if="navlinks.length > 0" class="layout-navlinks">
          <template v-for="(link, index) in navlinks" :key="link.to?.name || index">
            <span v-if="index > 0" class="layout-navlinks-separator">|</span>
            <RouterLink
              :to="link.to"
              class="layout-navlink"
              :class="{ 'layout-navlink--active': link.active }"
            >
              {{ link.label }}
            </RouterLink>
          </template>
        </div>
      </div>

      <div class="page-content">
        <!-- Use slot if provided, otherwise RouterView for nested routes -->
        <slot v-if="hasSlotContent" />
        <RouterView v-else />
      </div>
    </main>

    <!-- Unsaved Changes Dialog (auto-rendered when a form registers guardDialog) -->
    <UnsavedChangesDialog
      v-if="guardDialog"
      :visible="guardDialog.visible.value"
      :saving="guardDialog.saving.value"
      :message="guardDialog.message"
      :hasOnSave="guardDialog.hasOnSave"
      @saveAndLeave="guardDialog.onSaveAndLeave"
      @leave="guardDialog.onLeave"
      @stay="guardDialog.onStay"
    />
    <!-- Note: guardDialog is a shallowRef, Vue auto-unwraps it in templates -->
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: var(--fad-sidebar-width, 15rem);
  background: var(--p-surface-800, #1e293b);
  color: var(--p-surface-0, white);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--p-surface-700, #334155);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.sidebar-header-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sidebar-header h1 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.sidebar-logo {
  max-height: 32px;
  max-width: 160px;
}

.version {
  font-size: 0.625rem;
  color: var(--p-surface-400, #94a3b8);
  background: var(--p-surface-700, #334155);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
}

.nav-section {
  margin-bottom: 0.5rem;
}

.nav-section-title {
  padding: 0.5rem 1.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-surface-400, #94a3b8);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.nav-section-title:hover {
  color: var(--p-surface-200, #e2e8f0);
}

.nav-section-active {
  color: var(--p-primary-400, #60a5fa);
}

.nav-section-chevron {
  font-size: 0.625rem;
  transition: transform 0.2s;
}

.nav-section-items {
  max-height: 500px;
  overflow: hidden;
  transition: max-height 0.2s ease-out, opacity 0.15s;
}

.nav-section-collapsed {
  max-height: 0;
  opacity: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1.5rem;
  color: var(--p-surface-300, #cbd5e1);
  text-decoration: none;
  transition: all 0.15s;
}

.nav-item:hover {
  background: var(--p-surface-700, #334155);
  color: var(--p-surface-0, white);
}

.nav-item-active {
  background: var(--p-primary-600, #2563eb);
  color: var(--p-surface-0, white);
}

.nav-item i {
  font-size: 1rem;
  width: 1.25rem;
  text-align: center;
}

.sidebar-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--p-surface-700, #334155);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--p-primary-600, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.user-role {
  font-size: 0.75rem;
  color: var(--p-surface-400, #94a3b8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Impersonation styles */
.user-info--impersonating {
  background: var(--p-orange-900, #7c2d12);
  border-radius: 0.5rem;
  padding: 0.5rem;
  margin: -0.5rem;
}

.user-info--impersonating .user-name {
  color: var(--p-orange-200, #fed7aa);
}

.user-info--impersonating .user-role {
  color: var(--p-orange-300, #fdba74);
}

.user-avatar--impersonating {
  background: var(--p-orange-500, #f97316);
}

.main-content {
  flex: 1;
  margin-left: var(--fad-sidebar-width, 15rem);
  background: var(--p-surface-50, #f8fafc);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.page-content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

/* Breadcrumb styles are in main.css */

/* Dark mode support */
.dark-mode .sidebar {
  background: var(--p-surface-900);
}

.dark-mode .main-content {
  background: var(--p-surface-900);
}

.powered-by {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--p-surface-700, #334155);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.powered-by:hover {
  opacity: 1;
}

.powered-by-logo {
  width: 1.25rem;
  height: 1.25rem;
}

.powered-by-text {
  font-size: 0.625rem;
  color: var(--p-surface-400, #94a3b8);
  letter-spacing: 0.02em;
}

.powered-by-text strong {
  color: var(--p-surface-300, #cbd5e1);
}

/* Nav bar (breadcrumb + navlinks) - aligned with sidebar header */
.layout-nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  padding-bottom: 0;
}

.layout-navlinks {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.layout-navlinks-separator {
  color: var(--p-surface-400, #94a3b8);
}

.layout-navlink {
  color: var(--p-primary-500, #3b82f6);
  text-decoration: none;
  transition: color 0.15s;
}

.layout-navlink:hover {
  color: var(--p-primary-700, #1d4ed8);
  text-decoration: underline;
}

.layout-navlink--active {
  color: var(--p-surface-700, #334155);
  font-weight: 500;
  pointer-events: none;
}

/* Override PrimeVue Breadcrumb styles for flat look */
.layout-nav-bar :deep(.p-breadcrumb) {
  background: transparent;
  border: none;
  padding: 0;
  border-radius: 0;
}

.layout-nav-bar :deep(.p-breadcrumb-list) {
  gap: 0.5rem;
}

.layout-nav-bar :deep(.p-breadcrumb-item-link),
.layout-nav-bar .breadcrumb-link {
  color: var(--p-primary-500, #3b82f6);
  text-decoration: none;
  font-size: 0.875rem;
}

.layout-nav-bar :deep(.p-breadcrumb-item-link:hover),
.layout-nav-bar .breadcrumb-link:hover {
  color: var(--p-primary-700, #1d4ed8);
  text-decoration: underline;
}

.layout-nav-bar .breadcrumb-current {
  color: var(--p-surface-600, #475569);
  font-size: 0.875rem;
}

.layout-nav-bar :deep(.p-breadcrumb-separator) {
  color: var(--p-surface-400, #94a3b8);
}

/* ============================================
   Mobile / Responsive Styles
   ============================================ */

.mobile-header {
  display: none;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--p-surface-0, white);
  border-bottom: 1px solid var(--p-surface-200, #e2e8f0);
  position: sticky;
  top: 0;
  z-index: 50;
}

.mobile-header-title {
  font-weight: 600;
  font-size: 1.125rem;
  color: var(--p-surface-800, #1e293b);
}

.hamburger-btn {
  display: none !important;
}

/* Sidebar overlay for mobile */
.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}

/* Tablet breakpoint (< 768px) */
@media (max-width: 767px) {
  .mobile-header {
    display: flex;
  }

  .hamburger-btn {
    display: flex !important;
  }

  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: none;
    width: min(80vw, 280px);
  }

  .sidebar.sidebar--open {
    transform: translateX(0);
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
  }

  .sidebar-overlay {
    display: block;
  }

  .sidebar-overlay.sidebar-overlay--visible {
    opacity: 1;
    pointer-events: auto;
  }

  .main-content {
    margin-left: 0;
  }

  .page-content {
    padding: 1rem;
  }

  .layout-nav-bar {
    padding: 1rem;
    padding-bottom: 0;
  }
}

/* Large tablet breakpoint (768px - 1023px) */
@media (min-width: 768px) and (max-width: 1023px) {
  .sidebar {
    width: 12rem;
  }

  .main-content {
    margin-left: 12rem;
  }
}
</style>
