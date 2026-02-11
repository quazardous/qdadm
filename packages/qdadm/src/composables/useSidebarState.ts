/**
 * useSidebarState - Access sidebar collapsed state from any component
 *
 * The sidebar collapsed ref is provided by AppLayout via Vue's provide/inject.
 * This composable gives blocks rendered inside the sidebar (including zone blocks)
 * programmatic access to the collapsed state.
 *
 * @example
 * ```ts
 * import { useSidebarState } from 'qdadm'
 *
 * const { collapsed } = useSidebarState()
 * // collapsed.value === true when sidebar is in icon-only mode
 * ```
 */

import { inject, ref, type Ref } from 'vue'

export const SIDEBAR_COLLAPSED_KEY = Symbol('qdadm-sidebar-collapsed') as symbol & { __type: Ref<boolean> }

export function useSidebarState(): { collapsed: Ref<boolean> } {
  const collapsed = inject<Ref<boolean>>(SIDEBAR_COLLAPSED_KEY, ref(false))
  return { collapsed }
}
