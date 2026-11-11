<script setup lang="ts">
/**
 * TaskSequenceDialog - tasks chained in one window (#4934)
 *
 * The list: one line per step, with its state (waiting, running, done,
 * failed, not run), its duration and a recap (the kind's `summary`, else the
 * error, else the step reached); the running step is highlighted. A click on
 * a step shows its detail, the body of TaskDialog (TaskRunView); "Back to the
 * list" returns. Closing does not stop anything: the sequence goes on in the
 * tray. TaskHost renders it when the open id is a sequence's.
 *
 * Slots `before-log`, `after-log` and `result` reach the step's detail.
 */
import { computed, onBeforeUnmount, ref, useSlots, watch } from 'vue'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'
import QdButton from '../base/QdButton.vue'
import TaskRunView from './TaskRunView.vue'
import { useI18n } from '../../i18n/useI18n'
import { getTaskStore, type SequenceStepStatus, type TaskSequenceStep } from '../../tasks/taskStore'
import { resolveTaskUi, type TaskDialogOptions } from '../../tasks/taskUi'
import { formatPhaseDuration } from '../../tasks/taskPhases'

interface Props {
  sequenceId: string | null
  /** Window options over the app's */
  options?: TaskDialogOptions | null
}

const props = withDefaults(defineProps<Props>(), { options: null })
const emit = defineEmits<{ close: [] }>()
const slots = useSlots()
const { t } = useI18n()
const store = getTaskStore()

const sequence = computed(() => (props.sequenceId ? store.state.sequences.find((s) => s.id === props.sequenceId) ?? null : null))
const running = computed(() => store.isActive(sequence.value))
const opts = computed(() => resolveTaskUi(null, props.options).dialog)
const bodySlots = computed(() => (['before-log', 'after-log', 'result'] as const).filter((name) => !!slots[name]))

/** The run shown in detail, or null for the list */
const detailId = ref<string | null>(null)
watch(() => props.sequenceId, () => (detailId.value = null))
const detailStep = computed(() => (detailId.value ? sequence.value?.steps.find((s) => s.runId === detailId.value) ?? null : null))
const detailIndex = computed(() => (detailStep.value ? sequence.value!.steps.indexOf(detailStep.value) : -1))
const detailDef = computed(() => (detailId.value ? store.definition(detailId.value) : undefined))
const detailRun = computed(() => (detailId.value ? store.state.runs.find((r) => r.id === detailId.value) ?? null : null))
const canCancelStep = computed(() => !!detailDef.value?.cancel && !!detailRun.value && store.isActive(detailRun.value) && detailRun.value.taskId != null)

const done = computed(() => sequence.value?.steps.filter((s) => store.isFinal(store.stepStatus(s)) && store.stepStatus(s) !== 'skipped').length ?? 0)
const total = computed(() => sequence.value?.steps.length ?? 0)

const now = ref(Date.now())
const ticker = setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(ticker))

const stepLabel = (step: TaskSequenceStep, i: number) => step.label || t('core.task.sequence.step', { n: i + 1 })
const runOf = (step: TaskSequenceStep) => (step.runId ? store.state.runs.find((r) => r.id === step.runId) ?? null : null)

function stateText(status: SequenceStepStatus): string {
  if (status === 'pending') return t('core.task.sequence.pending')
  if (status === 'skipped') return t('core.task.sequence.skipped')
  return t(`core.task.status.${status}`)
}

function icon(status: SequenceStepStatus): string {
  if (status === 'pending') return 'pi pi-circle'
  if (status === 'skipped') return 'pi pi-minus-circle'
  if (status === 'succeeded') return 'pi pi-check-circle'
  if (status === 'failed') return 'pi pi-times-circle'
  if (status === 'cancelled') return 'pi pi-ban'
  return 'pi pi-spin pi-spinner'
}

function duration(step: TaskSequenceStep): string {
  const run = runOf(step)
  if (!run) return ''
  return formatPhaseDuration(((run.endedAt ?? now.value) - run.startedAt) / 1000)
}

function recap(step: TaskSequenceStep): string | null {
  if (step.skipped) return t(`core.task.sequence.why.${step.skipped}`)
  return store.stepSummary(step)
}

const isCurrent = (i: number) => running.value && sequence.value?.current === i
</script>

<template>
  <Dialog
    :visible="!!sequence"
    :modal="opts.modal"
    :style="{ width: opts.width }"
    :breakpoints="{ '640px': '96vw' }"
    :draggable="opts.draggable"
    :position="opts.position"
    class="qd-task-dialog qd-task-sequence-dialog"
    :class="opts.class"
    @update:visible="(v: boolean) => !v && emit('close')"
  >
    <template #header>
      <div v-if="sequence" class="qd-task-header qd-task-sequence-header">
        <span class="p-dialog-title">{{ sequence.label }}</span>
        <span class="qd-task-status" :class="`qd-task-status--${sequence.status}`">
          <i :class="icon(sequence.status)" aria-hidden="true" />
          {{ t('core.task.sequence.progress', { done, total }) }}
        </span>
      </div>
    </template>

    <template v-if="sequence">
      <ol v-if="!detailStep" class="qd-task-sequence-list">
        <li v-for="(step, i) in sequence.steps" :key="i">
          <button type="button" class="qd-task-sequence-step"
            :class="[`qd-task-sequence-step--${store.stepStatus(step)}`, { 'qd-task-sequence-step--current': isCurrent(i) }]"
            :disabled="!step.runId" :aria-current="isCurrent(i) ? 'step' : undefined"
            :aria-label="step.runId ? `${stepLabel(step, i)} — ${t('core.task.sequence.details')}` : undefined"
            @click="detailId = step.runId">
            <i class="qd-task-sequence-icon" :class="icon(store.stepStatus(step))" aria-hidden="true" />
            <span class="qd-task-sequence-main">
              <span class="qd-task-sequence-label">{{ stepLabel(step, i) }}</span>
              <span v-if="recap(step)" class="qd-task-sequence-recap">{{ recap(step) }}</span>
              <ProgressBar v-if="isCurrent(i) && runOf(step)" class="qd-task-sequence-progress"
                :mode="runOf(step)!.progress === null ? 'indeterminate' : 'determinate'"
                :value="Math.round(runOf(step)!.progress ?? 0)" :show-value="false" />
            </span>
            <span class="qd-task-sequence-state">{{ stateText(store.stepStatus(step)) }}</span>
            <span class="qd-task-sequence-duration">{{ duration(step) }}</span>
            <i v-if="step.runId" class="pi pi-angle-right qd-task-sequence-open" aria-hidden="true" />
          </button>
        </li>
      </ol>
      <template v-else>
        <div class="qd-task-sequence-detail-title">
          <span class="qd-task-sequence-detail-index">{{ detailIndex + 1 }}/{{ total }}</span>
          {{ stepLabel(detailStep, detailIndex) }}
        </div>
        <TaskRunView :run-id="detailId" :options="options">
          <template v-for="name in bodySlots" :key="name" #[name]="p">
            <slot :name="name" v-bind="p" />
          </template>
        </TaskRunView>
      </template>
    </template>

    <template #footer>
      <QdButton v-if="detailStep" class="qd-task-sequence-back" icon="pi pi-arrow-left" text
        :label="t('core.task.sequence.back')" @click="detailId = null" />
      <span class="qd-task-spacer" />
      <QdButton v-if="detailStep && canCancelStep" severity="danger" text :loading="detailRun?.cancelling" icon="pi pi-stop-circle"
        :label="t('core.task.cancel')" @click="detailRun && store.cancel(detailRun.id)" />
      <QdButton v-else-if="!detailStep && running" severity="danger" text :loading="sequence?.cancelling" icon="pi pi-stop-circle"
        :label="t('core.task.sequence.cancel')" @click="sequence && store.cancelSequence(sequence.id)" />
      <QdButton :label="running ? t('core.task.background') : t('core.task.close')" severity="secondary" @click="emit('close')" />
    </template>
  </Dialog>
</template>
