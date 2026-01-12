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
 * ```ts
 * const { layoutComponent, layoutType, resolveLayout } = useLayoutResolver()
 *
 * // In template:
 * <component :is="layoutComponent">
 *   <template #main>...</template>
 * </component>
 * ```
 *
 * Or with explicit layout prop:
 * ```ts
 * const { layoutComponent } = useLayoutResolver({ layout: 'list' })
 * ```
 */
import { computed, inject, getCurrentInstance, type ComputedRef, type Component } from 'vue'
import { useRoute } from 'vue-router'

// Layout type constants
export const LAYOUT_TYPES = {
  LIST: 'list',
  FORM: 'form',
  DASHBOARD: 'dashboard',
  BASE: 'base',
} as const

export type LayoutType = (typeof LAYOUT_TYPES)[keyof typeof LAYOUT_TYPES]

/**
 * Layout components map
 */
export interface LayoutComponentsMap {
  list?: Component | null
  form?: Component | null
  dashboard?: Component | null
  base?: Component | null
  [key: string]: Component | null | undefined
}

/**
 * Page name pattern for layout detection
 */
interface PageNamePattern {
  pattern: RegExp
  layout: LayoutType
}

// Page name patterns for auto-detection
const PAGE_NAME_PATTERNS: PageNamePattern[] = [
  { pattern: /List(Page)?$/i, layout: LAYOUT_TYPES.LIST },
  { pattern: /(Edit|Create|Form)(Page)?$/i, layout: LAYOUT_TYPES.FORM },
  { pattern: /Dashboard(Page)?$/i, layout: LAYOUT_TYPES.DASHBOARD },
]

// Route name patterns for auto-detection
const ROUTE_NAME_PATTERNS: PageNamePattern[] = [
  { pattern: /-list$/i, layout: LAYOUT_TYPES.LIST },
  { pattern: /-(edit|create)$/i, layout: LAYOUT_TYPES.FORM },
  { pattern: /-dashboard$/i, layout: LAYOUT_TYPES.DASHBOARD },
  // Common patterns without suffix
  { pattern: /^dashboard$/i, layout: LAYOUT_TYPES.DASHBOARD },
]

/**
 * Resolve layout type from component name
 * @param componentName - Vue component name
 * @returns Layout type or null
 */
function resolveFromComponentName(componentName: string | null | undefined): LayoutType | null {
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
 * @param routeName - Route name
 * @returns Layout type or null
 */
function resolveFromRouteName(routeName: string | null | undefined): LayoutType | null {
  if (!routeName) return null

  for (const { pattern, layout } of ROUTE_NAME_PATTERNS) {
    if (pattern.test(routeName)) {
      return layout
    }
  }
  return null
}

/**
 * Options for useLayoutResolver
 */
export interface UseLayoutResolverOptions {
  /** Explicit layout type override */
  layout?: LayoutType
  /** Default layout if none detected (default: 'base') */
  default?: LayoutType
}

/**
 * Resolution context for resolveLayout
 */
export interface LayoutResolutionContext {
  routeMeta?: { layout?: LayoutType }
  componentName?: string
  routeName?: string
  explicit?: LayoutType
}

/**
 * Return type for useLayoutResolver
 */
export interface UseLayoutResolverReturn {
  /** Current resolved layout type */
  layoutType: ComputedRef<LayoutType>
  /** Layout component for current type (if injected) */
  layoutComponent: ComputedRef<Component | null>
  /** Check if specific layout type is active */
  isLayout: (type: LayoutType) => boolean
  /** Manually resolve layout for given context */
  resolveLayout: (context?: LayoutResolutionContext) => LayoutType
  /** Layout type constants */
  LAYOUT_TYPES: typeof LAYOUT_TYPES
}

/**
 * useLayoutResolver composable
 *
 * @param options - Configuration options
 * @returns Layout resolution utilities
 */
export function useLayoutResolver(options: UseLayoutResolverOptions = {}): UseLayoutResolverReturn {
  const route = useRoute()
  const instance = getCurrentInstance()

  // Get layout components from injection (provided by Kernel)
  const layoutComponents = inject<LayoutComponentsMap | null>('qdadmLayoutComponents', null)

  /**
   * Resolve the layout type based on priority:
   * 1. Explicit option.layout
   * 2. Route meta.layout
   * 3. Component name pattern
   * 4. Route name pattern
   * 5. Default
   */
  const layoutType = computed((): LayoutType => {
    // Priority 1: Explicit layout prop/option
    if (options.layout) {
      return options.layout
    }

    // Priority 2: Route meta.layout
    if (route.meta?.layout) {
      return route.meta.layout as LayoutType
    }

    // Priority 3: Component name pattern
    const componentName =
      (instance?.type as { name?: string; __name?: string })?.name ||
      (instance?.type as { name?: string; __name?: string })?.__name
    const fromComponentName = resolveFromComponentName(componentName)
    if (fromComponentName) {
      return fromComponentName
    }

    // Priority 4: Route name pattern
    const fromRouteName = resolveFromRouteName(route.name as string | undefined)
    if (fromRouteName) {
      return fromRouteName
    }

    // Priority 5: Default
    return options.default || LAYOUT_TYPES.BASE
  })

  /**
   * Get the layout component for the resolved type
   */
  const layoutComponent = computed((): Component | null => {
    if (!layoutComponents) {
      // No components injected, return null (caller handles fallback)
      return null
    }

    const type = layoutType.value
    return layoutComponents[type] || layoutComponents.base || null
  })

  /**
   * Check if a specific layout type is active
   * @param type - Layout type to check
   * @returns True if layout type matches
   */
  function isLayout(type: LayoutType): boolean {
    return layoutType.value === type
  }

  /**
   * Manually resolve layout for a given context
   * Useful for programmatic layout determination
   *
   * @param context - Resolution context
   * @returns Resolved layout type
   */
  function resolveLayout(context: LayoutResolutionContext = {}): LayoutType {
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
    layoutType,
    layoutComponent,
    isLayout,
    resolveLayout,
    LAYOUT_TYPES,
  }
}

/**
 * Layout components input for createLayoutComponents
 */
export interface LayoutComponentsInput {
  list?: Component
  form?: Component
  dashboard?: Component
  base?: Component
  ListLayout?: Component
  FormLayout?: Component
  DashboardLayout?: Component
  BaseLayout?: Component
}

/**
 * Create layout components map for Kernel injection
 *
 * @param components - Layout component imports
 * @returns Layout components map
 *
 * @example
 * ```ts
 * import ListLayout from './components/layout/ListLayout.vue'
 * import FormLayout from './components/layout/FormLayout.vue'
 *
 * const layouts = createLayoutComponents({
 *   list: ListLayout,
 *   form: FormLayout
 * })
 * ```
 */
export function createLayoutComponents(components: LayoutComponentsInput = {}): LayoutComponentsMap {
  return {
    [LAYOUT_TYPES.LIST]: components.list || components.ListLayout || null,
    [LAYOUT_TYPES.FORM]: components.form || components.FormLayout || null,
    [LAYOUT_TYPES.DASHBOARD]: components.dashboard || components.DashboardLayout || null,
    [LAYOUT_TYPES.BASE]: components.base || components.BaseLayout || null,
  }
}

/**
 * Route meta object with layout
 */
export interface LayoutMeta {
  layout: LayoutType
}

/**
 * Get route meta configuration for layout
 *
 * Helper to add layout meta to route definitions
 *
 * @param layoutType - Layout type
 * @returns Route meta object
 *
 * @example
 * ```ts
 * {
 *   path: 'books',
 *   name: 'book-list',
 *   component: BookList,
 *   meta: layoutMeta('list')
 * }
 * ```
 */
export function layoutMeta(layoutType: LayoutType): LayoutMeta {
  return { layout: layoutType }
}
