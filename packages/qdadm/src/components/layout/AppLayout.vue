<script setup lang="ts">
/**
 * AppLayout - Generic admin layout with sidebar navigation
 *
 * Navigation is auto-built from moduleRegistry.
 * Branding comes from createQdadm({ app: {...} }) config.
 * Auth is optional via authAdapter.
 *
 * Usage:
 *   <AppLayout>
 *     <RouterView />
 *   </AppLayout>
 */

import { ref, watch, onMounted, onUnmounted, computed, inject, provide, useSlots } from 'vue'
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { useNavigation, type NavSection } from '../../composables/useNavigation'
import { useApp } from '../../composables/useApp'
import { useAuth } from '../../composables/useAuth'
import { useGuardDialog } from '../../composables/useGuardStore'
import { useNavContext, type BreadcrumbItem, type NavLinkItem } from '../../composables/useNavContext'
import Button from 'primevue/button'
import Breadcrumb from 'primevue/breadcrumb'
import UnsavedChangesDialog from '../dialogs/UnsavedChangesDialog.vue'
import SidebarBox from './SidebarBox.vue'
import qdadmLogo from '../../assets/logo.svg'
import { version as qdadmVersion } from '../../../package.json'

interface FeaturesConfig {
  poweredBy?: boolean
  breadcrumb?: boolean
  [key: string]: unknown
}

interface SignalBus {
  emit: (event: string, payload: unknown) => void
  [key: string]: unknown
}

interface UserData {
  username?: string
  name?: string
  email?: string
  role?: string
  [key: string]: unknown
}

const features = inject<FeaturesConfig>('qdadmFeatures', { poweredBy: true, breadcrumb: true })

// Guard dialog from shared store (registered by useBareForm/useForm when a form is active)
const guardDialog = useGuardDialog()

const router = useRouter()
const route = useRoute()
const app = useApp()
const { navSections, isNavActive, sectionHasActiveItem, handleNavClick } = useNavigation()
const { user, logout, authEnabled } = useAuth()
const signals = inject<SignalBus | null>('qdadmSignals', null)

// LocalStorage key for collapsed sections state (namespaced by app)
const STORAGE_KEY = computed<string>(() => `${app.shortName.toLowerCase()}_nav_collapsed`)

// Collapsed sections state (section title -> boolean)
const collapsedSections = ref<Record<string, boolean>>({})

// Mobile sidebar state
const sidebarOpen = ref<boolean>(false)
const MOBILE_BREAKPOINT = 768

// Desktop sidebar collapsed state
const sidebarCollapsed = ref<boolean>(false)
const COLLAPSED_STORAGE_KEY = computed<string>(() => `${app.shortName.toLowerCase()}_sidebar_collapsed`)

function toggleSidebar(): void {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar(): void {
  sidebarOpen.value = false
}

function toggleSidebarCollapse(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value
  saveSidebarCollapsed()
}

function loadSidebarCollapsed(): void {
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY.value)
    if (stored === 'true') {
      sidebarCollapsed.value = true
    }
  } catch {
    // Ignore
  }
}

function saveSidebarCollapsed(): void {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY.value, String(sidebarCollapsed.value))
  } catch {
    // Ignore
  }
}

// Check if we're on mobile
function isMobile(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT
}

// Close sidebar on resize to desktop
function handleResize(): void {
  if (!isMobile() && sidebarOpen.value) {
    sidebarOpen.value = false
  }
}

/**
 * Load collapsed state from localStorage
 */
function loadCollapsedState(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY.value)
    if (stored) {
      collapsedSections.value = JSON.parse(stored) as Record<string, boolean>
    }
  } catch (e) {
    console.warn('Failed to load nav state:', e)
  }
}

/**
 * Save collapsed state to localStorage
 */
function saveCollapsedState(): void {
  try {
    localStorage.setItem(STORAGE_KEY.value, JSON.stringify(collapsedSections.value))
  } catch (e) {
    console.warn('Failed to save nav state:', e)
  }
}

/**
 * Toggle section collapsed state
 */
function toggleSection(sectionTitle: string): void {
  collapsedSections.value[sectionTitle] = !collapsedSections.value[sectionTitle]
  saveCollapsedState()
}

/**
 * Check if section should be shown expanded
 * - Never collapsed if it contains active item
 * - Otherwise respect user preference
 */
function isSectionExpanded(section: NavSection): boolean {
  if (sectionHasActiveItem(section)) {
    return true
  }
  const title = section.title || section.label || ''
  return !collapsedSections.value[title]
}

// Load state on mount + setup resize listener
onMounted(() => {
  loadCollapsedState()
  loadSidebarCollapsed()
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
    const title = section.title || section.label || ''
    if (sectionHasActiveItem(section) && collapsedSections.value[title]) {
      // Auto-expand but don't save (user can collapse again if they want)
      collapsedSections.value[title] = false
    }
  }
})

const userInitials = computed<string>(() => {
  const userData = user.value as UserData | null
  const username = userData?.username
  if (!username) return '?'
  return username.substring(0, 2).toUpperCase()
})

const userDisplayName = computed<string>(() => {
  const userData = user.value as UserData | null
  return userData?.username || userData?.name || 'User'
})

const userSubtitle = computed<string>(() => {
  const userData = user.value as UserData | null
  return userData?.email || userData?.role || ''
})

function handleLogout(): void {
  logout()
  signals?.emit('auth:logout', { reason: 'user' })
  router.push({ name: 'login' })
}

/**
 * Handle sidebar header click
 * Mobile: close sidebar drawer
 * Desktop: navigate to home
 */
function handleHeaderClick(): void {
  if (isMobile()) {
    closeSidebar()
  } else {
    router.push({ name: 'home' })
  }
}

// Check if slot content is provided
const slots = useSlots()
const hasSlotContent = computed<boolean>(() => !!slots.default)

// Clear overrides on route change (before new page mounts)
// This ensures list pages get default breadcrumb, detail pages can override via PageNav
watch(() => route.fullPath, () => {
  breadcrumbOverride.value = null
  navlinksOverride.value = null
})

// Navigation context (breadcrumb + navlinks from route config)
// Entity data comes from activeStack (populated by useEntityItemPage/useForm)
const { breadcrumb: defaultBreadcrumb, navlinks: defaultNavlinks } = useNavContext()

// Allow child pages to override breadcrumb/navlinks via provide/inject
const breadcrumbOverride = ref<BreadcrumbItem[] | null>(null)
const navlinksOverride = ref<NavLinkItem[] | null>(null)
provide('qdadmBreadcrumbOverride', breadcrumbOverride)
provide('qdadmNavlinksOverride', navlinksOverride)

// Use override if provided, otherwise default from useNavContext
const breadcrumbItems = computed<BreadcrumbItem[]>(() => breadcrumbOverride.value || defaultBreadcrumb.value)
const navlinks = computed<NavLinkItem[]>(() => navlinksOverride.value || defaultNavlinks.value)

// Show breadcrumb if enabled, has items, and not on home page
const showBreadcrumb = computed<boolean>(() => {
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
    <aside class="sidebar" :class="{ 'sidebar--open': sidebarOpen, 'sidebar--collapsed': sidebarCollapsed }">
      <!-- Collapse toggle button (desktop only) - fixed position in sidebar -->
      <button
        class="sidebar-collapse-btn"
        @click="toggleSidebarCollapse"
        :title="sidebarCollapsed ? 'Expand menu' : 'Collapse menu'"
      >
        <i class="pi" :class="sidebarCollapsed ? 'pi-chevron-right' : 'pi-chevron-left'"></i>
      </button>
      <div class="sidebar-header" :data-short-name="app.shortName" @click="handleHeaderClick">
        <div class="sidebar-header-top">
          <img v-if="app.logo" :src="app.logo" :alt="app.name" class="sidebar-logo" />
          <h1 v-else>{{ app.name }}</h1>
        </div>
        <span v-if="app.version" class="version">v{{ app.version }}</span>
      </div>

      <nav class="sidebar-nav">
        <div v-for="section in navSections" :key="section.title || section.label" class="nav-section">
          <div
            class="nav-section-title"
            :class="{ 'nav-section-active': sectionHasActiveItem(section) }"
            @click="toggleSection(section.title || section.label || '')"
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

      <!-- Slot for custom content after navigation (e.g., impersonation controls) -->
      <div class="sidebar-slot">
        <slot name="sidebar-after-nav"></slot>
      </div>

      <SidebarBox
        v-if="authEnabled"
        id="user-zone"
        icon="pi-sign-out"
        :title="userDisplayName"
        :subtitle="userSubtitle"
        @click="handleLogout"
        v-tooltip.top="'Logout'"
      >
        <div class="user-avatar">{{ userInitials }}</div>
      </SidebarBox>

      <SidebarBox v-if="features.poweredBy" id="powered-by">
        <template #icon>
          <img :src="qdadmLogo" alt="qdadm" />
        </template>
        <template #subtitle-content>
          <span class="sidebar-box-subtitle">
            powered by <a href="https://github.com/quazardous/qdadm" target="_blank" rel="noopener" class="powered-by-link">qdadm</a> v{{ qdadmVersion }}
          </span>
        </template>
      </SidebarBox>
    </aside>

    <!-- Main content -->
    <main class="main-content" :class="{ 'main-content--sidebar-collapsed': sidebarCollapsed }">
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
      :saving="guardDialog.saving?.value ?? false"
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
/* =============================================================================
   MODERN ADMIN LAYOUT - VSCode/Material-inspired styling

   Design principles:
   - Compact spacing, no wasted space
   - Subtle hover states (slight bg change, no bold colors)
   - Light font weights
   - Fast, snappy transitions
   - Minimal borders, rely on bg contrast
   ============================================================================= */

.app-layout {
  display: flex;
  min-height: 100vh;
  font-family: var(--fad-font-family);
}

/* -----------------------------------------------------------------------------
   Sidebar
   ----------------------------------------------------------------------------- */

.sidebar {
  width: var(--fad-sidebar-width);
  background: var(--p-surface-800, #1e293b);
  color: var(--p-surface-100, #f1f5f9);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  transition: width var(--fad-transition-slow);
  font-size: var(--fad-font-size-sm);
  overflow: hidden;
}

/* Header - compact branding, clickable to home */
.sidebar-header {
  position: relative;
  padding: 0.75rem 1rem;
  padding-top: 0.5rem;
  border-bottom: 1px solid var(--p-surface-700, #334155);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  height: 3.75rem;
  box-sizing: border-box;
}

.sidebar-header:hover {
  background: var(--p-surface-700, #334155);
}

.sidebar-header::after {
  content: '';
  opacity: 0;
  transition: opacity var(--fad-transition-fast);
}

.sidebar-header-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding-left: 1.5rem;
}

.sidebar-header h1 {
  font-size: var(--fad-font-size-md);
  font-weight: var(--fad-font-weight-medium);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  transition: opacity var(--fad-transition-normal);
  color: var(--p-surface-0, white);
}

.sidebar-logo {
  max-height: 24px;
  max-width: 120px;
}

.version {
  font-size: var(--fad-font-size-2xs);
  color: var(--p-surface-400, #94a3b8);
  background: var(--p-surface-700, #334155);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  margin-left: 1.5rem;
  font-weight: var(--fad-font-weight-normal);
  white-space: nowrap;
}

/* Navigation - compact, subtle */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.nav-section {
  margin-bottom: var(--fad-nav-section-gap);
}

.nav-section-title {
  padding: var(--fad-nav-item-padding-y) var(--fad-nav-item-padding-x);
  padding-left: 1rem;
  font-size: var(--fad-font-size-xs);
  font-weight: var(--fad-font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-surface-500, #64748b);
  display: flex;
  height: 1.5rem;
  transition: height var(--fad-transition-slow), padding var(--fad-transition-slow), opacity var(--fad-transition-fast);
  overflow: hidden;
  white-space: nowrap;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: color var(--fad-transition-fast);
}

.nav-section-title:hover {
  color: var(--p-surface-300, #cbd5e1);
}

.nav-section-active {
  color: var(--p-primary-300, #93c5fd);
}

.nav-section-chevron {
  font-size: 0.5rem;
  transition: transform var(--fad-transition-fast);
  opacity: 0.6;
}

.nav-section-items {
  max-height: 500px;
  overflow: hidden;
  transition: max-height var(--fad-transition-normal), opacity var(--fad-transition-fast);
}

.nav-section-collapsed {
  max-height: 0;
  opacity: 0;
}

/* Sidebar slot */
.sidebar-slot {
  position: relative;
  z-index: 10;
}

/* Nav items - compact, subtle hover */
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: var(--fad-nav-item-padding-y) var(--fad-nav-item-padding-x);
  padding-left: 1rem;
  color: var(--p-surface-300, #cbd5e1);
  text-decoration: none;
  font-size: var(--fad-font-size-sm);
  font-weight: var(--fad-font-weight-normal);
  border-radius: 0;
  transition: background var(--fad-transition-fast), color var(--fad-transition-fast);
}

.nav-item span {
  white-space: nowrap;
}

.nav-item:hover {
  background: var(--p-surface-700, #334155);
  color: var(--p-surface-0, white);
}

.nav-item-active {
  background: var(--p-surface-700, #334155);
  color: var(--p-primary-300, #93c5fd);
  border-left: 2px solid var(--p-primary-400, #60a5fa);
  padding-left: calc(1rem - 2px);
}

.nav-item-active:hover {
  background: var(--p-surface-600, #475569);
}

.nav-item i {
  font-size: var(--fad-nav-icon-size);
  width: 1.125rem;
  text-align: center;
  opacity: 0.8;
}

.nav-item-active i {
  opacity: 1;
}

/* -----------------------------------------------------------------------------
   Main Content
   ----------------------------------------------------------------------------- */

.main-content {
  flex: 1;
  margin-left: var(--fad-sidebar-width);
  background: var(--p-surface-50, #f8fafc);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  transition: margin-left var(--fad-transition-slow);
  overflow-y: auto;
}

.page-content {
  flex: 1;
  padding: 1rem;
}

/* Dark mode support */
.dark-mode .sidebar {
  background: var(--p-surface-900);
}

.dark-mode .main-content {
  background: var(--p-surface-900);
}

/* User zone - overrides for sidebar-box */
#user-zone .user-avatar {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--p-surface-600, #475569);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fad-font-size-xs);
  font-weight: var(--fad-font-weight-medium);
  /* Fade in with delay when sidebar opens */
  opacity: 1;
  transition: opacity 0.1s ease 0.2s;
}

/* Avatar: disappear IMMEDIATELY when closing */
.sidebar--collapsed #user-zone .user-avatar {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0s, visibility 0s;
}

/* Powered by - overrides for sidebar-box */
#powered-by {
  height: 2rem;
  opacity: 0.5;
  transition: opacity var(--fad-transition-fast), background var(--fad-transition-fast);
  cursor: default;
}

#powered-by:hover {
  opacity: 0.8;
  background: transparent;
}

#powered-by .sidebar-box-icon {
  width: 1rem;
  height: 1rem;
}

#powered-by .sidebar-box-icon img {
  width: 100%;
  height: 100%;
}

.powered-by-link {
  color: var(--p-surface-300, #cbd5e1);
  text-decoration: none;
  font-weight: var(--fad-font-weight-medium);
  transition: color var(--fad-transition-fast);
}

.powered-by-link:hover {
  color: var(--p-primary-300, #93c5fd);
}

/* Nav bar (breadcrumb + navlinks) - compact */
.layout-nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  padding-bottom: 0;
}

.layout-navlinks {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: var(--fad-font-size-sm);
}

.layout-navlinks-separator {
  color: var(--p-surface-400, #94a3b8);
  opacity: 0.5;
}

.layout-navlink {
  color: var(--p-primary-500, #3b82f6);
  text-decoration: none;
  transition: color var(--fad-transition-fast);
}

.layout-navlink:hover {
  color: var(--p-primary-600, #2563eb);
}

.layout-navlink--active {
  color: var(--p-surface-600, #475569);
  font-weight: var(--fad-font-weight-medium);
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
  gap: 0.375rem;
}

.layout-nav-bar :deep(.p-breadcrumb-item-link),
.layout-nav-bar .breadcrumb-link {
  color: var(--p-primary-500, #3b82f6);
  text-decoration: none;
  font-size: var(--fad-font-size-sm);
}

.layout-nav-bar :deep(.p-breadcrumb-item-link:hover),
.layout-nav-bar .breadcrumb-link:hover {
  color: var(--p-primary-600, #2563eb);
}

.layout-nav-bar .breadcrumb-current {
  color: var(--p-surface-600, #475569);
  font-size: var(--fad-font-size-sm);
}

.layout-nav-bar :deep(.p-breadcrumb-separator) {
  color: var(--p-surface-400, #94a3b8);
  opacity: 0.5;
}

/* -----------------------------------------------------------------------------
   Sidebar Collapse Button (Desktop) - minimal toggle
   ----------------------------------------------------------------------------- */

.sidebar-collapse-btn {
  position: absolute;
  left: 0.5rem;
  top: 0.5rem;
  padding: 0.25rem;
  background: transparent;
  border: none;
  border-radius: var(--fad-radius-sm);
  color: var(--p-surface-500, #64748b);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--fad-transition-fast), color var(--fad-transition-fast);
  z-index: 10;
}

.sidebar-collapse-btn:hover {
  background: var(--p-surface-700, #334155);
  color: var(--p-surface-200, #e2e8f0);
}

.sidebar-collapse-btn i {
  font-size: 0.75rem;
}

/* -----------------------------------------------------------------------------
   Sidebar Collapsed State (Desktop) - Icon-only mini sidebar
   ----------------------------------------------------------------------------- */

.sidebar--collapsed {
  width: var(--fad-sidebar-width-collapsed) !important;
}

.sidebar--collapsed .sidebar-header {
  padding: 0.25rem;
  padding-top: 1.75rem;
  align-items: center;
  justify-content: flex-start;
}

.sidebar--collapsed .sidebar-header h1,
.sidebar--collapsed .sidebar-header .version,
.sidebar--collapsed .sidebar-logo {
  display: none;
}

/* Show a small icon/initial in collapsed header - positioned absolutely to stay in place during animation */
.sidebar-header::after {
  content: attr(data-short-name);
  position: absolute;
  left: calc(var(--fad-sidebar-width-collapsed) / 2);
  top: 2rem;
  transform: translateX(-50%);
  font-size: var(--fad-font-size-xs);
  font-weight: var(--fad-font-weight-medium);
  color: var(--p-surface-400);
  opacity: 0;
  transition: opacity var(--fad-transition-fast);
  pointer-events: none;
}

.sidebar--collapsed .sidebar-header::after {
  opacity: 1;
}

.sidebar--collapsed .sidebar-nav {
  padding: 0.25rem 0;
  overflow-y: hidden;
}

.sidebar--collapsed .nav-section-title {
  height: 0;
  padding-top: 0;
  padding-bottom: 0;
  opacity: 0;
  pointer-events: none;
}

/* In collapsed mode, slot stays visible but content is hidden via child styles */

.sidebar--collapsed .nav-section-items {
  max-height: none !important;
  opacity: 1 !important;
}

.sidebar--collapsed .nav-item {
  padding: 0.5rem 0;
  gap: 0;
  border-left: none !important;
  justify-content: center;
}

.sidebar--collapsed .nav-item-active {
  border-left: none !important;
  padding: 0.5rem 0;
}

.sidebar--collapsed .nav-item span {
  display: none;
}

.sidebar--collapsed .nav-item i {
  width: auto;
}

/* Powered-by collapsed: smaller height */
.sidebar--collapsed #powered-by {
  height: 2rem;
}

.main-content--sidebar-collapsed {
  margin-left: var(--fad-sidebar-width-collapsed) !important;
}

/* -----------------------------------------------------------------------------
   Mobile / Responsive Styles
   ----------------------------------------------------------------------------- */

.mobile-header {
  display: none;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--p-surface-0, white);
  border-bottom: 1px solid var(--p-surface-200, #e2e8f0);
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--fad-header-height);
}

.mobile-header-title {
  font-weight: var(--fad-font-weight-medium);
  font-size: var(--fad-font-size-md);
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
  background: rgba(0, 0, 0, 0.4);
  z-index: 99;
  opacity: 0;
  transition: opacity var(--fad-transition-normal);
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

  /* Hide collapse button on mobile */
  .sidebar-collapse-btn {
    display: none !important;
  }

  .sidebar {
    transform: translateX(-100%);
    transition: transform var(--fad-transition-normal);
    box-shadow: none;
    /* Mobile: fullscreen */
    width: 100vw !important;
    height: 100dvh;
    max-height: 100dvh;
    overflow-y: auto;
  }

  .sidebar.sidebar--open {
    transform: translateX(0);
    box-shadow: none;
  }

  /* Ignore collapsed state on mobile - restore all elements */
  .sidebar.sidebar--collapsed {
    width: 100vw !important;
  }

  .sidebar.sidebar--collapsed .sidebar-header {
    padding: 0.75rem 1rem;
    align-items: flex-start;
  }

  .sidebar.sidebar--collapsed .sidebar-header::after {
    display: none;
  }

  .sidebar.sidebar--collapsed .sidebar-header h1,
  .sidebar.sidebar--collapsed .sidebar-header .version,
  .sidebar.sidebar--collapsed .sidebar-logo {
    display: block;
    opacity: 1;
    width: auto;
  }

  .sidebar.sidebar--collapsed .nav-section-title {
    opacity: 1;
    height: auto;
    padding: var(--fad-nav-item-padding-y) var(--fad-nav-item-padding-x);
    padding-left: 1rem;
    pointer-events: auto;
  }

  .sidebar.sidebar--collapsed .nav-item {
    justify-content: flex-start;
    padding: var(--fad-nav-item-padding-y) var(--fad-nav-item-padding-x);
    padding-left: 1rem;
    gap: 0.5rem;
  }

  .sidebar.sidebar--collapsed .nav-item span {
    display: inline;
    opacity: 1;
    width: auto;
  }

  .sidebar.sidebar--collapsed .nav-item i {
    font-size: var(--fad-nav-icon-size);
    width: 1.125rem;
  }

  .sidebar.sidebar--collapsed #powered-by,
  .sidebar.sidebar--collapsed #user-zone {
    display: flex;
  }

  .sidebar.sidebar--collapsed #user-zone .user-avatar,
  .sidebar.sidebar--collapsed .sidebar-box-content {
    opacity: 1;
    width: auto;
  }

  .sidebar-overlay {
    display: block;
  }

  .sidebar-overlay.sidebar-overlay--visible {
    opacity: 1;
    pointer-events: auto;
  }

  .main-content,
  .main-content--sidebar-collapsed {
    margin-left: 0 !important;
  }

  .page-content {
    padding: 0.75rem;
  }

  .layout-nav-bar {
    padding: 0.75rem;
    padding-bottom: 0;
  }
}

/* Large tablet breakpoint (768px - 1023px) */
@media (min-width: 768px) and (max-width: 1023px) {
  .sidebar {
    width: var(--fad-sidebar-width-tablet);
  }

  .main-content {
    margin-left: var(--fad-sidebar-width-tablet);
  }

  .main-content--sidebar-collapsed {
    margin-left: var(--fad-sidebar-width-collapsed) !important;
  }
}
</style>
