<script setup lang="ts">
/**
 * QdRunBar (#5343): where this item is in the run it was opened from.
 *
 * "Book 3 of 14 to process", how the items were chosen and ordered, how many
 * are done; Previous / Next, and K / J on the keyboard; the strip, one segment
 * per item (done filled, urgent warm, current outlined, each saying so in its
 * title too). FormPage and ShowPage render it when the URL carries `?run=`;
 * it renders nothing otherwise.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { useRun } from '../../run/useRun'

const props = withDefaults(defineProps<{ entityLabel?: string | null }>(), { entityLabel: null })

const { t } = useI18n()
const run = useRun()

const heading = computed(() => {
  const r = run.run.value
  if (!r) return ''
  const where = t('core.run.position', { position: run.position.value, total: run.total.value })
  return [props.entityLabel, where, r.label].filter(Boolean).join(' ')
})

const details = computed(() => {
  const r = run.run.value
  if (!r) return []
  return [
    r.order ? t('core.run.order', { order: r.order }) : null,
    r.filter ? t('core.run.filter', { filter: r.filter }) : null,
    run.doneCount.value ? t('core.run.doneSince', { count: run.doneCount.value }) : null,
  ].filter((d): d is string => !!d)
})

const segments = computed(() =>
  (run.run.value?.items ?? []).map((item, i) => {
    const state = i === run.index.value ? 'current' : item.done ? 'done' : item.urgent ? 'urgent' : 'todo'
    const name = item.label ?? item.id
    return { i, state, done: !!item.done, title: `${i + 1}. ${name} · ${t(`core.run.state.${state}`)}` }
  })
)

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"]')
}

function onKey(e: KeyboardEvent): void {
  if (!run.active.value || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || typing(e.target)) return
  const key = e.key.toLowerCase()
  if (key === 'j' && run.next.value) {
    e.preventDefault()
    void run.goNext()
  } else if (key === 'k' && run.prev.value) {
    e.preventDefault()
    void run.goPrev()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <nav v-if="run.active.value" class="qd-run-bar" :aria-label="t('core.run.bar')" data-run-bar>
    <button type="button" class="qd-run-step qd-run-prev" :disabled="!run.prev.value" @click="run.goPrev()">
      <i class="pi pi-arrow-left" aria-hidden="true"></i>
      <span>{{ t('core.run.prev') }}</span>
      <kbd aria-hidden="true">K</kbd>
    </button>

    <div class="qd-run-where">
      <div class="qd-run-heading" aria-live="polite">{{ heading }}</div>
      <div v-if="details.length" class="qd-run-details">{{ details.join(' · ') }}</div>
      <ol class="qd-run-strip">
        <li v-for="seg in segments" :key="seg.i">
          <button
            type="button"
            class="qd-run-seg"
            :data-state="seg.state"
            :title="seg.title"
            :aria-label="seg.title"
            :aria-current="seg.state === 'current' ? 'step' : undefined"
            @click="run.goTo(seg.i)"
          ></button>
        </li>
      </ol>
    </div>

    <button type="button" class="qd-run-step qd-run-next" :disabled="!run.next.value" @click="run.goNext()">
      <span>{{ t('core.run.next') }}</span>
      <kbd aria-hidden="true">J</kbd>
      <i class="pi pi-arrow-right" aria-hidden="true"></i>
    </button>
  </nav>
</template>
