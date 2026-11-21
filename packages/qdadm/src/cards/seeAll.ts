/**
 * "See all" (#5405): the link in a list card's foot to its full list, past
 * the lines it shows (or always), saying how many there are.
 */
import type { RouteLocationRaw } from 'vue-router'
import type { CardLink } from './types'
import type { UseI18nResult } from '../i18n/useI18n'

type TOr = UseI18nResult['tOr']

export function seeAllLink(
  to: RouteLocationRaw | null | undefined,
  when: 'overflow' | 'always',
  total: number,
  shown: number,
  tOr: TOr
): CardLink[] {
  if (!to) return []
  const over = total > shown
  if (when === 'overflow' && !over) return []
  const label = over ? tOr('core.favorites.seeAllCount', 'See all ({count})', { count: total }) : tOr('core.favorites.seeAll', 'See all')
  return [{ label, to, icon: 'pi pi-arrow-right' }]
}
