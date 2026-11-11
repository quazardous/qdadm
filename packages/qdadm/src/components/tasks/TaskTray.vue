<script setup lang="ts">
/**
 * TaskTray - the running tasks, in the sidebar (#4114)
 *
 * Shown while there is a run to show. Each run reopens its dialog; finished
 * ones can be cleared. A row's content can be replaced (#4334): the `item`
 * slot, or `configureTasks({ tray: { item } })`, gets `{ run }`. A sequence
 * (#4934) is one row, "Verify · 1/2", which opens its window.
 */
import { computed, ref } from 'vue'
import Popover from 'primevue/popover'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'
import { getTaskStore, type TaskRun, type TaskSequence } from '../../tasks/taskStore'
import { getTaskUi } from '../../tasks/taskUi'
import { useTaskTrayVisible } from '../../tasks/useTaskNotifications'

const store = getTaskStore()
const taskUi = getTaskUi()
// With the notification zone on, running tasks show there instead (#4171)
const visible = useTaskTrayVisible()
const { t } = useI18n()
const popover = ref<InstanceType<typeof Popover> | null>(null)

// A sequence's steps show as the sequence's row
const runs = computed(() => store.state.runs.filter((r) => !r.sequenceId || !store.state.sequences.some((s) => s.id === r.sequenceId)))
const sequences = computed(() => store.state.sequences)
type Row = { id: string; startedAt: number; run: TaskRun | null; sequence: TaskSequence | null }
const rows = computed<Row[]>(() =>
  [
    ...runs.value.map((run) => ({ id: run.id, startedAt: run.startedAt, run, sequence: null })),
    ...sequences.value.map((sequence) => ({ id: sequence.id, startedAt: sequence.startedAt, run: null, sequence })),
  ].sort((a, b) => b.startedAt - a.startedAt)
)
const activeCount = computed(() => runs.value.filter((r) => store.isActive(r)).length + sequences.value.filter((s) => store.isActive(s)).length)
const hasFinished = computed(() => runs.value.some((r) => store.isFinal(r.status)) || sequences.value.some((s) => !store.isActive(s)))
const stepsDone = (sequence: TaskSequence) =>
  sequence.steps.filter((st) => ['succeeded', 'failed', 'cancelled'].includes(store.stepStatus(st))).length

function openRun(id: string): void {
  store.open(id)
  popover.value?.hide()
}

const icon = (status: string) =>
  ({ succeeded: 'pi pi-check-circle', failed: 'pi pi-times-circle', cancelled: 'pi pi-ban' })[status] ?? 'pi pi-spin pi-spinner'
</script>

<template>
  <div v-if="visible && rows.length" class="qd-task-tray">
    <button type="button" class="qd-task-tray-button" :class="{ 'qd-task-tray-button--busy': activeCount > 0 }"
      :aria-label="t('core.task.tray', { count: activeCount })" @click="popover?.toggle($event)">
      <i :class="activeCount ? 'pi pi-spin pi-cog' : 'pi pi-check'" />
      <span class="qd-task-tray-label">{{ activeCount ? t('core.task.tray', { count: activeCount }) : t('core.task.trayDone') }}</span>
      <span v-if="activeCount" class="qd-task-tray-count">{{ activeCount }}</span>
    </button>
    <Popover ref="popover" class="qd-task-popover">
      <ul class="qd-task-list">
        <li v-for="row in rows" :key="row.id">
          <button v-if="row.sequence" type="button" class="qd-task-item qd-task-item--sequence"
            :class="`qd-task-item--${row.sequence.status}`" @click="openRun(row.sequence.id)">
            <i :class="icon(row.sequence.status)" />
            <span class="qd-task-item-label">{{ row.sequence.label }}</span>
            <span class="qd-task-item-state">
              {{ t('core.task.sequence.progress', { done: stepsDone(row.sequence), total: row.sequence.steps.length }) }}
            </span>
          </button>
          <button v-else-if="row.run" type="button" class="qd-task-item" :class="`qd-task-item--${row.run.status}`" @click="openRun(row.run.id)">
            <slot name="item" :run="row.run">
              <component :is="taskUi.tray.item" v-if="taskUi.tray?.item" :run="row.run" />
              <template v-else>
                <i :class="icon(row.run.status)" />
                <span class="qd-task-item-label">{{ row.run.label }}</span>
                <span class="qd-task-item-state">
                  {{ row.run.progress !== null && !store.isFinal(row.run.status) ? `${Math.round(row.run.progress)} %` : t(`core.task.status.${row.run.status}`) }}
                </span>
              </template>
            </slot>
          </button>
        </li>
      </ul>
      <QdButton v-if="hasFinished" size="small" text icon="pi pi-trash" :label="t('core.task.clear')" @click="store.clearFinished()" />
    </Popover>
  </div>
</template>
