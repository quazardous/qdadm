<script setup lang="ts">
/**
 * TaskTray - the running tasks, in the sidebar (#4114)
 *
 * Shown while there is a run to show. Each run reopens its dialog; finished
 * ones can be cleared. A row's content can be replaced (#4334): the `item`
 * slot, or `configureTasks({ tray: { item } })`, gets `{ run }`.
 */
import { computed, ref } from 'vue'
import Popover from 'primevue/popover'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'
import { getTaskStore } from '../../tasks/taskStore'
import { getTaskUi } from '../../tasks/taskUi'
import { useTaskTrayVisible } from '../../tasks/useTaskNotifications'

const store = getTaskStore()
const taskUi = getTaskUi()
// With the notification zone on, running tasks show there instead (#4171)
const visible = useTaskTrayVisible()
const { t } = useI18n()
const popover = ref<InstanceType<typeof Popover> | null>(null)

const runs = computed(() => store.state.runs)
const activeCount = computed(() => store.active.value.length)
const hasFinished = computed(() => runs.value.some((r) => store.isFinal(r.status)))

function openRun(id: string): void {
  store.open(id)
  popover.value?.hide()
}

const icon = (status: string) =>
  ({ succeeded: 'pi pi-check-circle', failed: 'pi pi-times-circle', cancelled: 'pi pi-ban' })[status] ?? 'pi pi-spin pi-spinner'
</script>

<template>
  <div v-if="visible && runs.length" class="qd-task-tray">
    <button type="button" class="qd-task-tray-button" :class="{ 'qd-task-tray-button--busy': activeCount > 0 }"
      :aria-label="t('core.task.tray', { count: activeCount })" @click="popover?.toggle($event)">
      <i :class="activeCount ? 'pi pi-spin pi-cog' : 'pi pi-check'" />
      <span class="qd-task-tray-label">{{ activeCount ? t('core.task.tray', { count: activeCount }) : t('core.task.trayDone') }}</span>
      <span v-if="activeCount" class="qd-task-tray-count">{{ activeCount }}</span>
    </button>
    <Popover ref="popover" class="qd-task-popover">
      <ul class="qd-task-list">
        <li v-for="r in runs" :key="r.id">
          <button type="button" class="qd-task-item" :class="`qd-task-item--${r.status}`" @click="openRun(r.id)">
            <slot name="item" :run="r">
              <component :is="taskUi.tray.item" v-if="taskUi.tray?.item" :run="r" />
              <template v-else>
                <i :class="icon(r.status)" />
                <span class="qd-task-item-label">{{ r.label }}</span>
                <span class="qd-task-item-state">
                  {{ r.progress !== null && !store.isFinal(r.status) ? `${Math.round(r.progress)} %` : t(`core.task.status.${r.status}`) }}
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
