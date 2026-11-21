<script setup lang="ts">
/**
 * flash block (#5414): a "flash info" banner, an urgent word about the card
 * (a source down, a threshold crossed). The most serious first, one line
 * each, its level written for screen readers and in an icon, never in colour
 * alone; a critical message is an alert. Dismissible when the app says so:
 * gone until the card is drawn again, or for the session with an `id`.
 * Inside a card it sits at its `place` (QdCard draws it); alone, where it is.
 */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from '../../i18n/useI18n'
import type { FlashBlock, FlashMessage } from './types'
import type { CardSize } from '../types'

const props = defineProps<{ block: FlashBlock; size: CardSize }>()
const { t, tOr } = useI18n()

const RANK = { critical: 0, warning: 1, info: 2 } as const
const ICON = { critical: 'pi pi-exclamation-circle', warning: 'pi pi-exclamation-triangle', info: 'pi pi-info-circle' } as const
const TONE = { critical: 'critical', warning: 'watch', info: 'info' } as const

const messages = computed<FlashMessage[]>(() => {
  const b = props.block
  const list = b.messages ?? (b.text && b.level ? [{ level: b.level, text: b.text, ...(b.to ? { to: b.to } : {}) }] : [])
  return [...list].sort((a, z) => RANK[a.level] - RANK[z.level])
})
const worst = computed(() => messages.value[0]?.level ?? 'info')

const storageKey = computed(() => (props.block.id ? `qd-flash:${props.block.id}` : null))
function remembered(): boolean {
  if (!storageKey.value) return false
  try {
    return sessionStorage.getItem(storageKey.value) === '1'
  } catch {
    return false
  }
}
const dismissed = ref(remembered())
function dismiss(): void {
  dismissed.value = true
  if (!storageKey.value) return
  try {
    sessionStorage.setItem(storageKey.value, '1')
  } catch {
    // Private mode: hidden until the card is drawn again
  }
}
</script>

<template>
  <div
    v-if="messages.length && !dismissed"
    class="qd-card-flash qd-card-block"
    :data-level="worst"
    :data-place="block.place ?? 'top'"
    :role="worst === 'critical' ? 'alert' : 'status'"
    data-block="flash"
  >
    <ul class="qd-card-flash-list">
      <li v-for="(m, i) in messages" :key="i" class="qd-card-flash-item" :data-level="m.level" :class="`qd-tone-text--${TONE[m.level]}`">
        <i :class="ICON[m.level]" aria-hidden="true"></i>
        <span class="qd-card-sr">{{ t(`core.cards.flash.${m.level}`) }}: </span>
        <component :is="m.to ? RouterLink : 'span'" :to="m.to" class="qd-card-flash-text" :title="m.text">{{ m.text }}</component>
      </li>
    </ul>
    <button
      v-if="block.dismissible"
      type="button"
      class="qd-card-flash-close"
      :aria-label="tOr('core.cards.flash.dismiss', 'Dismiss')"
      :title="tOr('core.cards.flash.dismiss', 'Dismiss')"
      data-flash-dismiss
      @click="dismiss"
    >
      <i class="pi pi-times" aria-hidden="true"></i>
    </button>
  </div>
</template>
