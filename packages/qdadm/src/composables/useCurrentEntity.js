/**
 * useCurrentEntity - Share page entity data with navigation context (breadcrumb)
 *
 * When a page loads an entity, it calls setBreadcrumbEntity() to share
 * the data with AppLayout for breadcrumb display.
 *
 * Usage in a detail page:
 * ```js
 * const { setBreadcrumbEntity } = useCurrentEntity()
 *
 * async function loadProduct() {
 *   product.value = await productsManager.get(productId)
 *   setBreadcrumbEntity(product.value)  // Level 1 (main entity)
 * }
 * ```
 *
 * For nested routes with parent/child entities:
 * ```js
 * // Parent page loaded first
 * setBreadcrumbEntity(book, 1)  // Level 1: the book
 *
 * // Child page
 * setBreadcrumbEntity(loan, 2)  // Level 2: the loan under the book
 * ```
 */
import { inject } from 'vue'

/**
 * Composable to share page entity data with breadcrumb
 * @returns {{ setBreadcrumbEntity: (data: object, level?: number) => void }}
 */
export function useCurrentEntity() {
  const setBreadcrumbEntityFn = inject('qdadmSetBreadcrumbEntity', null)

  /**
   * Set entity data for breadcrumb at a specific level
   * @param {object} data - Entity data
   * @param {number} level - Breadcrumb level (1 = main entity, 2 = child, etc.)
   */
  function setBreadcrumbEntity(data, level = 1) {
    if (setBreadcrumbEntityFn) {
      setBreadcrumbEntityFn(data, level)
    }
  }

  // Backwards compat alias
  const setCurrentEntity = (data) => setBreadcrumbEntity(data, 1)

  return {
    setBreadcrumbEntity,
    setCurrentEntity  // deprecated alias
  }
}
