<script setup lang="ts">
/**
 * TaskDialog - follow one task run (#4114)
 *
 * Status, progress (indeterminate without a figure), current step, the live
 * log, then the result or the error, a link to the task, and cancel when the
 * backend allows it. Closing it does not stop anything: the run goes on in
 * the tray. TaskHost renders it; a page may render its own.
 *
 * The window (#4334) moves by its title bar, resizes by its corner and goes
 * full screen (Escape leaves full screen first); its size, position and full
 * screen are kept per app. Under 640px it stays a plain 96vw dialog. Options
 * and slots come layered: qdadm's defaults, the app's (configureTasks), the
 * task kind's, then these props. Slots `header`, `before-log`, `after-log`,
 * `actions` and `result` get `{ run, kind, final }`.
 */
import { computed, inject, onBeforeUnmount, onMounted, ref, useSlots, watch, type Component } from 'vue'
import { RouterLink } from 'vue-router'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'
import QdButton from '../base/QdButton.vue'
import LogStream from '../display/LogStream.vue'
import JsonViewer from '../editors/JsonViewer.vue'
import { useI18n } from '../../i18n/useI18n'
import { getTaskStore } from '../../tasks/taskStore'
import { resolveTaskUi, type TaskDialogOptions, type TaskDialogSlotName } from '../../tasks/taskUi'

interface Props {
  runId: string | null
  /** Window options over the app's and the kind's */
  options?: TaskDialogOptions | null
  /** Shorthand for options.width */
  width?: string
}

const props = withDefaults(defineProps<Props>(), { options: null, width: undefined })
const emit = defineEmits<{ close: [] }>()
const slots = useSlots()

const { t } = useI18n()
const store = getTaskStore()
const appConfig = inject<{ name?: string }>('qdadmApp', {})

const run = computed(() => (props.runId ? store.state.runs.find((r) => r.id === props.runId) ?? null : null))
const def = computed(() => (props.runId ? store.definition(props.runId) : undefined))
const final = computed(() => (run.value ? store.isFinal(run.value.status) : false))
const logSource = computed(() => (run.value?.taskId != null && def.value?.log ? def.value.log(run.value.taskId) : null))
/** The log's download name: the kind and the task, e.g. "deploy-42.log" */
const logFilename = computed(() => {
  const r = run.value
  const name = `${r?.kind ?? 'task'}-${r?.taskId ?? r?.id ?? 'log'}`.replace(/[^\w.-]+/g, '_')
  return `${name}.log`
})
const link = computed(() => (run.value?.taskId != null && def.value?.to ? def.value.to(run.value.taskId) : null))
const canCancel = computed(() => !!def.value?.cancel && !final.value && run.value?.taskId != null)
const resultIsObject = computed(() => run.value?.result !== null && typeof run.value?.result === 'object')

const ui = computed(() => resolveTaskUi(def.value, { ...props.options, ...(props.width ? { width: props.width } : {}) }))
const opts = computed(() => ui.value.dialog)
const slotProps = computed(() => ({ run: run.value, kind: run.value?.kind ?? null, final: final.value }))
/** A page's slot, else the component the app or the kind gave for it */
const slotComponent = (name: TaskDialogSlotName): Component | null => (slots[name] ? null : (ui.value.slots[name] ?? null))
const has = (name: TaskDialogSlotName) => !!slots[name] || !!ui.value.slots[name]

const now = ref(Date.now())
const ticker = setInterval(() => (now.value = Date.now()), 1000)

const elapsed = computed(() => {
  if (!run.value) return ''
  const ms = (run.value.endedAt ?? now.value) - run.value.startedAt
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
})

// ── The window (#4334) ────────────────────────────────────────────────────
const narrowQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 640px)') : null
const narrow = ref(!!narrowQuery?.matches)
const onNarrow = (e: MediaQueryListEvent) => (narrow.value = e.matches)
onMounted(() => narrowQuery?.addEventListener?.('change', onNarrow))

const draggable = computed(() => opts.value.draggable && !narrow.value)
const resizable = computed(() => opts.value.resizable && !narrow.value)
const maximizable = computed(() => opts.value.maximizable)
const remember = computed(() => opts.value.rememberLayout && !narrow.value)

const dialog = ref<{ container?: HTMLElement | null; maximized?: boolean; maximize?: (e?: Event) => void } | null>(null)
const maximized = ref(false)
const layoutKey = computed(() => `qdadm.tasks.dialog.${(appConfig.name ?? 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)

interface Layout {
  width?: number
  height?: number
  left?: number
  top?: number
  maximized?: boolean
}

function readLayout(): Layout {
  try {
    const raw = globalThis.localStorage?.getItem(layoutKey.value)
    return raw ? (JSON.parse(raw) as Layout) : {}
  } catch {
    return {}
  }
}

function saveLayout(patch: Layout): void {
  if (!remember.value) return
  try {
    globalThis.localStorage?.setItem(layoutKey.value, JSON.stringify({ ...readLayout(), ...patch }))
  } catch {
    // No storage: the layout lasts the page
  }
}

const container = () => dialog.value?.container ?? null
// The restored size goes through the bound style, or a re-render puts the default width back
const size = ref<{ width?: string; height?: string }>({})

function onShow(): void {
  if (!remember.value) return
  const saved = readLayout()
  const el = container()
  if (el) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    // Clamped to this viewport: a layout saved on a larger screen stays reachable
    if (resizable.value && saved.width && saved.height) {
      size.value = { width: `${Math.min(saved.width, vw * 0.96)}px`, height: `${Math.min(saved.height, vh * 0.9)}px` }
    }
    if (draggable.value && saved.left !== undefined && saved.top !== undefined) {
      const r = el.getBoundingClientRect()
      el.style.position = 'fixed'
      el.style.margin = '0'
      el.style.left = `${Math.max(0, Math.min(saved.left, vw - r.width))}px`
      el.style.top = `${Math.max(0, Math.min(saved.top, vh - Math.min(r.height, vh)))}px`
    }
  }
  if (saved.maximized && maximizable.value && !dialog.value?.maximized) dialog.value?.maximize?.()
}

function onDragEnd(): void {
  const el = container()
  if (!el) return
  const r = el.getBoundingClientRect()
  saveLayout({ left: Math.round(r.left), top: Math.round(r.top) })
}

// A native corner resize writes px into the inline style: that is the user's size
function onPointerUp(): void {
  const el = container()
  if (!el || !run.value || maximized.value || !resizable.value) return
  if (!el.style.height.endsWith('px')) return
  const r = el.getBoundingClientRect()
  size.value = { width: `${Math.round(r.width)}px`, height: `${Math.round(r.height)}px` }
  saveLayout({ width: Math.round(r.width), height: Math.round(r.height) })
}

function onMaximize(): void {
  maximized.value = true
  saveLayout({ maximized: true })
}

function onUnmaximize(): void {
  maximized.value = false
  saveLayout({ maximized: false })
}

// Escape leaves full screen first, then closes
function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !run.value) return
  if (maximized.value) dialog.value?.maximize?.(event)
  else emit('close')
}

watch(
  () => !!run.value,
  (open) => {
    if (open) {
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('keydown', onKeyDown)
    } else {
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      maximized.value = false
      size.value = {}
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  clearInterval(ticker)
  narrowQuery?.removeEventListener?.('change', onNarrow)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <Dialog
    ref="dialog"
    :visible="!!run"
    :modal="opts.modal"
    :header="run?.label"
    :style="{ width: size.width ?? opts.width, height: size.height }"
    :breakpoints="{ '640px': '96vw' }"
    :draggable="draggable"
    :maximizable="maximizable"
    :close-on-escape="false"
    :position="opts.position"
    class="qd-task-dialog"
    :class="[opts.class, { 'qd-task-dialog--resizable': resizable && !maximized }]"
    @update:visible="(v: boolean) => !v && emit('close')"
    @show="onShow"
    @dragend="onDragEnd"
    @maximize="onMaximize"
    @unmaximize="onUnmaximize"
  >
    <template v-if="has('header')" #header>
      <div class="qd-task-header">
        <slot name="header" v-bind="slotProps">
          <component :is="slotComponent('header')!" v-bind="slotProps" />
        </slot>
      </div>
    </template>
    <template v-if="run">
      <div class="qd-task-head">
        <span class="qd-task-status" :class="`qd-task-status--${run.status}`">
          <i v-if="!final" class="pi pi-spin pi-spinner" />
          <i v-else-if="run.status === 'succeeded'" class="pi pi-check-circle" />
          <i v-else-if="run.status === 'failed'" class="pi pi-times-circle" />
          <i v-else class="pi pi-ban" />
          {{ t(`core.task.status.${run.status}`) }}
        </span>
        <span class="qd-task-elapsed">{{ elapsed }}</span>
        <span v-if="run.taskId !== null" class="qd-task-id">#{{ run.taskId }}</span>
      </div>
      <ProgressBar v-if="!final" class="qd-task-progress" :mode="run.progress === null ? 'indeterminate' : 'determinate'"
        :value="Math.round(run.progress ?? 0)" :show-value="run.progress !== null" />
      <div v-if="run.step" class="qd-task-step">{{ run.step }}</div>
      <div v-if="has('before-log')" class="qd-task-before-log">
        <slot name="before-log" v-bind="slotProps">
          <component :is="slotComponent('before-log')!" v-bind="slotProps" />
        </slot>
      </div>
      <LogStream v-if="logSource" :key="run.id" class="qd-task-log" :source="logSource" :filename="logFilename" height="16rem"
        error-pattern="error|fatal|failed" @done="store.poke(run.id)" />
      <div v-if="has('after-log')" class="qd-task-after-log">
        <slot name="after-log" v-bind="slotProps">
          <component :is="slotComponent('after-log')!" v-bind="slotProps" />
        </slot>
      </div>
      <div v-if="run.status === 'failed' && run.error" class="qd-task-error"><i class="pi pi-exclamation-triangle" /> {{ run.error }}</div>
      <div v-else-if="!final && run.error" class="qd-task-warning">{{ t('core.task.readError', { error: run.error }) }}</div>
      <div v-if="run.status === 'succeeded' && run.result !== null" class="qd-task-result">
        <slot name="result" v-bind="slotProps">
          <component :is="slotComponent('result')!" v-if="slotComponent('result')" v-bind="slotProps" />
          <JsonViewer v-else-if="resultIsObject" :model-value="(run.result as never)" height="12rem" />
          <span v-else>{{ run.result }}</span>
        </slot>
      </div>
    </template>
    <template #footer>
      <RouterLink v-if="link" :to="(link as never)" class="qd-task-link" @click="emit('close')">
        <i class="pi pi-external-link" /> {{ t('core.task.open') }}
      </RouterLink>
      <span class="qd-task-spacer" />
      <template v-if="has('actions') && run">
        <slot name="actions" v-bind="slotProps">
          <component :is="slotComponent('actions')!" v-bind="slotProps" />
        </slot>
      </template>
      <QdButton v-if="canCancel" severity="danger" text :loading="run?.cancelling" icon="pi pi-stop-circle"
        :label="t('core.task.cancel')" @click="run && store.cancel(run.id)" />
      <QdButton :label="final ? t('core.task.close') : t('core.task.background')" severity="secondary" @click="emit('close')" />
    </template>
  </Dialog>
</template>
