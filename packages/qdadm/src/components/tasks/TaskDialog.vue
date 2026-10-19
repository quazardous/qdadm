<script setup lang="ts">
/**
 * TaskDialog - follow one task run (#4114)
 *
 * Status, progress (indeterminate without a figure), current step, the live
 * log, then the result or the error, a link to the task, and cancel when the
 * backend allows it. Closing it does not stop anything: the run goes on in
 * the tray. TaskHost renders it; a page may render its own with a #result slot.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'
import QdButton from '../base/QdButton.vue'
import LogStream from '../display/LogStream.vue'
import JsonViewer from '../editors/JsonViewer.vue'
import { useI18n } from '../../i18n/useI18n'
import { getTaskStore } from '../../tasks/taskStore'

interface Props {
  runId: string | null
  width?: string
}

const props = withDefaults(defineProps<Props>(), { width: '46rem' })
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = getTaskStore()

const run = computed(() => (props.runId ? store.state.runs.find((r) => r.id === props.runId) ?? null : null))
const def = computed(() => (props.runId ? store.definition(props.runId) : undefined))
const final = computed(() => (run.value ? store.isFinal(run.value.status) : false))
const logSource = computed(() => (run.value?.taskId != null && def.value?.log ? def.value.log(run.value.taskId) : null))
const link = computed(() => (run.value?.taskId != null && def.value?.to ? def.value.to(run.value.taskId) : null))
const canCancel = computed(() => !!def.value?.cancel && !final.value && run.value?.taskId != null)
const resultIsObject = computed(() => run.value?.result !== null && typeof run.value?.result === 'object')

const now = ref(Date.now())
const ticker = setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(ticker))

const elapsed = computed(() => {
  if (!run.value) return ''
  const ms = (run.value.endedAt ?? now.value) - run.value.startedAt
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
})
</script>

<template>
  <Dialog :visible="!!run" modal :header="run?.label" :style="{ width }" :breakpoints="{ '640px': '96vw' }"
    class="qd-task-dialog" @update:visible="(v: boolean) => !v && emit('close')">
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

      <LogStream v-if="logSource" :key="run.id" class="qd-task-log" :source="logSource" height="16rem"
        error-pattern="error|fatal|failed" />

      <div v-if="run.status === 'failed' && run.error" class="qd-task-error"><i class="pi pi-exclamation-triangle" /> {{ run.error }}</div>
      <div v-else-if="!final && run.error" class="qd-task-warning">{{ t('core.task.readError', { error: run.error }) }}</div>

      <div v-if="run.status === 'succeeded' && run.result !== null" class="qd-task-result">
        <slot name="result" :run="run">
          <JsonViewer v-if="resultIsObject" :model-value="(run.result as never)" height="12rem" />
          <span v-else>{{ run.result }}</span>
        </slot>
      </div>
    </template>

    <template #footer>
      <RouterLink v-if="link" :to="(link as never)" class="qd-task-link" @click="emit('close')">
        <i class="pi pi-external-link" /> {{ t('core.task.open') }}
      </RouterLink>
      <span class="qd-task-spacer" />
      <QdButton v-if="canCancel" severity="danger" text :loading="run?.cancelling" icon="pi pi-stop-circle"
        :label="t('core.task.cancel')" @click="run && store.cancel(run.id)" />
      <QdButton :label="final ? t('core.task.close') : t('core.task.background')" severity="secondary" @click="emit('close')" />
    </template>
  </Dialog>
</template>
