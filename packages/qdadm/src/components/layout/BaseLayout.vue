<script setup>
/**
 * BaseLayout - Root of the 3-level layout inheritance chain
 *
 * Defines all standard zones for the admin application:
 * - header: Top bar with branding
 * - menu: Navigation sidebar
 * - breadcrumb: Breadcrumb trail
 * - sidebar: Optional secondary sidebar (empty by default)
 * - main: Primary content area (slot for child layouts)
 * - footer: Footer with optional branding
 * - toaster: Toast notifications overlay
 * - user-info: User info in sidebar (separate from footer)
 *
 * Each zone renders blocks from ZoneRegistry, with defaults
 * provided when no blocks are registered.
 *
 * Inheritance pattern (Twig-style):
 *   BaseLayout renders Zone components for each area
 *   -> Child layouts (List, Form, Dashboard) extend by providing content to main zone
 *   -> Entity pages extend child layouts with entity-specific customizations
 *
 * Usage:
 * <BaseLayout>
 *   <template #main>
 *     <!-- Page content here -->
 *   </template>
 * </BaseLayout>
 *
 * Or with RouterView for nested routes:
 * <BaseLayout />
 */
import { useSlots, provide, ref, inject } from 'vue'
import { RouterView } from 'vue-router'
import ConfirmDialog from 'primevue/confirmdialog'
import Zone from './Zone.vue'
import { LAYOUT_ZONES } from '../../zones/zones.js'
import { useGuardDialog } from '../../composables/useGuardStore'
import UnsavedChangesDialog from '../dialogs/UnsavedChangesDialog.vue'

// Default components for zones
import DefaultHeader from './defaults/DefaultHeader.vue'
import DefaultMenu from './defaults/DefaultMenu.vue'
import DefaultFooter from './defaults/DefaultFooter.vue'
import DefaultUserInfo from './defaults/DefaultUserInfo.vue'
import DefaultBreadcrumb from './defaults/DefaultBreadcrumb.vue'
import DefaultToaster from './defaults/DefaultToaster.vue'

const slots = useSlots()
const hasMainSlot = !!slots.main

// Guard dialog from shared store (registered by useBareForm/useForm when a form is active)
const guardDialog = useGuardDialog()

// Provide breadcrumb/navlinks override mechanism for child pages
const breadcrumbOverride = ref(null)
const navlinksOverride = ref(null)
provide('qdadmBreadcrumbOverride', breadcrumbOverride)
provide('qdadmNavlinksOverride', navlinksOverride)
</script>

<template>
  <div class="base-layout">
    <!-- Sidebar (contains header, menu, user-info, footer) -->
    <aside class="sidebar">
      <!-- Header zone: branding, logo -->
      <Zone
        :name="LAYOUT_ZONES.HEADER"
        :default-component="DefaultHeader"
      />

      <!-- Menu zone: navigation -->
      <Zone
        :name="LAYOUT_ZONES.MENU"
        :default-component="DefaultMenu"
      />

      <!-- User info (special zone between menu and footer) -->
      <DefaultUserInfo />

      <!-- Footer zone: powered by, etc. -->
      <Zone
        :name="LAYOUT_ZONES.FOOTER"
        :default-component="DefaultFooter"
      />
    </aside>

    <!-- Main content area -->
    <div class="main-area">
      <!-- Breadcrumb zone -->
      <Zone
        :name="LAYOUT_ZONES.BREADCRUMB"
        :default-component="DefaultBreadcrumb"
      />

      <!-- Sidebar zone (optional secondary sidebar) -->
      <div class="content-with-sidebar">
        <Zone :name="LAYOUT_ZONES.SIDEBAR" />

        <!-- Main zone: primary content -->
        <main class="main-content">
          <Zone :name="LAYOUT_ZONES.MAIN">
            <!-- Allow slot override or RouterView for nested routes -->
            <template v-if="hasMainSlot">
              <slot name="main" />
            </template>
            <RouterView v-else />
          </Zone>
        </main>
      </div>
    </div>

    <!-- Toaster zone: toast notifications -->
    <Zone
      :name="LAYOUT_ZONES.TOASTER"
      :default-component="DefaultToaster"
    />

    <!-- Confirm dialog (global) -->
    <ConfirmDialog />

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
  </div>
</template>

<style scoped>
.base-layout {
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

.main-area {
  flex: 1;
  margin-left: var(--fad-sidebar-width, 15rem);
  background: var(--p-surface-50, #f8fafc);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.content-with-sidebar {
  display: flex;
  flex: 1;
}

.main-content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

/* Dark mode support */
.dark-mode .sidebar {
  background: var(--p-surface-900);
}

.dark-mode .main-area {
  background: var(--p-surface-900);
}
</style>
