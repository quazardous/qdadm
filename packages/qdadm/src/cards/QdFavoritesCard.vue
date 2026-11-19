<script setup lang="ts">
/**
 * QdFavoritesCard (#5349): the person's favourites, live. A star clicked in
 * a page header, a search saved, show here at once.
 *
 *   ctx.block(DASHBOARD_ZONES.WIDGETS, { id: 'favorites', component: QdFavoritesCard, card: { title: 'Favourites' } })
 */
import { computed, onMounted } from 'vue'
import QdCardView from './QdCardView.vue'
import { useI18n } from '../i18n/useI18n'
import { useFavorites } from '../favorites/useFavorites'
import type { CardSize } from './types'

const props = withDefaults(defineProps<{ title?: string | null; size?: CardSize; maxItems?: number; groupByKind?: boolean }>(), {
  title: null,
  size: 's',
  maxItems: 8,
  groupByKind: true,
})
const { tOr } = useI18n()
const favorites = useFavorites()
// Read again when it shows: another tab or a page may have changed them
onMounted(() => void favorites.reload())

const envelope = computed(() => ({
  title: props.title ?? tOr('core.favorites.title', 'Favourites'),
  size: props.size,
  state: !favorites.available
    ? ('empty' as const)
    : !favorites.loaded.value
      ? ('loading' as const)
      : favorites.error.value && !favorites.list.value.length
        ? ('unreachable' as const)
        : favorites.list.value.length
          ? ('ready' as const)
          : ('empty' as const),
  error: favorites.error.value ?? undefined,
  emptyText: favorites.available
    ? tOr('core.favorites.none', 'No favourites yet: the star beside a page title adds one')
    : tOr('core.favorites.noEntity', 'No favorites entity is declared'),
}))
const data = computed(() => ({
  // The latest first
  items: [...favorites.list.value].reverse().map((f) => ({ label: f.label, to: f.to, kind: f.kind })),
}))
</script>

<template>
  <QdCardView type="favorites" :envelope="envelope" :data="data" :options="{ maxItems, groupByKind }" />
</template>
