<script setup lang="ts">
/**
 * favorites - what do I follow? (#5349)
 *
 * The pages someone starred and the searches they saved, grouped by kind,
 * each opening its page. QdFavoritesCard feeds it live from useFavorites.
 * See meta.json for the sheet.
 *
 * `removable` (#5392): a × beside each line that has an id, shown on hover
 * and focus (always on a touch screen). The card only says it: `remove` with
 * the id; a line marked `removed` reads so, with an Undo that says `restore`.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../../i18n/useI18n'
import type { CardSize } from '../../types'

type Kind = 'item' | 'list' | 'search' | 'board'
interface FavoriteLine {
  id?: string
  label: string
  to: RouteLocationRaw
  kind?: Kind
  removed?: boolean
}
interface FavoritesData {
  items: FavoriteLine[]
}

const props = defineProps<{ data: FavoritesData; options: { maxItems?: number; groupByKind?: boolean; removable?: boolean }; size: CardSize }>()
const emit = defineEmits<{ remove: [id: string]; restore: [id: string] }>()
const { t, tOr } = useI18n()

const KINDS: Kind[] = ['item', 'list', 'search', 'board']
const ICON: Record<Kind, string> = { item: 'pi pi-file', list: 'pi pi-list', search: 'pi pi-filter', board: 'pi pi-th-large' }

const shown = computed(() => props.data.items.slice(0, props.options.maxItems ?? 8))
const groups = computed(() => {
  const byKind = KINDS.map((kind) => ({ kind, items: shown.value.filter((i) => (i.kind ?? 'item') === kind) })).filter((g) => g.items.length)
  // One kind, or no grouping: one plain list
  if (props.options.groupByKind === false || byKind.length < 2) return [{ kind: null as Kind | null, items: shown.value }]
  return byKind
})
const more = computed(() => props.data.items.length - shown.value.length)
const canRemove = (item: FavoriteLine) => !!props.options.removable && !!item.id

// The × goes with its line: the focus moves to the Undo that replaces it
const root = ref<HTMLElement | null>(null)
const removing = ref<string | null>(null)
function remove(id: string): void {
  removing.value = id
  emit('remove', id)
}
watch(
  () => props.data.items,
  async () => {
    const id = removing.value
    if (!id || !props.data.items.some((i) => i.id === id && i.removed)) return
    removing.value = null
    await nextTick()
    const buttons = root.value ? Array.from(root.value.querySelectorAll('[data-favorite-undo]')) : []
    const undo = buttons.find((b) => (b.closest('[data-favorite]') as HTMLElement | null)?.dataset.favorite === id) as HTMLElement | undefined
    undo?.focus()
  }
)
</script>

<template>
  <div ref="root" class="qd-favorites" :class="{ 'qd-favorites--removable': options.removable }">
    <section v-for="g in groups" :key="g.kind ?? 'all'" class="qd-favorites-group">
      <h3 v-if="g.kind" class="qd-favorites-kind">{{ t(`core.favorites.kind.${g.kind}`) }}</h3>
      <ul class="qd-favorites-list">
        <li v-for="(item, i) in g.items" :key="item.id ?? i" class="qd-favorites-item" :data-favorite="item.id" :data-removed="item.removed || undefined">
          <template v-if="item.removed">
            <span class="qd-favorites-removed" role="status">{{ tOr('core.favorites.removed', '{label} removed from favourites', { label: item.label }) }}</span>
            <button
              v-if="item.id"
              type="button"
              class="qd-favorites-undo"
              :aria-label="tOr('core.favorites.undoLabel', 'Put {label} back in favourites', { label: item.label })"
              data-favorite-undo
              @click="emit('restore', item.id)"
            >
              {{ tOr('core.favorites.undo', 'Undo') }}
            </button>
          </template>
          <template v-else>
            <RouterLink :to="item.to" class="qd-favorites-link" :title="item.label">
              <i :class="ICON[item.kind ?? 'item']" aria-hidden="true"></i>
              <span class="qd-favorites-label">{{ item.label }}</span>
            </RouterLink>
            <button
              v-if="canRemove(item)"
              type="button"
              class="qd-favorites-remove"
              :aria-label="tOr('core.favorites.remove', 'Remove {label} from favourites', { label: item.label })"
              :title="tOr('core.favorites.remove', 'Remove {label} from favourites', { label: item.label })"
              data-favorite-remove
              @click="remove(item.id!)"
            >
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </template>
        </li>
      </ul>
    </section>
    <p v-if="more > 0" class="qd-favorites-more">{{ t('core.cards.moreProblems', { count: more }) }}</p>
  </div>
</template>
