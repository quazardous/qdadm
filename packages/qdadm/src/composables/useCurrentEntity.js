/**
 * @deprecated Use useActiveStack() instead
 *
 * Legacy composable for setting breadcrumb entity data.
 * This has been replaced by the activeStack system.
 *
 * Migration:
 * ```js
 * // Before (deprecated)
 * const { setBreadcrumbEntity } = useCurrentEntity()
 * setBreadcrumbEntity(data)
 *
 * // After
 * const stack = useActiveStack()
 * stack.setCurrentData(data)
 * ```
 */
import { useActiveStack } from '../chain/useActiveStack.js'

/**
 * @deprecated Use useActiveStack() instead
 */
export function useCurrentEntity() {
  console.warn('[qdadm] useCurrentEntity is deprecated. Use useActiveStack() instead.')

  const stack = useActiveStack()

  /**
   * @deprecated Use stack.setCurrentData() instead
   */
  function setBreadcrumbEntity(data, level = 1) {
    if (level === 1) {
      stack.setCurrentData(data)
    } else {
      // For parent levels, use setEntityData with entity name
      // But we don't have entity name here - just set current
      stack.setCurrentData(data)
    }
  }

  // Backwards compat alias
  const setCurrentEntity = (data) => setBreadcrumbEntity(data, 1)

  return {
    setBreadcrumbEntity,
    setCurrentEntity
  }
}
