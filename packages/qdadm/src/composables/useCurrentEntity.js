/**
 * useCurrentEntity - Share page entity data with navigation context
 *
 * When a page loads an entity (e.g., ProductDetailPage fetches a product),
 * it can call setCurrentEntity() to share that data with the navigation context.
 * This avoids a second fetch for breadcrumb display.
 *
 * Usage in a detail page:
 * ```js
 * const { setCurrentEntity } = useCurrentEntity()
 *
 * async function loadProduct() {
 *   product.value = await productsManager.get(productId)
 *   setCurrentEntity(product.value)  // Share with navigation
 * }
 * ```
 *
 * The navigation context (useNavContext) will use this data instead of
 * fetching the entity again for the breadcrumb.
 */
import { inject } from 'vue'

/**
 * Composable to share current page entity with navigation context
 * @returns {{ setCurrentEntity: (data: object) => void }}
 */
export function useCurrentEntity() {
  const currentEntityData = inject('qdadmCurrentEntityData', null)

  /**
   * Set the current entity data for navigation context
   * Call this after loading an entity to avoid double fetch
   * @param {object} data - Entity data
   */
  function setCurrentEntity(data) {
    if (currentEntityData) {
      currentEntityData.value = data
    }
  }

  return {
    setCurrentEntity
  }
}
