<script setup lang="ts">
/**
 * QdLayoutCatalogue (#5526): a layout's catalogue, shared by the dashboards
 * and an app's own editors (a domain bar's): the items to add, each with its
 * parameters (a repeatable item, as many times as wanted), and the hidden
 * ones, which come back where they were. It only says what was chosen: the
 * layout changes in the hands of whoever holds it.
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { nextTick, ref, type PropType } from 'vue'
import QdButton from '../base/QdButton.vue'
import CardParamsForm from './CardParamsForm.vue'
import { useI18n } from '../../i18n/useI18n'
import type { CardDef } from '../../composables/useCardsArrangement'

const props = defineProps({
  /** The items to add: repeatable ones, each with its `params` schema */
  templates: { type: Array as PropType<CardDef[]>, default: () => [] },
  /** The hidden items, to show again */
  hidden: { type: Array as PropType<CardDef[]>, default: () => [] },
  /** The sections an added item may go to; none: no choice */
  sections: { type: Array as PropType<Array<{ id: string; title: string }>>, default: () => [] },
  /** Prefix of the parameter fields' ids */
  idPrefix: { type: String, default: 'qd-layout-param' },
  /** A line more under an item, such as what its card type answers */
  describe: { type: Function as PropType<(c: CardDef) => string | null>, default: null },
})
const emit = defineEmits<{
  (e: 'add', card: CardDef, value: { params: Record<string, unknown>; title: string; section: string | null }): void
  (e: 'restore', card: CardDef): void
}>()
const { tOr } = useI18n()

const root = ref<HTMLElement | null>(null)
const adding = ref<CardDef | null>(null)
const title = (c: CardDef) => tOr(c.card.title, c.card.title)
const description = (c: CardDef) => (c.card.description ? tOr(c.card.description, c.card.description) : null)

async function choose(c: CardDef): Promise<void> {
  adding.value = c
  await nextTick()
  root.value?.querySelector<HTMLInputElement>('form input, form select')?.focus()
}
function add(value: { params: Record<string, unknown>; title: string; section: string | null }): void {
  const c = adding.value
  if (!c) return
  adding.value = null
  emit('add', c, value)
}
defineExpose({ adding })
</script>

<template>
  <div ref="root" class="qd-layout-catalogue">
    <template v-if="adding">
      <h3>{{ title(adding) }}</h3>
      <p v-if="description(adding)" class="qd-cards-catalogue-desc">{{ description(adding) }}</p>
      <CardParamsForm
        :schema="adding.card.params ?? null"
        :title="title(adding)"
        :sections="sections"
        :id-prefix="idPrefix"
        @submit="add"
        @cancel="adding = null"
      />
    </template>
    <template v-else>
      <ul class="qd-cards-catalogue-list">
        <li v-for="c in templates" :key="c.id" class="qd-cards-catalogue-item" :data-catalogue-card="c.id">
          <div class="qd-cards-catalogue-text">
            <strong>{{ title(c) }}</strong>
            <span v-if="description(c)">{{ description(c) }}</span>
            <span v-if="describe && describe(c)" class="qd-cards-catalogue-question">{{ describe(c) }}</span>
          </div>
          <QdButton type="button" size="small" outlined icon="pi pi-plus" :label="tOr('core.cardsDashboard.add', 'Add')" :aria-label="tOr('core.cardsDashboard.addOne', 'Add {title}', { title: title(c) })" @click="choose(c)" />
        </li>
        <li v-for="c in hidden" :key="`hidden-${c.id}`" class="qd-cards-catalogue-item" :data-catalogue-hidden="c.id">
          <div class="qd-cards-catalogue-text">
            <strong>{{ title(c) }}</strong>
            <span>{{ tOr('core.cardsDashboard.hiddenNow', 'Hidden: it comes back where it was') }}</span>
          </div>
          <QdButton type="button" size="small" text icon="pi pi-eye" :label="tOr('core.cardsDashboard.show', 'Show')" :aria-label="tOr('core.cardsDashboard.restore', 'Show {title}', { title: title(c) })" @click="emit('restore', c)" />
        </li>
      </ul>
      <p v-if="!templates.length && !hidden.length" class="qd-cards-tray-empty">{{ tOr('core.cardsDashboard.catalogueEmpty', 'Every card is already on the board') }}</p>
    </template>
  </div>
</template>
