<script setup lang="ts">
/**
 * QdFavoriteStar (#5349): follow this page. A star beside the page's title:
 * pressed when the page is a favourite, saying so in words too.
 *
 * PageHeader draws it on list, show and edit pages; a page of the app's own
 * puts it where it wants. It shows only when the app declares the favorites
 * entity:
 *
 *   <QdFavoriteStar :label="title" kind="board" />
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '../../i18n/useI18n'
import { useFavorites } from '../../favorites/useFavorites'
import type { Favorite } from '../../favorites/store'

const props = withDefaults(
  defineProps<{
    /** The favourite's name: the page's title */
    label: string
    kind?: Favorite['kind']
    entity?: string | null
    /** A record's id: its show and edit pages share one favourite */
    itemId?: string | number | null
    /** The page, as a path; default the current route's path, without its query */
    to?: string | null
  }>(),
  { kind: 'item', entity: null, itemId: null, to: null }
)

const route = useRoute() as ReturnType<typeof useRoute> | undefined
const { tOr } = useI18n()
const favorites = useFavorites()

const target = computed(() => props.to ?? route?.path ?? '')
const isItem = computed(() => !!props.entity && props.itemId !== null && props.itemId !== undefined && props.itemId !== '')
const on = computed(() => (isItem.value ? !!favorites.findItem(props.entity!, props.itemId!) : favorites.has(target.value)))
const text = computed(() =>
  on.value
    ? tOr('core.favorites.remove', 'Remove {label} from favourites', { label: props.label })
    : tOr('core.favorites.add', 'Add {label} to favourites', { label: props.label })
)

function toggle(): void {
  if (!target.value || !props.label) return
  void favorites.toggle({
    kind: props.kind,
    label: props.label,
    to: target.value,
    ...(props.entity ? { entity: props.entity } : {}),
    ...(isItem.value ? { itemId: String(props.itemId) } : {}),
  })
}
</script>

<template>
  <button
    v-if="favorites.available && target && label"
    type="button"
    class="qd-favorite-star"
    :class="{ 'qd-favorite-on': on }"
    :aria-pressed="on"
    :aria-label="text"
    :title="text"
    data-favorite-star
    @click="toggle"
  >
    <i :class="on ? 'pi pi-star-fill' : 'pi pi-star'" aria-hidden="true"></i>
  </button>
</template>
