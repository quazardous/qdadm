<script setup lang="ts">
/**
 * TaskRunStatus - a run's state, small, on the page of what it is about (#4695)
 *
 * The follow dialog's head in a line: the status (its words and colours),
 * the progress and the step while it runs, the error once it failed, and
 * Follow, which reopens the dialog. Without a run, "Not run yet".
 *
 * Usage:
 *   <TaskRunStatus :run="tasks.runFor('stock-check', { supplierId })" />
 *   <TaskRunStatus :run="run"><template #result="{ run }">{{ run.result.count }} in stock</template></TaskRunStatus>
 */
import { computed } from 'vue'
import ProgressBar from 'primevue/progressbar'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'
import { getTaskStore, type TaskRun } from '../../tasks/taskStore'

interface Props {
  run: TaskRun | null | undefined
  /** Shown without a run. Default "Not run yet" */
  emptyLabel?: string
  /** The Follow button. Default true */
  follow?: boolean
}

const props = withDefaults(defineProps<Props>(), { emptyLabel: undefined, follow: true })

const { t } = useI18n()
const store = getTaskStore()

const active = computed(() => store.isActive(props.run))
const icon = computed(() => {
  if (active.value) return 'pi pi-spin pi-spinner'
  if (props.run?.status === 'succeeded') return 'pi pi-check-circle'
  if (props.run?.status === 'failed') return 'pi pi-times-circle'
  return 'pi pi-ban'
})
</script>

<template>
  <div class="qd-task-run-status" :class="run ? `qd-task-run-status--${run.status}` : 'qd-task-run-status--none'"
    :aria-busy="active ? 'true' : 'false'">
    <template v-if="run">
      <span class="qd-task-status" :class="`qd-task-status--${run.status}`" role="status">
        <i :class="icon" aria-hidden="true" />
        {{ t(`core.task.status.${run.status}`) }}
      </span>
      <template v-if="active">
        <ProgressBar class="qd-task-run-status-progress" :mode="run.progress === null ? 'indeterminate' : 'determinate'"
          :value="Math.round(run.progress ?? 0)" :show-value="false" />
        <span v-if="run.step" class="qd-task-run-status-step">{{ run.step }}</span>
      </template>
      <span v-else-if="run.status === 'failed' && run.error" class="qd-task-run-status-error">{{ run.error }}</span>
      <span v-if="!active && run.status === 'succeeded' && $slots.result" class="qd-task-run-status-result">
        <slot name="result" :run="run" />
      </span>
      <QdButton v-if="follow" class="qd-task-run-status-follow" :label="t('core.task.follow')" icon="pi pi-external-link"
        size="small" text @click="store.open(run.id)" />
    </template>
    <span v-else class="qd-task-run-status-empty">{{ emptyLabel ?? t('core.task.notRun') }}</span>
  </div>
</template>
