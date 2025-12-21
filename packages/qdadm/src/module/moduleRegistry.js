/**
 * Module Registry - Auto-discovery and registration system
 *
 * Each module can provide an init.js that registers:
 * - Routes
 * - Navigation items
 * - Route families (for active state detection)
 *
 * Usage in module (modules/agents/init.js):
 *
 *   export function init(registry) {
 *     registry.addRoutes('agents', [
 *       { path: '', name: 'agents', component: () => import('./pages/AgentList.vue') },
 *       { path: 'create', name: 'agent-create', component: () => import('./pages/AgentForm.vue') },
 *       { path: ':id/edit', name: 'agent-edit', component: () => import('./pages/AgentForm.vue') }
 *     ])
 *
 *     registry.addNavItem({
 *       section: 'Simulation',
 *       route: 'agents',
 *       icon: 'pi pi-user',
 *       label: 'Agents'
 *     })
 *
 *     registry.addRouteFamily('agents', ['agent-'])
 *   }
 */

// Storage
const routes = []
const navItems = []
const routeFamilies = {}
const navSections = new Map()
const entityConfigs = new Map()  // Entity declarations from modules

// Configurable section order (set via setSectionOrder or bootstrap)
let sectionOrder = []

/**
 * Registry API passed to module init functions
 */
const registry = {
  /**
   * Add routes for this module
   * @param {string} prefix - Path prefix for all routes (e.g., 'agents')
   * @param {Array} moduleRoutes - Route definitions with relative paths
   * @param {object} options - { entity?: string } - Entity name for permission checking
   */
  addRoutes(prefix, moduleRoutes, options = {}) {
    const prefixedRoutes = moduleRoutes.map(route => ({
      ...route,
      path: route.path ? `${prefix}/${route.path}` : prefix,
      meta: {
        ...route.meta,
        ...(options.entity && { entity: options.entity })
      }
    }))
    routes.push(...prefixedRoutes)
  },

  /**
   * Add a navigation item to a section
   * @param {object} item - { section, route, icon, label, exact? }
   */
  addNavItem(item) {
    const { section, ...navItem } = item
    if (!navSections.has(section)) {
      navSections.set(section, [])
    }
    navSections.get(section).push(navItem)
    navItems.push(item)
  },

  /**
   * Add route family mapping (for active state detection)
   * @param {string} parent - Parent route name (e.g., 'agents')
   * @param {Array<string>} prefixes - Child route prefixes (e.g., ['agent-'])
   */
  addRouteFamily(parent, prefixes) {
    if (!routeFamilies[parent]) {
      routeFamilies[parent] = []
    }
    routeFamilies[parent].push(...prefixes)
  },

  /**
   * Declare an entity managed by this module
   * @param {string} name - Entity name (e.g., 'users')
   * @param {object|EntityManager} config - Entity config or manager instance
   *   - If EntityManager instance: used directly
   *   - If object: { endpoint, idField, storage?, ... } passed to factory
   *
   * Usage:
   *   registry.addEntity('users', { endpoint: '/users' })
   *   registry.addEntity('users', new CustomUsersManager())
   */
  addEntity(name, config) {
    entityConfigs.set(name, config)
  }
}

/**
 * Set section order for navigation menu
 * Called from bootstrap config
 * @param {Array<string>} order - Section titles in order
 */
export function setSectionOrder(order) {
  sectionOrder = order || []
}

/**
 * Initialize modules from a glob import result
 * The consuming app calls this with its own import.meta.glob
 *
 * Usage in app:
 *   const moduleInits = import.meta.glob('./modules/* /init.js', { eager: true })
 *   initModules(moduleInits)
 *
 * @param {object} moduleInits - Result of import.meta.glob
 * @param {object} options - { coreNavItems: [] } - Core items not in modules
 */
export function initModules(moduleInits, options = {}) {
  // Add core nav items (pages that aren't in modules)
  if (options.coreNavItems) {
    for (const item of options.coreNavItems) {
      registry.addNavItem(item)
    }
  }

  // Initialize all discovered modules
  for (const path in moduleInits) {
    const module = moduleInits[path]
    if (typeof module.init === 'function') {
      module.init(registry)
    }
  }
}

/**
 * Get all registered routes
 */
export function getRoutes() {
  return routes
}

/**
 * Get navigation sections in order
 */
export function getNavSections() {
  const sections = []

  // First add sections in the configured order
  for (const title of sectionOrder) {
    if (navSections.has(title)) {
      sections.push({
        title,
        items: navSections.get(title)
      })
    }
  }

  // Add any sections not in the predefined order
  for (const [title, items] of navSections) {
    if (!sectionOrder.includes(title)) {
      sections.push({ title, items })
    }
  }

  return sections
}

/**
 * Get route families mapping
 */
export function getRouteFamilies() {
  return routeFamilies
}

/**
 * Get entity configurations declared by modules
 * @returns {Map<string, object>}
 */
export function getEntityConfigs() {
  return entityConfigs
}

/**
 * Get a specific entity configuration
 * @param {string} name - Entity name
 * @returns {object|undefined}
 */
export function getEntityConfig(name) {
  return entityConfigs.get(name)
}

/**
 * Check if a route belongs to a family
 */
export function isRouteInFamily(currentRoute, parentRoute) {
  if (currentRoute === parentRoute) return true

  const prefixes = routeFamilies[parentRoute]
  if (prefixes && currentRoute) {
    return prefixes.some(prefix => currentRoute.startsWith(prefix))
  }
  return false
}

/**
 * Reset registry (for testing)
 */
export function resetRegistry() {
  routes.length = 0
  navItems.length = 0
  Object.keys(routeFamilies).forEach(key => delete routeFamilies[key])
  navSections.clear()
  entityConfigs.clear()
  sectionOrder = []
}

// Export registry for direct access if needed
export { registry }
