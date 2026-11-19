<script setup lang="ts">
/**
 * QdCardsGallery - every registered card, in each state, size and theme (#5339)
 *
 * The reference for the look: mount it on a route of the app (the demo's
 * /cards) and every card registered, qdadm's and the app's, shows from its
 * sheet's example. Each tile carries data-gallery-* attributes, so a script
 * can capture them one by one.
 *
 *   <QdCardsGallery />                         // all cards, light and dark
 *   <QdCardsGallery :types="['metric']" :themes="['light']" />
 */
import { computed } from 'vue'
import QdCardView from './QdCardView.vue'
import { listCards } from './registry'
import { useI18n } from '../i18n/useI18n'
import type { CardDefinition, CardEnvelope, CardState } from './types'

const props = withDefaults(
  defineProps<{
    types?: string[] | null
    themes?: Array<'light' | 'dark'>
    /** Show the sheet (question, readings) above each card */
    sheets?: boolean
  }>(),
  { types: null, themes: () => ['light', 'dark'], sheets: true }
)

const { t } = useI18n()

const cards = computed<CardDefinition[]>(() => listCards().filter((c) => !props.types || props.types.includes(c.type)))
const STATES: CardState[] = ['loading', 'unreachable', 'empty', 'invalid']

/** The example's envelope, read a few minutes ago, at this size and state */
function envelope(card: CardDefinition, patch: Partial<CardEnvelope>): CardEnvelope {
  return { ...card.meta.example.envelope, freshness: new Date(Date.now() - 3 * 60_000), ...patch }
}
</script>

<template>
  <div class="qd-cards-gallery">
    <section v-for="card in cards" :key="card.type" class="qd-gallery-card" :id="`card-${card.type}`">
      <header v-if="sheets" class="qd-gallery-sheet">
        <h2><code>{{ card.type }}</code> {{ card.meta.question }}</h2>
        <ul>
          <li v-for="(r, i) in card.meta.readings" :key="i">{{ r }}</li>
        </ul>
      </header>

      <div
        v-for="theme in themes"
        :key="theme"
        class="qd-gallery-theme"
        :class="{ 'dark-mode': theme === 'dark' }"
        :data-gallery-theme="theme"
      >
        <div class="qd-gallery-row">
          <div
            v-for="size in card.meta.sizes"
            :key="size"
            class="qd-gallery-tile"
            :style="{ '--qd-gallery-span': { s: 1, m: 2, l: 3 }[size] }"
            :data-gallery-card="card.type"
            data-gallery-state="ready"
            :data-gallery-size="size"
          >
            <span class="qd-gallery-label">{{ size }}</span>
            <QdCardView
              :type="card.type"
              :envelope="envelope(card, { size, state: 'ready' })"
              :data="card.meta.example.data"
              :options="card.meta.example.options"
            />
          </div>
        </div>
        <div class="qd-gallery-row">
          <div
            v-for="state in STATES"
            :key="state"
            class="qd-gallery-tile"
            :data-gallery-card="card.type"
            :data-gallery-state="state"
            data-gallery-size="s"
          >
            <span class="qd-gallery-label">{{ state }}</span>
            <QdCardView
              :type="card.type"
              :envelope="
                envelope(card, {
                  size: 's',
                  state: state === 'invalid' ? 'ready' : state,
                  error: state === 'unreachable' ? t('core.cards.galleryUnreachable') : undefined,
                })
              "
              :data="state === 'invalid' ? { value: 'twelve' } : card.meta.example.data"
              :options="card.meta.example.options"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
