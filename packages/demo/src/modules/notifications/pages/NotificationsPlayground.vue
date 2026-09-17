<script setup>
/**
 * NotificationsPlayground — try the notification zone (#2677).
 *
 * Every toast still pops up; the badge on the sidebar logo keeps a trace of it,
 * for as long as its keep level says, and turns a ring while tracked work lasts.
 */
import { ref } from 'vue'
import { usePageTitle, useSignalToast, useNotifications } from '@quazardous/qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'

usePageTitle('Notifications')

const toast = useSignalToast('NotificationsPlayground')
const notifications = useNotifications()
const running = ref(false)

const severities = [
  { severity: 'success', label: 'Success', icon: 'pi pi-check' },
  { severity: 'info', label: 'Info', icon: 'pi pi-info-circle' },
  { severity: 'warn', label: 'Warning', icon: 'pi pi-exclamation-triangle' },
  { severity: 'error', label: 'Error', icon: 'pi pi-times-circle' },
]

function fire(severity, keep) {
  const label = keep ? `keep: ${keep}` : 'default keep'
  toast[severity](`${severity[0].toUpperCase()}${severity.slice(1)} toast`, label, undefined, keep ? { keep } : {})
}

function fireLinked() {
  toast.warn('Import finished with 3 skipped rows', 'Click the entry in the panel to open the books', undefined, {
    keep: 'long',
    to: { name: 'book' },
  })
}

async function slowOperation() {
  running.value = true
  try {
    // Longer than 400 ms: the ring shows on the logo while it lasts.
    await notifications.track(new Promise((resolve) => setTimeout(resolve, 2500)))
    toast.success('Report generated', 'Tracked for 2.5 s')
  } finally {
    running.value = false
  }
}

async function quickOperation() {
  // Shorter than 400 ms: nothing shows, so fast reloads do not flicker.
  await notifications.track(new Promise((resolve) => setTimeout(resolve, 200)))
  toast.info('Quick operation done', 'Tracked for 200 ms — no ring')
}
</script>

<template>
  <div class="notifications-playground">
    <p class="intro">
      Toasts pop up as usual. The <strong>qdadm logo</strong> at the bottom of the sidebar keeps a trace of them —
      click it to open the history. A count shows unread entries, the logo blinks for warnings and errors,
      and a ring turns while work is in progress.
    </p>

    <Card>
      <template #title>Toasts and keep levels</template>
      <template #content>
        <p class="hint">
          <code>short</code> entries leave the history after 5 minutes, <code>long</code> ones stay until cleared,
          <code>none</code> pops up without leaving a trace. By default success and info are short, warnings and errors long.
        </p>
        <div v-for="s in severities" :key="s.severity" class="row">
          <span class="row-label"><i :class="s.icon" /> {{ s.label }}</span>
          <Button size="small" label="Default" @click="fire(s.severity)" />
          <Button size="small" severity="secondary" label="keep: short" @click="fire(s.severity, 'short')" />
          <Button size="small" severity="secondary" label="keep: long" @click="fire(s.severity, 'long')" />
          <Button size="small" severity="secondary" label="keep: none" @click="fire(s.severity, 'none')" />
        </div>
      </template>
    </Card>

    <Card>
      <template #title>An entry that leads somewhere</template>
      <template #content>
        <Button icon="pi pi-link" label="Warning linked to the books" @click="fireLinked" />
      </template>
    </Card>

    <Card>
      <template #title>Activity on the badge</template>
      <template #content>
        <div class="row">
          <Button icon="pi pi-spinner" :loading="running" label="Slow operation (2.5 s)" @click="slowOperation" />
          <Button severity="secondary" label="Quick operation (200 ms)" @click="quickOperation" />
        </div>
      </template>
    </Card>

    <Card>
      <template #title>A change made elsewhere</template>
      <template #content>
        <p class="hint">
          Open a JP user (JSONPlaceholder → JP Users → a user) and use <strong>Simulate a change made elsewhere</strong>:
          the page reloads, and the history gets a short entry linked to that user — without a pop-up.
        </p>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.notifications-playground {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.intro,
.hint {
  margin: 0 0 0.75rem;
  color: var(--p-text-muted-color);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.row-label {
  min-width: 7rem;
  font-weight: 600;
}
</style>
