/**
 * useLayoutResolver - Automatic layout resolution for entity pages
 *
 * Resolves the appropriate layout component based on:
 * 1. Route meta: `{ meta: { layout: 'list' } }` (highest priority)
 * 2. Page name convention: `*ListPage` -> ListLayout, `*EditPage` -> FormLayout
 * 3. Explicit prop: `layout="list"` passed to component
 *
 * Layout types:
 * - 'list' -> ListLayout (entity list pages)
 * - 'form' -> FormLayout (create/edit pages)
 * - 'dashboard' -> DashboardLayout (dashboard pages)
 * - 'base' -> BaseLayout (generic pages)
 *
 * Usage:
 * ```js
 * const { layoutComponent, layoutType, resolveLayout } = useLayoutResolver()
 *
 * // In template:
 * <component :is="layoutComponent">
 *   <template #main>...</template>
 * </component>
 * ```
 *
 * Or with explicit layout prop:
 * ```js
 * const { layoutComponent } = useLayoutResolver({ layout: 'list' })
 * ```
 */
import { computed, inject, getCurrentInstance } from 'vue'
import { useRoute } from 'vue-router'

// Layout type constants
export const LAYOUT_TYPES = {
  LIST: 'list',
  FORM: 'form',
  DASHBOARD: 'dashboard',
  BASE: 'base'
}

// Page name patterns for auto-detection
const PAGE_NAME_PATTERNS = [
  { pattern: /List(Page)?$/i, layout: LAYOUT_TYPES.LIST },
  { pattern: /(Edit|Create|Form)(Page)?$/i, layout: LAYOUT_TYPES.FORM },
  { pattern: /Dashboard(Page)?$/i, layout: LAYOUT_TYPES.DASHBOARD }
]

// Route name patterns for auto-detection
const ROUTE_NAME_PATTERNS = [
  { pattern: /-list$/i, layout: LAYOUT_TYPES.LIST },
  { pattern: /-(edit|create)$/i, layout: LAYOUT_TYPES.FORM },
  { pattern: /-dashboard$/i, layout: LAYOUT_TYPES.DASHBOARD },
  // Common patterns without suffix
  { pattern: /^dashboard$/i, layout: LAYOUT_TYPES.DASHBOARD }
]

/**
 * Resolve layout type from component name
 * @param {string} componentName - Vue component name
 * @returns {string|null} Layout type or null
 */
function resolveFromComponentName(componentName) {
  if (!componentName) return null

  for (const { pattern, layout } of PAGE_NAME_PATTERNS) {
    if (pattern.test(componentName)) {
      return layout
    }
  }
  return null
}

/**
 * Resolve layout type from route name
 * @param {string} routeName - Route name
 * @returns {string|null} Layout type or null
 */
function resolveFromRouteName(routeName) {
  if (!routeName) return null

  for (const { pattern, layout } of ROUTE_NAME_PATTERNS) {
    if (pattern.test(routeName)) {
      return layout
    }
  }
  return null
}

/**
 * useLayoutResolver composable
 *
 * @param {object} options - Configuration options
 * @param {string} [options.layout] - Explicit layout type override
 * @param {string} [options.default] - Default layout if none detected (default: 'base')
 * @returns {object} Layout resolution utilities
 */
export function useLayoutResolver(options = {}) {
  const route = useRoute()
  const instance = getCurrentInstance()

  // Get layout components from injection (provided by Kernel)
  const layoutComponents = inject('qdadmLayoutComponents', null)

  /**
   * Resolve the layout type based on priority:
   * 1. Explicit option.layout
   * 2. Route meta.layout
   * 3. Component name pattern
   * 4. Route name pattern
   * 5. Default
   */
  const layoutType = computed(() => {
    // Priority 1: Explicit layout prop/option
    if (options.layout) {
      return options.layout
    }

    // Priority 2: Route meta.layout
    if (route.meta?.layout) {
      return route.meta.layout
    }

    // Priority 3: Component name pattern
    const componentName = instance?.type?.name || instance?.type?.__name
    const fromComponentName = resolveFromComponentName(componentName)
    if (fromComponentName) {
      return fromComponentName
    }

    // Priority 4: Route name pattern
    const fromRouteName = resolveFromRouteName(route.name)
    if (fromRouteName) {
      return fromRouteName
    }

    // Priority 5: Default
    return options.default || LAYOUT_TYPES.BASE
  })

  /**
   * Get the layout component for the resolved type
   */
  const layoutComponent = computed(() => {
    if (!layoutComponents) {
      // No components injected, return null (caller handles fallback)
      return null
    }

    const type = layoutType.value
    return layoutComponents[type] || layoutComponents.base || null
  })

  /**
   * Check if a specific layout type is active
   * @param {string} type - Layout type to check
   * @returns {boolean}
   */
  function isLayout(type) {
    return layoutType.value === type
  }

  /**
   * Manually resolve layout for a given context
   * Useful for programmatic layout determination
   *
   * @param {object} context - Resolution context
   * @param {string} [context.routeMeta] - Route meta object
   * @param {string} [context.componentName] - Component name
   * @param {string} [context.routeName] - Route name
   * @param {string} [context.explicit] - Explicit layout override
   * @returns {string} Resolved layout type
   */
  function resolveLayout(context = {}) {
    // Priority 1: Explicit
    if (context.explicit) {
      return context.explicit
    }

    // Priority 2: Route meta
    if (context.routeMeta?.layout) {
      return context.routeMeta.layout
    }

    // Priority 3: Component name
    const fromComponent = resolveFromComponentName(context.componentName)
    if (fromComponent) {
      return fromComponent
    }

    // Priority 4: Route name
    const fromRoute = resolveFromRouteName(context.routeName)
    if (fromRoute) {
      return fromRoute
    }

    // Default
    return options.default || LAYOUT_TYPES.BASE
  }

  return {
    /** Current resolved layout type */
    layoutType,
    /** Layout component for current type (if injected) */
    layoutComponent,
    /** Check if specific layout type is active */
    isLayout,
    /** Manually resolve layout for given context */
    resolveLayout,
    /** Layout type constants */
    LAYOUT_TYPES
  }
}

/**
 * Create layout components map for Kernel injection
 *
 * @param {object} components - Layout component imports
 * @returns {object} Layout components map
 *
 * @example
 * ```js
 * import ListLayout from './components/layout/ListLayout.vue'
 * import FormLayout from './components/layout/FormLayout.vue'
 *
 * const layouts = createLayoutComponents({
 *   list: ListLayout,
 *   form: FormLayout
 * })
 * ```
 */
export function createLayoutComponents(components = {}) {
  return {
    [LAYOUT_TYPES.LIST]: components.list || components.ListLayout || null,
    [LAYOUT_TYPES.FORM]: components.form || components.FormLayout || null,
    [LAYOUT_TYPES.DASHBOARD]: components.dashboard || components.DashboardLayout || null,
    [LAYOUT_TYPES.BASE]: components.base || components.BaseLayout || null
  }
}

/**
 * Get route meta configuration for layout
 *
 * Helper to add layout meta to route definitions
 *
 * @param {string} layoutType - Layout type
 * @returns {object} Route meta object
 *
 * @example
 * ```js
 * {
 *   path: 'books',
 *   name: 'book-list',
 *   component: BookList,
 *   meta: layoutMeta('list')
 * }
 * ```
 */
export function layoutMeta(layoutType) {
  return { layout: layoutType }
}
