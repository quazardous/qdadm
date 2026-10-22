/**
 * useTaskNotifications - running tasks in the notification zone (#4171)
 *
 * With the NotificationModule on, each running task is a status item of the
 * notification panel (a click reopens its dialog) and the badge shows its
 * work-in-progress ring until the task ends; the end itself is a toast, kept
 * in the history. TaskHost calls it, so any layout that hosts tasks gets it.
 *
 * `showTray` says whether TaskTray should show too: `tasks.tray` in the
 * Kernel options when set, else only without the notification zone.
 */
import { computed, inject, onBeforeUnmount, watch, type ComputedRef } from 'vue'
import { useI18n } from '../i18n/useI18n'
import { NOTIFICATION_KEY, type NotificationStore } from '../notifications/NotificationStore'
import { getTaskStore, type TaskRun } from './taskStore'

export interface TasksConfig {
  /** Show TaskTray in the sidebar. Default: only when the notification zone is off. */
  tray?: boolean
}

const STATUS_PREFIX = 'task:'

/** Whether TaskTray shows, for the current app. */
export function useTaskTrayVisible(): ComputedRef<boolean> {
  const notifications = inject<NotificationStore | null>(NOTIFICATION_KEY, null)
  const config = inject<TasksConfig>('qdadmTasksConfig', {})
  return computed(() => config.tray ?? !notifications)
}

export function useTaskNotifications(): void {
  const notifications = inject<NotificationStore | null>(NOTIFICATION_KEY, null)
  if (!notifications) return
  const store = getTaskStore()
  const { t } = useI18n()
  const tracked = new Set<string>()
  const shown = new Set<string>()

  const stateText = (run: TaskRun): string =>
    run.progress !== null ? `${Math.round(run.progress)} %` : t(`core.task.status.${run.status}`)

  const stop = watch(
    () => store.active.value.map((r) => ({ run: r, label: r.label, status: r.status, progress: r.progress })),
    (entries) => {
      const ids = new Set<string>()
      for (const { run } of entries) {
        const id = STATUS_PREFIX + run.id
        ids.add(id)
        notifications.registerStatus({
          id,
          label: `${run.label} — ${stateText(run)}`,
          severity: 'nominal',
          icon: 'pi pi-spin pi-spinner',
          onClick: () => store.open(run.id),
        })
        shown.add(id)
        if (!tracked.has(run.id)) {
          tracked.add(run.id)
          void notifications.track(run.finished).finally(() => tracked.delete(run.id))
        }
      }
      for (const id of [...shown]) {
        if (ids.has(id)) continue
        notifications.removeStatus(id)
        shown.delete(id)
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    stop()
    for (const id of shown) notifications.removeStatus(id)
    shown.clear()
  })
}
