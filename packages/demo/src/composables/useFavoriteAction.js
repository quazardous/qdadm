/**
 * useFavoriteAction - a star on each row of a list, over qdadm's favourites
 * (#5349): the row's record becomes a favourite of kind `item`, the same one
 * the star beside its page's title adds, shown in the favourites card.
 *
 * Usage:
 *   const list = useListPage({ entity: 'books' })
 *   useFavoriteAction(list, { labelField: 'title' })
 */
import { useRouter } from 'vue-router'
import { useFavorites } from '@quazardous/qdadm'

/**
 * @param {object} listBuilder - useListPage instance
 * @param {object} options
 * @param {string|function} options.labelField - the field (or a function of the row) naming the favourite
 */
export function useFavoriteAction(listBuilder, options = {}) {
  const router = useRouter()
  const favorites = useFavorites()
  const manager = listBuilder.manager
  const prefix = manager.routePrefix
  const routeName = [`${prefix}-show`, `${prefix}-edit`].find((name) => router.hasRoute(name))
  if (!routeName) {
    console.warn(`[demo] useFavoriteAction: "${manager.name}" has no show or edit page to make a favourite of`)
    return
  }

  const idOf = (row) => String(row[manager.idField || 'id'])
  const pathOf = (row) => router.resolve({ name: routeName, params: { [manager.idField || 'id']: idOf(row) } }).path
  const labelOf = (row) => {
    const field = options.labelField || manager.labelField || 'title'
    return typeof field === 'function' ? field(row) : row[field] || row.name || idOf(row)
  }
  // A record's favourite, whichever of its pages (show, edit, this row) added it
  const on = (row) => !!favorites.findItem(manager.name, idOf(row))

  listBuilder.addAction('favorite', {
    icon: (row) => (on(row) ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'),
    tooltip: (row) => (on(row) ? `Remove ${labelOf(row)} from favourites` : `Add ${labelOf(row)} to favourites`),
    severity: (row) => (on(row) ? 'warn' : 'secondary'),
    onClick: (row) => favorites.toggle({ kind: 'item', label: labelOf(row), to: pathOf(row), entity: manager.name, itemId: idOf(row) }),
  })
}
