/**
 * Favourites and recents (#5349): the star, "Save this search", and what was seen lately.
 */
export { useFavorites, useRecent, type UseFavoritesReturn, type UseRecentReturn } from './useFavorites'
export { RECENT_MAX, resetFavoriteLists, configureFavorites, getFavoritesConfig, type Favorite, type RecentItem, type FavoritesOptions, type FavoritesManager } from './store'
export { default as QdFavoriteStar } from '../components/layout/QdFavoriteStar.vue'
export { default as QdSaveSearch } from '../components/lists/QdSaveSearch.vue'
export { useFavoritesLook, DEFAULT_FAVORITES_LOOK, type FavoritesLook } from './look'
