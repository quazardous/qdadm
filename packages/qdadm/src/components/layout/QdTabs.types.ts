/** One tab of QdTabs (#5398) */
export interface QdTab {
  /** Its name in the address and its slot's name */
  key: string
  label: string
  icon?: string
  /** A count, or a count with its tone; hidden at zero */
  badge?: number | { count: number; tone?: 'critical' | 'watch' | null } | null
  /** Not drawn for a user without it */
  permission?: string
  disabled?: boolean
}
