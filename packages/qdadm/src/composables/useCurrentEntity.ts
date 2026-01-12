/**
 * @deprecated Use useStackHydrator() instead
 *
 * Legacy composable for setting breadcrumb entity data.
 * This has been replaced by the activeStack + stackHydrator system.
 *
 * Migration:
 * ```ts
 * // Before (deprecated)
 * const { setBreadcrumbEntity } = useCurrentEntity()
 * setBreadcrumbEntity(data)
 *
 * // After
 * const hydrator = useStackHydrator()
 * hydrator.setCurrentData(data)
 * ```
 */
import { useStackHydrator } from '../chain/useStackHydrator'

/**
 * Return type for useCurrentEntity
 */
export interface UseCurrentEntityReturn {
  /** @deprecated Use hydrator.setCurrentData() instead */
  setBreadcrumbEntity: (data: unknown, level?: number) => void
  /** @deprecated Use hydrator.setCurrentData() instead */
  setCurrentEntity: (data: unknown) => void
}

/**
 * @deprecated Use useStackHydrator() instead
 */
export function useCurrentEntity(): UseCurrentEntityReturn {
  console.warn(
    '[qdadm] useCurrentEntity is deprecated. Use useStackHydrator() instead.'
  )

  const hydrator = useStackHydrator()

  /**
   * @deprecated Use hydrator.setCurrentData() instead
   */
  function setBreadcrumbEntity(data: unknown, level = 1): void {
    if (level === 1) {
      hydrator.setCurrentData(data)
    } else {
      // For parent levels, use setEntityData with entity name
      // But we don't have entity name here - just set current
      hydrator.setCurrentData(data)
    }
  }

  // Backwards compat alias
  const setCurrentEntity = (data: unknown): void => setBreadcrumbEntity(data, 1)

  return {
    setBreadcrumbEntity,
    setCurrentEntity,
  }
}
