<script setup lang="ts">
/**
 * TaskPhases - a task's phases as a frieze (#4655)
 *
 * One item per step: its state (icon and colour), its duration, or the time
 * since it started while it runs. Sub-phases fold out under their step; a
 * failed step stands out and opens its sub-phases. A row across, or a column
 * when its container is narrow. TaskDialog shows it above the log; a page may
 * use it alone.
 *
 * Usage:
 *   <TaskPhases :phases="phases" />
 *   <TaskPhases v-model:selected="phase" :phases="phases" selectable :selectable-subs="['deploy.wait-crons']" />
 *
 * Labels: `phase.<name>` in the app's catalogue, else the name. Icons: the
 * app's per phase name, else the state's.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import {
  formatPhaseDuration,
  phaseLabel,
  phaseSteps,
  TASK_PHASE_STATE_ICONS,
  type TaskPhase,
  type TaskPhasesData,
} from '../../tasks/taskPhases'

interface Props {
  phases: TaskPhasesData | TaskPhase[] | null
  /** The phase whose lines the log shows (v-model:selected) */
  selected?: string | null
  /** The steps can be picked */
  selectable?: boolean
  /** The sub-phases that can be picked: those the log has markers for */
  selectableSubs?: string[] | null
  /** An icon class per phase name */
  icons?: Record<string, string> | null
}

const props = withDefaults(defineProps<Props>(), { selected: null, selectable: false, selectableSubs: null, icons: null })
const emit = defineEmits<{ 'update:selected': [name: string | null] }>()

const { t, tOr } = useI18n()

const steps = computed(() => phaseSteps(props.phases))

const now = ref(Date.now())
const ticker = setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(ticker))

/** Folded or not, as the user left it; a failed step opens by itself */
const opened = ref<Record<string, boolean>>({})
const hasFailure = (step: TaskPhase) => step.state === 'failed' || (step.subs ?? []).some((s) => s.state === 'failed')
const isOpen = (step: TaskPhase) => opened.value[step.name] ?? hasFailure(step)
const toggle = (step: TaskPhase) => (opened.value = { ...opened.value, [step.name]: !isOpen(step) })

const icon = (phase: TaskPhase) => props.icons?.[phase.name] ?? TASK_PHASE_STATE_ICONS[phase.state] ?? TASK_PHASE_STATE_ICONS.pending
const label = (phase: TaskPhase, sub = false) => phaseLabel(tOr, phase.name, sub)
const stateLabel = (phase: TaskPhase) => t(`core.task.phase.${phase.state}`)

/** Its duration once ended, the time since it started while it runs */
function time(phase: TaskPhase): string {
  if (phase.dur !== null && phase.dur !== undefined) return formatPhaseDuration(phase.dur)
  if (!phase.started) return ''
  const start = Date.parse(phase.started)
  if (Number.isNaN(start)) return ''
  const end = phase.ended ? Date.parse(phase.ended) : now.value
  return formatPhaseDuration(Math.max(0, (end - start) / 1000))
}

const canPick = (phase: TaskPhase, sub: boolean) => (sub ? !!props.selectableSubs?.includes(phase.name) : props.selectable)

function pick(phase: TaskPhase, sub: boolean): void {
  if (!canPick(phase, sub)) return
  emit('update:selected', props.selected === phase.name ? null : phase.name)
}
</script>

<template>
  <div v-if="steps.length" class="qd-task-phases">
    <ol class="qd-task-phases-list">
      <li v-for="step in steps" :key="step.name" class="qd-task-phase" :class="[`qd-task-phase--${step.state}`, { 'qd-task-phase--selected': selected === step.name }]">
        <div class="qd-task-phase-head">
          <button type="button" class="qd-task-phase-main" :disabled="!canPick(step, false)" :aria-pressed="canPick(step, false) ? selected === step.name : undefined"
            :title="`${label(step)} · ${stateLabel(step)}`" :aria-label="`${label(step)}, ${stateLabel(step)} ${time(step)}`.trim()" @click="pick(step, false)">
            <i class="qd-task-phase-icon" :class="icon(step)" aria-hidden="true" />
            <span class="qd-task-phase-label">{{ label(step) }}</span>
            <span class="qd-task-phase-time">{{ time(step) }}</span>
          </button>
          <button v-if="step.subs?.length" type="button" class="qd-task-phase-toggle" :aria-expanded="isOpen(step)"
            :aria-label="t('core.task.phase.subs', { count: step.subs.length })" @click="toggle(step)">
            <i class="pi" :class="isOpen(step) ? 'pi-chevron-up' : 'pi-chevron-down'" />
            <span class="qd-task-phase-count">{{ step.subs.length }}</span>
          </button>
        </div>
        <ol v-if="step.subs?.length && isOpen(step)" class="qd-task-phase-subs">
          <li v-for="sub in step.subs" :key="sub.name" class="qd-task-phase qd-task-phase--sub"
            :class="[`qd-task-phase--${sub.state}`, { 'qd-task-phase--selected': selected === sub.name }]">
            <button type="button" class="qd-task-phase-main" :disabled="!canPick(sub, true)" :aria-pressed="canPick(sub, true) ? selected === sub.name : undefined"
              :title="`${label(sub, true)} · ${stateLabel(sub)}`" :aria-label="`${label(sub, true)}, ${stateLabel(sub)} ${time(sub)}`.trim()" @click="pick(sub, true)">
              <i class="qd-task-phase-icon" :class="icon(sub)" aria-hidden="true" />
              <span class="qd-task-phase-label">{{ label(sub, true) }}</span>
              <span class="qd-task-phase-time">{{ time(sub) }}</span>
            </button>
          </li>
        </ol>
      </li>
    </ol>
  </div>
</template>
