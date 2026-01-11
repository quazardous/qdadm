/**
 * @deprecated Use useStackHydrator() instead
 *
 * Legacy composable for setting breadcrumb entity data.
 * This has been replaced by the activeStack + stackHydrator system.
 *
 * Migration:
 * ```js
 * // Before (deprecated)
 * const { setBreadcrumbEntity } = useCurrentEntity()
 * setBreadcrumbEntity(data)
 *
 * // After
 * const hydrator = useStackHydrator()
 * hydrator.setCurrentData(data)
 * ```
 */
import { useStackHydrator } from '../chain/useStackHydrator.js'

/**
 * @deprecated Use useStackHydrator() instead
 */
export function useCurrentEntity() {
  console.warn('[qdadm] useCurrentEntity is deprecated. Use useStackHydrator() instead.')

  const hydrator = useStackHydrator()

  /**
   * @deprecated Use hydrator.setCurrentData() instead
   */
  function setBreadcrumbEntity(data, level = 1) {
    if (level === 1) {
      hydrator.setCurrentData(data)
    } else {
      // For parent levels, use setEntityData with entity name
      // But we don't have entity name here - just set current
      hydrator.setCurrentData(data)
    }
  }

  // Backwards compat alias
  const setCurrentEntity = (data) => setBreadcrumbEntity(data, 1)

  return {
    setBreadcrumbEntity,
    setCurrentEntity
  }
}
