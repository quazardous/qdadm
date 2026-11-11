<script setup lang="ts">
/**
 * TaskRunView - one run followed, without its window (#4934)
 *
 * The body of TaskDialog: status, elapsed time, progress, current step, the
 * phases frieze (#4655), the live log, then the error or the result. The
 * sequence window shows it for the step picked in its list. Slots
 * `before-log`, `after-log` and `result` get `{ run, kind, final }`; without
 * one, the app's or the kind's component for it.
 */
import { computed, onBeforeUnmount, ref, useSlots, watch, type Component } from 'vue'
import ProgressBar from 'primevue/progressbar'
import LogStream from '../display/LogStream.vue'
import TaskPhases from './TaskPhases.vue'
import JsonViewer from '../editors/JsonViewer.vue'
import { useI18n } from '../../i18n/useI18n'
import { getTaskStore } from '../../tasks/taskStore'
import { resolveTaskUi, type TaskDialogOptions, type TaskDialogSlotName } from '../../tasks/taskUi'
import { phaseLabel, phasesMarkedIn, phaseSteps, type TaskPhase } from '../../tasks/taskPhases'

interface Props {
  runId: string | null
  /** Options over the app's and the kind's (the log's patterns, the phases' icons come from the kind) */
  options?: TaskDialogOptions | null
}

const props = withDefaults(defineProps<Props>(), { options: null })
const slots = useSlots()

const { t, tOr } = useI18n()
const store = getTaskStore()

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
const resultIsObject = computed(() => run.value?.result !== null && typeof run.value?.result === 'object')

const ui = computed(() => resolveTaskUi(def.value, props.options))
const slotProps = computed(() => ({ run: run.value, kind: run.value?.kind ?? null, final: final.value }))
/** A page's slot, else the component the app or the kind gave for it */
const slotComponent = (name: TaskDialogSlotName): Component | null => (slots[name] ? null : (ui.value.slots[name] ?? null))
const has = (name: TaskDialogSlotName) => !!slots[name] || !!ui.value.slots[name]

// ── The phases (#4655) ────────────────────────────────────────────────────
const phases = ref<TaskPhase[] | null>(null)
const selectedPhase = ref<string | null>(null)
const logView = ref<InstanceType<typeof LogStream> | null>(null)
/** The sub-phases the log has markers for: the only ones it can be filtered on */
const markedSubs = computed(() => {
  const marked = phasesMarkedIn(logView.value?.log.lines.value ?? [])
  return (phases.value ?? []).flatMap((s) => s.subs ?? []).map((s) => s.name).filter((name) => marked.has(name))
})
const selectedLabel = computed(() => {
  const name = selectedPhase.value
  if (!name) return ''
  const isSub = !(phases.value ?? []).some((s) => s.name === name)
  return phaseLabel(tOr, name, isSub)
})
/** The log's pace, else the task's */
const phasesInterval = computed(() => {
  const src = logSource.value as { intervalMs?: number } | null
  return src?.intervalMs ?? def.value?.task?.intervalMs ?? 2000
})

let phasesTimer: ReturnType<typeof setTimeout> | null = null
let phasesRead = 0

async function readPhases(): Promise<void> {
  const source = def.value?.phases
  if (!source) {
    phases.value = null
    return
  }
  if (typeof source !== 'function') {
    phases.value = phaseSteps(source)
    return
  }
  const taskId = run.value?.taskId
  if (taskId === null || taskId === undefined) return
  const current = phasesRead
  try {
    const read = phaseSteps(await source(taskId))
    if (current === phasesRead) phases.value = read
  } catch {
    // Kept as they were: the next read may do better
  }
}

function stopPhases(): void {
  phasesRead++
  if (phasesTimer) clearTimeout(phasesTimer)
  phasesTimer = null
}

// Read now, then at the log's pace until the run ends, then once more
function followPhases(): void {
  stopPhases()
  const current = phasesRead
  const tick = async () => {
    await readPhases()
    if (current !== phasesRead || final.value || typeof def.value?.phases !== 'function') return
    phasesTimer = setTimeout(tick, phasesInterval.value)
  }
  void tick()
}

watch(
  () => [run.value?.id, run.value?.taskId] as const,
  ([id], previous) => {
    const previousId = previous?.[0]
    if (id !== previousId) {
      phases.value = null
      selectedPhase.value = null
    }
    if (id) followPhases()
    else stopPhases()
  },
  { immediate: true }
)

watch(final, (done, was) => {
  if (done && !was && run.value) {
    stopPhases()
    void readPhases()
  }
})

const now = ref(Date.now())
const ticker = setInterval(() => (now.value = Date.now()), 1000)

const elapsed = computed(() => {
  if (!run.value) return ''
  const ms = (run.value.endedAt ?? now.value) - run.value.startedAt
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
})

onBeforeUnmount(() => {
  clearInterval(ticker)
  stopPhases()
})
</script>

<template>
  <div v-if="run" class="qd-task-run-view">
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
    <TaskPhases v-if="phases?.length" v-model:selected="selectedPhase" class="qd-task-phases-frieze" :phases="phases"
      :selectable="!!logSource" :selectable-subs="markedSubs" :icons="ui.phaseIcons" />
    <div v-if="selectedPhase && logSource" class="qd-task-phase-filter">
      <span>{{ t('core.task.phase.filter', { name: selectedLabel }) }}</span>
      <button type="button" class="qd-task-phase-filter-clear" :aria-label="t('core.task.phase.showAll')"
        v-tooltip.top="t('core.task.phase.showAll')" @click="selectedPhase = null"><i class="pi pi-times" /></button>
    </div>
    <div v-if="has('before-log')" class="qd-task-before-log">
      <slot name="before-log" v-bind="slotProps">
        <component :is="slotComponent('before-log')!" v-bind="slotProps" />
      </slot>
    </div>
    <LogStream v-if="logSource" ref="logView" :key="run.id" class="qd-task-log" :source="logSource" :filename="logFilename" height="16rem"
      :phase="selectedPhase"
      :error-pattern="ui.logPatterns.errorPattern" :timestamp-pattern="ui.logPatterns.timestampPattern" @done="store.poke(run.id)" />
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
  </div>
</template>
