/**
 * The favourites' look (#5402), an app setting: `features.favorites` in the
 * kernel's options. The bookmark by default, icons alone, a list's search
 * bookmark in its filter zone. Each use may still say otherwise by its props.
 */
import { inject } from 'vue'

export interface FavoritesLook {
  /** The symbol (default `pi pi-bookmark`) */
  icon: string
  /** The symbol once a favourite (default `pi pi-bookmark-fill`) */
  iconActive: string
  /** Where a list's search bookmark goes: its filter zone, its header, or nowhere */
  saveSearch: 'filters' | 'header' | false
  /** The text beside the icons (default: icons alone, the text in aria-label and tooltip) */
  labels: boolean
}

export const DEFAULT_FAVORITES_LOOK: FavoritesLook = {
  icon: 'pi pi-bookmark',
  iconActive: 'pi pi-bookmark-fill',
  saveSearch: 'filters',
  labels: false,
}

/** Inside a component's setup */
export function useFavoritesLook(): FavoritesLook {
  const features = inject<{ favorites?: Partial<FavoritesLook> } | null>('qdadmFeatures', null)
  return { ...DEFAULT_FAVORITES_LOOK, ...(features?.favorites ?? {}) }
}
