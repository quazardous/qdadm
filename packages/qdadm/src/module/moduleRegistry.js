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

// Storage
const routes = []
const navItems = []
const routeFamilies = {}
const navSections = new Map()
const entityConfigs = new Map()  // Entity declarations from modules

// Configurable section order (set via setSectionOrder or bootstrap)
let sectionOrder = []

// Altered nav sections after menu:alter hook
// null means not yet altered, use raw navSections
let alteredNavSections = null

// Promise for in-flight alteration (prevents concurrent calls)
let alterationPromise = null

/**
 * Registry API passed to module init functions
 */
const registry = {
  /**
   * Add routes for this module
   *
   * @param {string} prefix - Path prefix for all routes (e.g., 'books' or 'books/:id/reviews')
   * @param {Array} moduleRoutes - Route definitions with relative paths
   * @param {object} options - Route options
   * @param {string} [options.entity] - Entity name for permission checking
   * @param {object} [options.parent] - Parent entity config for child routes
   * @param {string} options.parent.entity - Parent entity name (e.g., 'books')
   * @param {string} options.parent.param - Route param for parent ID
   * @param {string} options.parent.foreignKey - Foreign key field (e.g., 'book_id')
   * @param {string} [options.parent.itemRoute] - Override parent item route (auto: parentEntity.routePrefix + '-edit')
   * @param {string} [options.label] - Label for navlinks (defaults to entity labelPlural)
   * @param {string} [options.layout] - Default layout type for routes ('list', 'form', 'dashboard', 'base')
   */
  addRoutes(prefix, moduleRoutes, options = {}) {
    const { entity, parent, label, layout } = options
    const prefixedRoutes = moduleRoutes.map(route => ({
      ...route,
      path: route.path ? `${prefix}/${route.path}` : prefix,
      meta: {
        ...route.meta,
        ...(entity && { entity }),
        ...(parent && { parent }),
        ...(label && { navLabel: label }),
        // Layout can be set per-route or inherited from options
        ...((route.meta?.layout || layout) && { layout: route.meta?.layout || layout })
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
 *   initModules(moduleInits, { zones, signals, hooks })
 *
 * @param {object} moduleInits - Result of import.meta.glob
 * @param {object} options - { coreNavItems, zones, signals, hooks }
 * @param {Array} options.coreNavItems - Core nav items not in modules
 * @param {ZoneRegistry} options.zones - Zone registry for block registration
 * @param {SignalBus} options.signals - Signal bus for event handlers
 * @param {HookRegistry} options.hooks - Hook registry for lifecycle hooks
 */
export function initModules(moduleInits, options = {}) {
  const { coreNavItems, zones, signals, hooks } = options

  // Add core nav items (pages that aren't in modules)
  if (coreNavItems) {
    for (const item of coreNavItems) {
      registry.addNavItem(item)
    }
  }

  // Context passed to module init functions
  const context = { registry, zones, signals, hooks }

  // Initialize all discovered modules
  for (const path in moduleInits) {
    const module = moduleInits[path]
    if (typeof module.init === 'function') {
      module.init(context)
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
 * Build raw navigation sections from registered nav items (before alteration)
 * @returns {Array<{title: string, items: Array}>}
 */
function buildRawNavSections() {
  const sections = []

  // First add sections in the configured order
  for (const title of sectionOrder) {
    if (navSections.has(title)) {
      sections.push({
        title,
        items: [...navSections.get(title)]  // Clone items array
      })
    }
  }

  // Add any sections not in the predefined order
  for (const [title, items] of navSections) {
    if (!sectionOrder.includes(title)) {
      sections.push({ title, items: [...items] })  // Clone items array
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
 * @returns {Array<{title: string, items: Array}>}
 */
export function getNavSections() {
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
 * @param {HookRegistry} hooks - The hook registry instance
 * @returns {Promise<void>}
 *
 * @typedef {Object} MenuAlterContext
 * @property {Array<MenuSection>} sections - Navigation sections (mutable)
 *
 * @typedef {Object} MenuSection
 * @property {string} title - Section title
 * @property {Array<NavItem>} items - Navigation items in this section
 *
 * @typedef {Object} NavItem
 * @property {string} route - Route name
 * @property {string} label - Display label
 * @property {string} [icon] - Icon class (e.g., 'pi pi-users')
 * @property {string} [entity] - Entity name for permission checks
 * @property {boolean} [exact] - Use exact route matching
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
export async function alterMenuSections(hooks) {
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
    const alteredContext = await hooks.alter('menu:alter', {
      sections: rawSections
    })

    // Store altered sections for getNavSections()
    alteredNavSections = alteredContext.sections
    alterationPromise = null
  })()

  await alterationPromise
}

/**
 * Check if menu:alter hook has been invoked
 * @returns {boolean}
 */
export function isMenuAltered() {
  return alteredNavSections !== null
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
 * Get sibling routes (routes sharing the same parent entity + param)
 * @param {string} parentEntity - Parent entity name
 * @param {string} parentParam - Parent route param
 * @returns {Array} Routes with matching parent config
 */
export function getSiblingRoutes(parentEntity, parentParam) {
  return routes.filter(route => {
    const parent = route.meta?.parent
    return parent?.entity === parentEntity && parent?.param === parentParam
  })
}

/**
 * Get child routes (routes that have this entity as parent)
 * @param {string} entityName - Entity name to find children for
 * @returns {Array} Routes with this entity as parent
 */
export function getChildRoutes(entityName) {
  return routes.filter(route => {
    const parent = route.meta?.parent
    return parent?.entity === entityName
  })
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
  alteredNavSections = null
  alterationPromise = null
}

// Export registry for direct access if needed
export { registry }
