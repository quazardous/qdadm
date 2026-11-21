<script setup lang="ts">
/**
 * QdFavoritesCard (#5349): the person's favourites, live. A star clicked in
 * a page header, a search saved, show here at once.
 *
 *   ctx.block(DASHBOARD_ZONES.WIDGETS, { id: 'favorites', component: QdFavoritesCard, card: { title: 'Favourites' } })
 *
 * A × beside each line removes it (#5392), at once; the line stays a few
 * seconds where it was, saying so, with an Undo that adds it back.
 * Renaming and ordering are the app's to offer: `useFavorites().rename`.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import QdCardView from './QdCardView.vue'
import { useI18n } from '../i18n/useI18n'
import { useFavorites } from '../favorites/useFavorites'
import type { Favorite } from '../favorites/store'
import { useFavoritesLook } from '../favorites/look'
import type { CardSize } from './types'

const props = withDefaults(
  defineProps<{ title?: string | null; size?: CardSize; maxItems?: number; groupByKind?: boolean; removable?: boolean; icon?: string | null }>(),
  {
    title: null,
    size: 's',
    maxItems: 8,
    groupByKind: true,
    removable: true,
    icon: undefined,
  }
)
const { tOr } = useI18n()
const favorites = useFavorites()
// Its header shows the app's favourite symbol (#5402), unless told otherwise
const look = useFavoritesLook()
// Read again when it shows: another tab or a page may have changed them
onMounted(() => void favorites.reload())

/** How long a removed line stays, with its Undo */
const UNDO_MS = 8000

// The lines just removed: where they were in the list, until their Undo goes
interface Removed {
  fav: Favorite
  index: number
  timer: ReturnType<typeof setTimeout>
}
const removed = ref<Removed[]>([])

function drop(id: string): void {
  const r = removed.value.find((x) => x.fav.id === id)
  if (r) clearTimeout(r.timer)
  removed.value = removed.value.filter((x) => x.fav.id !== id)
}

async function onRemove(id: string): Promise<void> {
  const shown = [...favorites.list.value].reverse()
  const index = shown.findIndex((f) => f.id === id)
  if (index < 0) return
  const fav = shown[index]!
  removed.value = [...removed.value, { fav, index, timer: setTimeout(() => drop(id), UNDO_MS) }]
  await favorites.remove(id)
  // It failed: it is back in the list, no Undo to show
  if (favorites.list.value.some((f) => f.id === id)) drop(id)
}

async function onRestore(id: string): Promise<void> {
  const r = removed.value.find((x) => x.fav.id === id)
  if (!r) return
  drop(id)
  const { id: _id, at: _at, ...entry } = r.fav
  await favorites.add(entry)
}

onBeforeUnmount(() => removed.value.forEach((r) => clearTimeout(r.timer)))

const envelope = computed(() => ({
  title: props.title ?? tOr('core.favorites.title', 'Favourites'),
  icon: props.icon !== undefined ? props.icon : look.icon,
  size: props.size,
  state: !favorites.available
    ? ('empty' as const)
    : !favorites.loaded.value
      ? ('loading' as const)
      : favorites.error.value && !favorites.list.value.length && !removed.value.length
        ? ('unreachable' as const)
        : favorites.list.value.length || removed.value.length
          ? ('ready' as const)
          : ('empty' as const),
  error: favorites.error.value ?? undefined,
  emptyText: favorites.available
    ? tOr('core.favorites.none', 'No favourites yet: the star beside a page title adds one')
    : tOr('core.favorites.noEntity', 'No favorites entity is declared'),
}))

const line = (f: Favorite, gone = false) => ({ id: f.id, label: f.label, to: f.to, kind: f.kind, ...(gone ? { removed: true } : {}) })
const data = computed(() => {
  // The latest first, each removed line back where it was
  const items = [...favorites.list.value].reverse().map((f) => line(f))
  for (const r of [...removed.value].sort((a, b) => a.index - b.index)) items.splice(Math.min(r.index, items.length), 0, line(r.fav, true))
  return { items }
})
</script>

<template>
  <QdCardView
    type="favorites"
    :envelope="envelope"
    :data="data"
    :options="{ maxItems, groupByKind, removable }"
    :on="{ remove: onRemove, restore: onRestore }"
  />
</template>
