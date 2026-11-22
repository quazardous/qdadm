<script setup lang="ts">
/**
 * QdRunBar (#5343): where this item is in the run it was opened from.
 *
 * One slim line, drawn like the domain bar's toolbox (#5453): Back to the
 * list (L), Previous (J), "Book 3 of 14 to process" with how the items were
 * chosen and ordered and how many are done, a thin strip under it (one
 * segment per item: done filled, urgent warm, current outlined, each saying
 * so in its title too), Next (K). The keys are the app's or the run's
 * (#5454, `features.run.keys`, `RunInit.keys`). It renders when the URL carries `?run=`.
 *
 * AppLayout hosts it at the foot of the content (`placement="foot"`), sticky
 * at the bottom, flush to the edges; it provides RUN_BAR_HOST, and the
 * pages' own bar (ShowPage, FormPage: `inline`, the default) then draws
 * nothing. An app without AppLayout keeps the pages' bar.
 */
import { computed, inject, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { useRun } from '../../run/useRun'
import { RUN_BAR_HOST } from './host'
import { runToneColor, type RunKeys } from '../../run/run'
import { resolveRunKeys, runKeyAction, duplicateRunKeys, runKeyHint, runKeyShortcut } from '../../run/keys'

const props = withDefaults(defineProps<{ entityLabel?: string | null; placement?: 'inline' | 'foot' }>(), { entityLabel: null, placement: 'inline' })

const { t } = useI18n()
const run = useRun()
const hosted = inject(RUN_BAR_HOST, false)
const orchestrator = inject<{ get?: (name: string) => { label?: string } | undefined } | null>('qdadmOrchestrator', null)

/** The foot draws it; a page's own bar only where no layout hosts one */
const drawn = computed(() => run.active.value && (props.placement === 'foot' || !hosted))
const canBack = computed(() => !!run.run.value?.returnTo)

// Its keys (#5454): the run's, else the app's (features.run.keys), else J / K / L
const features = inject<{ run?: { keys?: RunKeys } } | null>('qdadmFeatures', null)
const keys = computed(() => resolveRunKeys(run.run.value?.keys, features?.run?.keys))
const hints = computed(() => ({
  prev: keys.value.prev ? runKeyHint(keys.value.prev) : null,
  next: keys.value.next ? runKeyHint(keys.value.next) : null,
  back: keys.value.back ? runKeyHint(keys.value.back) : null,
}))
const shortcuts = computed(() => ({
  prev: keys.value.prev ? runKeyShortcut(keys.value.prev) : undefined,
  next: keys.value.next ? runKeyShortcut(keys.value.next) : undefined,
  back: keys.value.back ? runKeyShortcut(keys.value.back) : undefined,
}))
watch(
  keys,
  (k) => {
    const twice = duplicateRunKeys(k)
    if (import.meta.env.DEV && twice.length) console.warn(`[qdadm] QdRunBar: the key${twice.length > 1 ? 's' : ''} ${twice.map((x) => `'${x}'`).join(', ')} go to two actions; the first one (prev, next, back) keeps it`)
  },
  { immediate: true }
)

const label = computed(() => {
  if (props.entityLabel) return props.entityLabel
  const entity = run.run.value?.entity
  return (entity && orchestrator?.get?.(entity)?.label) || null
})

const heading = computed(() => {
  const r = run.run.value
  if (!r) return ''
  const where = t('core.run.position', { position: run.position.value, total: run.total.value })
  return [label.value, where, r.label].filter(Boolean).join(' ')
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
    // What it is, current or not: its fill (#5455)
    const base = item.done ? 'done' : item.urgent ? 'urgent' : 'todo'
    const state = i === run.index.value ? 'current' : base
    const name = item.label ?? item.id
    // The app's colour for it, to do or done; else the state's default
    const fill = runToneColor(item.done ? item.doneTone : item.tone)
    return {
      i,
      state,
      base,
      done: !!item.done,
      style: fill ? { '--qd-run-seg-fill': fill } : undefined,
      title: `${i + 1}. ${name} · ${t(`core.run.state.${state}`)}`,
    }
  })
)

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"]')
}

function onKey(e: KeyboardEvent): void {
  if (!drawn.value || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || typing(e.target)) return
  const action = runKeyAction(keys.value, e.key)
  if (action === 'prev' && run.prev.value) {
    e.preventDefault()
    void run.goPrev()
  } else if (action === 'next' && run.next.value) {
    e.preventDefault()
    void run.goNext()
  } else if (action === 'back' && canBack.value) {
    e.preventDefault()
    void run.end()
  }
}

// Listen only while drawn: a hosted page bar never doubles the foot's keys
let listening = false
function listen(on: boolean): void {
  if (on === listening) return
  listening = on
  if (on) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
}
onMounted(() => listen(drawn.value))
watch(drawn, (on) => listen(on))
onBeforeUnmount(() => listen(false))
</script>

<template>
  <nav v-if="drawn" class="qd-run-bar" :class="`qd-run-bar--${placement}`" :aria-label="t('core.run.bar')" data-run-bar>
    <button v-if="canBack" type="button" class="qd-run-step qd-run-back" :aria-label="t('core.run.back')" :aria-keyshortcuts="shortcuts.back" data-run-back @click="run.end()">
      <i class="pi pi-arrow-left" aria-hidden="true"></i>
      <span class="qd-run-step-label">{{ t('core.run.back') }}</span>
      <kbd v-if="hints.back" aria-hidden="true">{{ hints.back }}</kbd>
    </button>

    <button type="button" class="qd-run-step qd-run-prev" :aria-label="t('core.run.prev')" :aria-keyshortcuts="shortcuts.prev" :disabled="!run.prev.value" @click="run.goPrev()">
      <i class="pi pi-chevron-left" aria-hidden="true"></i>
      <span class="qd-run-step-label">{{ t('core.run.prev') }}</span>
      <kbd v-if="hints.prev" aria-hidden="true">{{ hints.prev }}</kbd>
    </button>

    <div class="qd-run-where">
      <div class="qd-run-line" :title="[heading, ...details].join(' · ')">
        <span class="qd-run-heading" aria-live="polite">{{ heading }}</span>
        <span v-if="details.length" class="qd-run-details">{{ details.join(' · ') }}</span>
      </div>
      <ol class="qd-run-strip">
        <li v-for="seg in segments" :key="seg.i">
          <button
            type="button"
            class="qd-run-seg"
            :data-state="seg.state"
            :data-base="seg.base"
            :style="seg.style"
            :title="seg.title"
            :aria-label="seg.title"
            :aria-current="seg.state === 'current' ? 'step' : undefined"
            @click="run.goTo(seg.i)"
          ></button>
        </li>
      </ol>
    </div>

    <button type="button" class="qd-run-step qd-run-next" :aria-label="t('core.run.next')" :aria-keyshortcuts="shortcuts.next" :disabled="!run.next.value" @click="run.goNext()">
      <span class="qd-run-step-label">{{ t('core.run.next') }}</span>
      <kbd v-if="hints.next" aria-hidden="true">{{ hints.next }}</kbd>
      <i class="pi pi-chevron-right" aria-hidden="true"></i>
    </button>
  </nav>
</template>
