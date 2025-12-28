/**
 * Standard Zone Definitions
 *
 * Canonical zones for qdadm layouts. Use these constants to prevent typos
 * and ensure consistency across the application.
 *
 * Zone categories:
 * - LAYOUT: Top-level structural zones (header, footer, etc.)
 * - LIST: Zones specific to list/table pages
 * - FORM: Zones specific to form pages
 */

// ============================================================================
// Layout Zones (BaseLayout)
// ============================================================================

/**
 * Layout zones for the base application structure.
 * These zones are present in all page layouts.
 */
export const LAYOUT_ZONES = {
  /** Top bar - logo, user menu, global actions */
  HEADER: 'header',
  /** Navigation menu - sidebar or top navigation */
  MENU: 'menu',
  /** Breadcrumb trail - current location path */
  BREADCRUMB: 'breadcrumb',
  /** Side panel - optional sidebar content */
  SIDEBAR: 'sidebar',
  /** Main content area - primary page content */
  MAIN: 'main',
  /** Footer bar - copyright, links, version */
  FOOTER: 'footer',
  /** Toast notifications overlay - feedback messages */
  TOASTER: 'toaster'
}

// ============================================================================
// List Page Zones (ListLayout)
// ============================================================================

/**
 * Zones specific to list/table pages.
 * Used by ListLayout and defineListPage.
 */
export const LIST_ZONES = {
  /** Before table - actions bar, filters, search */
  BEFORE_TABLE: 'before-table',
  /** The data table itself */
  TABLE: 'table',
  /** Below table content - summary, bulk actions */
  AFTER_TABLE: 'after-table',
  /** Pagination controls */
  PAGINATION: 'pagination'
}

// ============================================================================
// Form Page Zones (FormLayout)
// ============================================================================

/**
 * Zones specific to form pages.
 * Used by FormLayout and defineFormPage.
 */
export const FORM_ZONES = {
  /** Form header - title, back button, status indicators */
  FORM_HEADER: 'form-header',
  /** Form field groups - organized input fields */
  FORM_FIELDS: 'form-fields',
  /** Optional tabbed sections for complex forms */
  FORM_TABS: 'form-tabs',
  /** Action buttons - save, cancel, delete */
  ACTIONS: 'actions'
}

// ============================================================================
// Dashboard Zones (DashboardLayout)
// ============================================================================

/**
 * Zones specific to dashboard pages.
 * Used by DashboardLayout and dashboard modules.
 */
export const DASHBOARD_ZONES = {
  /** Stats cards area - KPI cards, metrics */
  STATS: 'dashboard-stats',
  /** Widgets area - main dashboard widgets */
  WIDGETS: 'dashboard-widgets',
  /** Recent activity area - activity log, recent changes */
  RECENT_ACTIVITY: 'dashboard-recent-activity'
}

// ============================================================================
// Combined Zone Constant (ZONES)
// ============================================================================

/**
 * All standard zones in a single object.
 * Provides flat access: ZONES.HEADER, ZONES.TABLE, etc.
 */
export const ZONES = {
  // Layout zones
  HEADER: LAYOUT_ZONES.HEADER,
  MENU: LAYOUT_ZONES.MENU,
  BREADCRUMB: LAYOUT_ZONES.BREADCRUMB,
  SIDEBAR: LAYOUT_ZONES.SIDEBAR,
  MAIN: LAYOUT_ZONES.MAIN,
  FOOTER: LAYOUT_ZONES.FOOTER,
  TOASTER: LAYOUT_ZONES.TOASTER,
  // List zones
  BEFORE_TABLE: LIST_ZONES.BEFORE_TABLE,
  TABLE: LIST_ZONES.TABLE,
  AFTER_TABLE: LIST_ZONES.AFTER_TABLE,
  PAGINATION: LIST_ZONES.PAGINATION,
  // Form zones
  FORM_HEADER: FORM_ZONES.FORM_HEADER,
  FORM_FIELDS: FORM_ZONES.FORM_FIELDS,
  FORM_TABS: FORM_ZONES.FORM_TABS,
  ACTIONS: FORM_ZONES.ACTIONS,
  // Dashboard zones
  DASHBOARD_STATS: DASHBOARD_ZONES.STATS,
  DASHBOARD_WIDGETS: DASHBOARD_ZONES.WIDGETS,
  DASHBOARD_RECENT_ACTIVITY: DASHBOARD_ZONES.RECENT_ACTIVITY
}

// ============================================================================
// Registration Helper
// ============================================================================

/**
 * Register all standard zones in a ZoneRegistry.
 *
 * Call this during Kernel bootstrap to establish the canonical zones
 * that layouts and modules can rely on.
 *
 * @param {import('./ZoneRegistry.js').ZoneRegistry} registry - The zone registry instance
 * @returns {import('./ZoneRegistry.js').ZoneRegistry} - The registry for chaining
 *
 * @example
 * ```js
 * import { createZoneRegistry, registerStandardZones } from 'qdadm/zones'
 *
 * const registry = createZoneRegistry()
 * registerStandardZones(registry)
 *
 * // Now all standard zones are defined
 * registry.registerBlock(ZONES.HEADER, { component: Logo, weight: 10 })
 * ```
 */
export function registerStandardZones(registry) {
  // Layout zones
  registry.defineZone(LAYOUT_ZONES.HEADER)
  registry.defineZone(LAYOUT_ZONES.MENU)
  registry.defineZone(LAYOUT_ZONES.BREADCRUMB)
  registry.defineZone(LAYOUT_ZONES.SIDEBAR)
  registry.defineZone(LAYOUT_ZONES.MAIN)
  registry.defineZone(LAYOUT_ZONES.FOOTER)
  registry.defineZone(LAYOUT_ZONES.TOASTER)

  // List page zones
  registry.defineZone(LIST_ZONES.BEFORE_TABLE)
  registry.defineZone(LIST_ZONES.TABLE)
  registry.defineZone(LIST_ZONES.AFTER_TABLE)
  registry.defineZone(LIST_ZONES.PAGINATION)

  // Form page zones
  registry.defineZone(FORM_ZONES.FORM_HEADER)
  registry.defineZone(FORM_ZONES.FORM_FIELDS)
  registry.defineZone(FORM_ZONES.FORM_TABS)
  registry.defineZone(FORM_ZONES.ACTIONS)

  // Dashboard zones
  registry.defineZone(DASHBOARD_ZONES.STATS)
  registry.defineZone(DASHBOARD_ZONES.WIDGETS)
  registry.defineZone(DASHBOARD_ZONES.RECENT_ACTIVITY)

  return registry
}

/**
 * Get all standard zone names as an array.
 *
 * Useful for validation or iteration.
 *
 * @returns {string[]} - Array of all standard zone names
 */
export function getStandardZoneNames() {
  return Object.values(ZONES)
}
