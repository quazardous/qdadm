/**
 * Module Registry - Auto-discovery and registration system
 *
 * Each module provides an init.js that registers:
 * - Routes & Navigation (via registry)
 * - Zone blocks (via zones)
 * - Signal handlers (via signals)
 * - Hooks (via hooks)
 *
 * Usage in module (modules/agents/init.js):
 *
 *   export function init({ registry, zones, signals, hooks }) {
 *     // Routes & Navigation
 *     registry.addRoutes('agents', [...])
 *     registry.addNavItem({ section: 'Simulation', route: 'agents', ... })
 *     registry.addRouteFamily('agents', ['agent-'])
 *
 *     // Zone blocks
 *     zones.registerBlock('agents-list-header', { id: 'agents-header', component: Header })
 *
 *     // Signal handlers
 *     signals.on('agents:created', handleCreated)
 *
 *     // Hooks
 *     hooks.register('agents:presave', validateAgent)
 *   }
 */

import type { RouteRecordRaw, RouteComponent, RouteRecordRedirectOption } from 'vue-router'
import type { HookRegistry } from '../hooks/HookRegistry'
import type { ZoneRegistry } from '../zones/ZoneRegistry'
import type { SignalBus } from '../kernel/SignalBus'

/**
 * Parent entity configuration for child routes
 */
export interface ParentConfig {
  entity: string
  param: string
  foreignKey?: string
  itemRoute?: string
}

/**
 * Route meta with qdadm extensions
 */
export interface ModuleRouteMeta {
  entity?: string
  parent?: ParentConfig
  navLabel?: string
  layout?: 'list' | 'form' | 'dashboard' | 'base' | string
  title?: string
  [key: string]: unknown
}

/**
 * Route definition with meta
 *
 * This is a simplified route type that captures what modules use.
 * It's compatible with vue-router's RouteRecordRaw.
 */
export interface ModuleRoute {
  path: string
  name?: string
  component?: RouteComponent
  components?: Record<string, RouteComponent>
  redirect?: RouteRecordRedirectOption
  props?: boolean | Record<string, unknown> | ((to: unknown) => Record<string, unknown>)
  children?: ModuleRoute[]
  meta?: ModuleRouteMeta
}

/**
 * Navigation item
 */
export interface NavItem {
  route: string
  label: string
  icon?: string
  entity?: string
  exact?: boolean
}

/**
 * Navigation item with section
 */
export interface NavItemWithSection extends NavItem {
  section: string
}

/**
 * Navigation section
 */
export interface NavSection {
  title: string
  items: NavItem[]
}

/**
 * Route options for addRoutes
 */
export interface AddRoutesOptions {
  entity?: string
  parent?: ParentConfig
  label?: string
  layout?: 'list' | 'form' | 'dashboard' | 'base' | string
}

/**
 * Entity configuration or manager
 */
export type EntityConfig = Record<string, unknown>

/**
 * Module init context
 */
export interface ModuleInitContext {
  registry: typeof registry
  zones?: ZoneRegistry
  signals?: SignalBus
  hooks?: HookRegistry
}

/**
 * Module init function signature
 */
export type ModuleInitFunction = (context: ModuleInitContext) => void

/**
 * Module with init function
 */
export interface ModuleDefinition {
  init?: ModuleInitFunction
}

/**
 * Init modules options
 */
export interface InitModulesOptions {
  coreNavItems?: NavItemWithSection[]
  zones?: ZoneRegistry
  signals?: SignalBus
  hooks?: HookRegistry
}

/**
 * Menu alter context
 */
export interface MenuAlterContext {
  sections: NavSection[]
}

// Storage
const routes: ModuleRoute[] = []
const navItems: NavItemWithSection[] = []
const routeFamilies: Record<string, string[]> = {}
const navSections = new Map<string, NavItem[]>()
const entityConfigs = new Map<string, EntityConfig>()

// Configurable section order (set via setSectionOrder or bootstrap)
let sectionOrder: string[] = []

// Altered nav sections after menu:alter hook
// null means not yet altered, use raw navSections
let alteredNavSections: NavSection[] | null = null

// Promise for in-flight alteration (prevents concurrent calls)
let alterationPromise: Promise<void> | null = null

/**
 * Registry API passed to module init functions
 */
const registry = {
  /**
   * Add routes for this module
   *
   * @param prefix - Path prefix for all routes (e.g., 'books' or 'books/:id/reviews')
   * @param moduleRoutes - Route definitions with relative paths
   * @param options - Route options
   */
  addRoutes(
    prefix: string,
    moduleRoutes: (ModuleRoute | RouteRecordRaw)[],
    options: AddRoutesOptions = {}
  ): void {
    const { entity, parent, label, layout } = options
    const prefixedRoutes = moduleRoutes.map((route) => {
      const r = route as ModuleRoute
      const routePath = r.path || ''
      const routeLayout = r.meta?.layout
      return {
        ...r,
        path: routePath ? `${prefix}/${routePath}` : prefix,
        meta: {
          ...r.meta,
          ...(entity && { entity }),
          ...(parent && { parent }),
          ...(label && { navLabel: label }),
          // Layout can be set per-route or inherited from options
          ...((routeLayout || layout) && { layout: routeLayout || layout }),
        },
      } as ModuleRoute
    })
    routes.push(...prefixedRoutes)
  },

  /**
   * Add a navigation item to a section
   * @param item - { section, route, icon, label, exact? }
   */
  addNavItem(item: NavItemWithSection): void {
    const { section, ...navItem } = item
    if (!navSections.has(section)) {
      navSections.set(section, [])
    }
    navSections.get(section)!.push(navItem)
    navItems.push(item)
  },

  /**
   * Add route family mapping (for active state detection)
   * @param parent - Parent route name (e.g., 'agents')
   * @param prefixes - Child route prefixes (e.g., ['agent-'])
   */
  addRouteFamily(parent: string, prefixes: string[]): void {
    if (!routeFamilies[parent]) {
      routeFamilies[parent] = []
    }
    routeFamilies[parent].push(...prefixes)
  },

  /**
   * Declare an entity managed by this module
   * @param name - Entity name (e.g., 'users')
   * @param config - Entity config or manager instance
   *
   * Usage:
   *   registry.addEntity('users', { endpoint: '/users' })
   *   registry.addEntity('users', new CustomUsersManager())
   */
  addEntity(name: string, config: EntityConfig): void {
    entityConfigs.set(name, config)
  },
}

/**
 * Set section order for navigation menu
 * Called from bootstrap config
 * @param order - Section titles in order
 */
export function setSectionOrder(order: string[]): void {
  sectionOrder = order || []
}

/**
 * Initialize modules from a glob import result
 * The consuming app calls this with its own import.meta.glob
 *
 * Usage in app:
 *   const moduleInits = import.meta.glob('./modules/* /init.js', { eager: true })
 *   initModules(moduleInits, { zones, signals, hooks })
 *
 * @param moduleInits - Result of import.meta.glob
 * @param options - { coreNavItems, zones, signals, hooks }
 */
export function initModules(
  moduleInits: Record<string, ModuleDefinition>,
  options: InitModulesOptions = {}
): void {
  const { coreNavItems, zones, signals, hooks } = options

  // Add core nav items (pages that aren't in modules)
  if (coreNavItems) {
    for (const item of coreNavItems) {
      registry.addNavItem(item)
    }
  }

  // Context passed to module init functions
  const context: ModuleInitContext = { registry, zones, signals, hooks }

  // Initialize all discovered modules
  for (const path in moduleInits) {
    const module = moduleInits[path]
    if (module && typeof module.init === 'function') {
      module.init(context)
    }
  }
}

/**
 * Get all registered routes
 */
export function getRoutes(): ModuleRoute[] {
  return routes
}

/**
 * Build raw navigation sections from registered nav items (before alteration)
 * @returns Array of navigation sections
 */
function buildRawNavSections(): NavSection[] {
  const sections: NavSection[] = []

  // First add sections in the configured order
  for (const title of sectionOrder) {
    if (navSections.has(title)) {
      sections.push({
        title,
        items: [...navSections.get(title)!], // Clone items array
      })
    }
  }

  // Add any sections not in the predefined order
  for (const [title, items] of navSections) {
    if (!sectionOrder.includes(title)) {
      sections.push({ title, items: [...items] }) // Clone items array
    }
  }

  return sections
}

/**
 * Get navigation sections in order
 *
 * Returns altered sections if menu:alter hook has been invoked,
 * otherwise returns raw sections from module registrations.
 *
 * @returns Array of navigation sections
 */
export function getNavSections(): NavSection[] {
  // Return altered sections if available, otherwise build from raw
  if (alteredNavSections !== null) {
    return alteredNavSections
  }
  return buildRawNavSections()
}

/**
 * Invoke menu:alter hook to allow modules to modify navigation structure
 *
 * Called lazily by useNavigation on first access. Modules can register
 * handlers for 'menu:alter' hook to add, remove, reorder, or modify
 * navigation sections and items.
 *
 * @param hooks - The hook registry instance
 *
 * @example
 * // In module init or extension
 * hooks.register('menu:alter', (context) => {
 *   // Add a new section
 *   context.sections.push({
 *     title: 'Tools',
 *     items: [{ route: 'tools', label: 'Tools', icon: 'pi pi-wrench' }]
 *   })
 *
 *   // Add item to existing section
 *   const adminSection = context.sections.find(s => s.title === 'Admin')
 *   if (adminSection) {
 *     adminSection.items.push({ route: 'settings', label: 'Settings' })
 *   }
 *
 *   // Remove a section
 *   const idx = context.sections.findIndex(s => s.title === 'Legacy')
 *   if (idx !== -1) context.sections.splice(idx, 1)
 *
 *   return context
 * })
 */
export async function alterMenuSections(hooks: HookRegistry | null | undefined): Promise<void> {
  // Already altered? Return immediately
  if (alteredNavSections !== null) {
    return
  }

  // In-flight alteration? Wait for it
  if (alterationPromise !== null) {
    await alterationPromise
    return
  }

  // No hooks registry? Mark as altered with raw sections
  if (!hooks) {
    alteredNavSections = buildRawNavSections()
    return
  }

  // Perform alteration
  alterationPromise = (async () => {
    const rawSections = buildRawNavSections()

    // Invoke menu:alter hook with mutable context
    const alteredContext = (await hooks.alter('menu:alter', {
      sections: rawSections,
    })) as MenuAlterContext

    // Store altered sections for getNavSections()
    alteredNavSections = alteredContext.sections
    alterationPromise = null
  })()

  await alterationPromise
}

/**
 * Check if menu:alter hook has been invoked
 * @returns Whether menu has been altered
 */
export function isMenuAltered(): boolean {
  return alteredNavSections !== null
}

/**
 * Get route families mapping
 */
export function getRouteFamilies(): Record<string, string[]> {
  return routeFamilies
}

/**
 * Get entity configurations declared by modules
 * @returns Map of entity configs
 */
export function getEntityConfigs(): Map<string, EntityConfig> {
  return entityConfigs
}

/**
 * Get a specific entity configuration
 * @param name - Entity name
 * @returns Entity config or undefined
 */
export function getEntityConfig(name: string): EntityConfig | undefined {
  return entityConfigs.get(name)
}

/**
 * Get sibling routes (routes sharing the same parent entity + param)
 * @param parentEntity - Parent entity name
 * @param parentParam - Parent route param
 * @returns Routes with matching parent config
 */
export function getSiblingRoutes(parentEntity: string, parentParam: string): ModuleRoute[] {
  return routes.filter((route) => {
    const parent = route.meta?.parent
    return parent?.entity === parentEntity && parent?.param === parentParam
  })
}

/**
 * Get child routes (routes that have this entity as parent)
 * @param entityName - Entity name to find children for
 * @returns Routes with this entity as parent
 */
export function getChildRoutes(entityName: string): ModuleRoute[] {
  return routes.filter((route) => {
    const parent = route.meta?.parent
    return parent?.entity === entityName
  })
}

/**
 * Check if a route belongs to a family
 */
export function isRouteInFamily(currentRoute: string, parentRoute: string): boolean {
  if (currentRoute === parentRoute) return true

  const prefixes = routeFamilies[parentRoute]
  if (prefixes && currentRoute) {
    return prefixes.some((prefix) => currentRoute.startsWith(prefix))
  }
  return false
}

/**
 * Reset registry (for testing)
 */
export function resetRegistry(): void {
  routes.length = 0
  navItems.length = 0
  Object.keys(routeFamilies).forEach((key) => delete routeFamilies[key])
  navSections.clear()
  entityConfigs.clear()
  sectionOrder = []
  alteredNavSections = null
  alterationPromise = null
}

// Export registry for direct access if needed
export { registry }
