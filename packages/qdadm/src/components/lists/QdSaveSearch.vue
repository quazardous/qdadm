<script setup lang="ts">
/**
 * QdSaveSearch (#5349): "Save this search" on a filtered list. It asks for a
 * name (by default the filter in words) and keeps the list's route with its
 * query as a favourite of kind `search`: the list writes its filters in the
 * URL, so the favourite opens it filtered again.
 *
 * Its look (#5402): the app's favourite symbol (`features.favorites`), the
 * bookmark by default, alone, its text in aria-label and tooltip; filled once
 * saved, and then a click takes the search out of the favourites again.
 */
import { computed, nextTick, ref } from 'vue'
import { useRoute } from 'vue-router'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'
import { useFavorites } from '../../favorites/useFavorites'
import { useFavoritesLook } from '../../favorites/look'

const props = withDefaults(
  defineProps<{
    defaultName: string
    entity?: string | null
    /** Its symbol, and once saved; default the app's (`features.favorites`) */
    icon?: string | null
    iconOn?: string | null
    /** Its text beside it; default the app's `features.favorites.labels` */
    labelled?: boolean | null
  }>(),
  { entity: null, icon: null, iconOn: null, labelled: null }
)

const route = useRoute() as ReturnType<typeof useRoute> | undefined
const { tOr } = useI18n()
const favorites = useFavorites()

/** The list as it is now, without a run's key */
const target = computed(() => {
  if (!route) return ''
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(route.query)) {
    if (k === 'run' || v === null || v === undefined) continue
    for (const one of Array.isArray(v) ? v : [v]) if (one !== null) params.append(k, String(one))
  }
  const q = params.toString()
  return q ? `${route.path}?${q}` : route.path
})
const saved = computed(() => favorites.has(target.value))
const look = useFavoritesLook()
const symbol = computed(() => (saved.value ? props.iconOn ?? look.iconActive : props.icon ?? look.icon))
const withText = computed(() => props.labelled ?? look.labels)
const text = computed(() =>
  saved.value ? tOr('core.favorites.removeSearch', 'Search saved: remove it from favourites') : tOr('core.favorites.saveSearch', 'Save this search')
)

const asking = ref(false)
const name = ref('')
const input = ref<HTMLInputElement | null>(null)

async function ask(): Promise<void> {
  // Saved already: the same symbol takes it out again, as the page's does
  if (saved.value) {
    const fav = favorites.find(target.value)
    if (fav) await favorites.remove(fav.id)
    return
  }
  name.value = props.defaultName
  asking.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

async function close(): Promise<void> {
  asking.value = false
  await nextTick()
  ;(document.querySelector('[data-save-search]') as HTMLElement | null)?.focus()
}

function save(): void {
  const label = name.value.trim() || props.defaultName
  void favorites.add({ kind: 'search', label, to: target.value, ...(props.entity ? { entity: props.entity } : {}) })
  void close()
}
</script>

<template>
  <template v-if="favorites.available">
  <form v-if="asking" class="qd-save-search" @submit.prevent="save" @keydown.esc.prevent="close">
    <label class="qd-cards-sr" for="qd-save-search-name">{{ tOr('core.favorites.searchName', 'Name of the search') }}</label>
    <input id="qd-save-search-name" ref="input" v-model="name" type="text" class="qd-save-search-input" />
    <QdButton type="submit" size="small" icon="pi pi-check" :label="tOr('core.favorites.save', 'Save')" />
    <QdButton type="button" size="small" text :label="tOr('core.actions.cancel', 'Cancel')" @click="close" />
  </form>
  <QdButton
    v-else
    type="button"
    size="small"
    text
    :rounded="!withText"
    severity="secondary"
    :icon="symbol"
    :label="withText ? text : undefined"
    :aria-label="text"
    :aria-pressed="saved ? 'true' : 'false'"
    v-tooltip.top="withText ? undefined : text"
    class="qd-save-search-toggle"
    :class="{ 'qd-save-search-toggle--on': saved }"
    data-save-search
    @click="ask"
  />
  </template>
</template>
