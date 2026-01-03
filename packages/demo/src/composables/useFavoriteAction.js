/**
 * useFavoriteAction - DRY composable for adding favorite action to list pages
 *
 * Usage:
 *   const list = useListPageBuilder({ entity: 'books' })
 *   useFavoriteAction(list, 'book')
 *
 * This adds a star icon action that toggles favorites for each row.
 */

import { ref, onMounted } from 'vue'
import { useOrchestrator, useSignalToast } from 'qdadm'

/**
 * Add favorite toggle action to a list builder
 * @param {object} listBuilder - useListPageBuilder instance
 * @param {string} entityType - Entity type for favorites (e.g., 'book', 'product')
 * @param {object} options - Optional config
 * @param {string} options.labelField - Field to use as favorite name (default: 'title' or 'name')
 */
export function useFavoriteAction(listBuilder, entityType, options = {}) {
  const toast = useSignalToast('FavoriteAction')

  // Use qdadm's orchestrator to get the favorites manager
  const { getManager, hasManager } = useOrchestrator()
  const favoritesManager = hasManager('favorites') ? getManager('favorites') : null

  // Cache of favorite IDs for quick lookup
  const favoriteIds = ref(new Set())
  let favoritesLoaded = false

  // Load favorites on first access
  async function loadFavorites() {
    if (favoritesLoaded || !favoritesManager) return
    try {
      const result = await favoritesManager.list({ page_size: 1000 })
      favoriteIds.value = new Set(
        result.items
          .filter(f => f.entityType === entityType)
          .map(f => f.entityId)
      )
      favoritesLoaded = true
    } catch (e) {
      console.error('[favorites] Failed to load:', e)
    }
  }

  // Check if entity is favorited
  function isFavorite(entityId) {
    return favoriteIds.value.has(String(entityId))
  }

  // Find favorite record by entityId
  async function findFavorite(entityId) {
    if (!favoritesManager) return null
    const result = await favoritesManager.list({
      page_size: 1000,
      filters: { entityType, entityId: String(entityId) }
    })
    return result.items.find(f => f.entityId === String(entityId))
  }

  // Toggle favorite status
  async function toggleFavorite(row) {
    if (!favoritesManager) return

    const manager = listBuilder.manager
    const entityId = String(row[manager.idField || 'id'])
    const labelField = options.labelField || manager.labelField || 'title'
    const label = typeof labelField === 'function' ? labelField(row) : row[labelField] || row.name || entityId

    try {
      if (isFavorite(entityId)) {
        // Remove favorite
        const favorite = await findFavorite(entityId)
        if (favorite) {
          await favoritesManager.delete(favorite.id)
          favoriteIds.value.delete(entityId)
          toast.info('Removed from favorites', label, 2000)
        }
      } else {
        // Add favorite
        await favoritesManager.create({
          name: label,
          entityType,
          entityId,
          createdAt: new Date().toISOString()
        })
        favoriteIds.value.add(entityId)
        toast.success('Added to favorites', label, 2000)
      }
    } catch (e) {
      console.error('[favorites] Toggle failed:', e)
      toast.error('Error', 'Failed to update favorites')
    }
  }

  // Load favorites after component mount
  onMounted(() => {
    loadFavorites()
  })

  // Add the action to the list builder
  listBuilder.addAction('favorite', {
    icon: (row) => {
      const manager = listBuilder.manager
      const entityId = String(row[manager.idField || 'id'])
      return isFavorite(entityId) ? 'pi pi-star-fill' : 'pi pi-star'
    },
    tooltip: (row) => {
      const manager = listBuilder.manager
      const entityId = String(row[manager.idField || 'id'])
      return isFavorite(entityId) ? 'Remove from favorites' : 'Add to favorites'
    },
    severity: (row) => {
      const manager = listBuilder.manager
      const entityId = String(row[manager.idField || 'id'])
      return isFavorite(entityId) ? 'warn' : 'secondary'
    },
    onClick: toggleFavorite
  })

  return {
    isFavorite,
    toggleFavorite,
    loadFavorites
  }
}
