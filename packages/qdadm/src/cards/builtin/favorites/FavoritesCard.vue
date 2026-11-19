<script setup lang="ts">
/**
 * favorites - what do I follow? (#5349)
 *
 * The pages someone starred and the searches they saved, grouped by kind,
 * each opening its page. QdFavoritesCard feeds it live from useFavorites.
 * See meta.json for the sheet.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../../i18n/useI18n'
import type { CardSize } from '../../types'

type Kind = 'item' | 'list' | 'search' | 'board'
interface FavoritesData {
  items: Array<{ label: string; to: RouteLocationRaw; kind?: Kind }>
}

const props = defineProps<{ data: FavoritesData; options: { maxItems?: number; groupByKind?: boolean }; size: CardSize }>()
const { t } = useI18n()

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
</script>

<template>
  <div class="qd-favorites">
    <section v-for="g in groups" :key="g.kind ?? 'all'" class="qd-favorites-group">
      <h3 v-if="g.kind" class="qd-favorites-kind">{{ t(`core.favorites.kind.${g.kind}`) }}</h3>
      <ul class="qd-favorites-list">
        <li v-for="(item, i) in g.items" :key="i">
          <RouterLink :to="item.to" class="qd-favorites-link">
            <i :class="ICON[item.kind ?? 'item']" aria-hidden="true"></i>
            <span>{{ item.label }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
    <p v-if="more > 0" class="qd-favorites-more">{{ t('core.cards.moreProblems', { count: more }) }}</p>
  </div>
</template>
