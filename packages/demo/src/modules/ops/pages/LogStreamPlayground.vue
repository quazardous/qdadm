<script setup>
/**
 * LogStreamPlayground — a live task log (#4110).
 *
 * The fake worker writes ~80 lines over a few seconds; LogStream polls it by
 * offset, the way it would poll GET /tasks/<id>/log?from=<n>.
 */
import { ref, shallowRef, onBeforeUnmount } from 'vue'
import { usePageTitle, LogStream } from '@quazardous/qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'
import { startFakeTask, bigLog } from './fakeTaskLog'

usePageTitle('Log stream')

const TIMESTAMP = '\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\dZ'
const ERRORS = 'ERROR|FATAL'

const task = shallowRef(startFakeTask())
const run = ref(0)

function launch(fail) {
  task.value.stop()
  task.value = startFakeTask({ fail })
  run.value++
}

const big = bigLog()

onBeforeUnmount(() => task.value.stop())
</script>

<template>
  <div class="log-playground">
    <Card>
      <template #title>A task log, live</template>
      <template #content>
        <p class="hint">
          Scroll up while it runs: following pauses and a button counts the new lines. Search, jump to the errors,
          wrap the long last line, download it.
        </p>
        <div class="row">
          <Button size="small" icon="pi pi-play" label="Run a task" @click="launch(false)" />
          <Button size="small" severity="danger" icon="pi pi-bolt" label="Run a task that fails" @click="launch(true)" />
        </div>
        <LogStream :key="run" :source="{ poll: task.poll, intervalMs: 500 }" :error-pattern="ERRORS"
          :timestamp-pattern="TIMESTAMP" height="22rem" filename="create-box.log" />
      </template>
    </Card>

    <Card>
      <template #title>A finished log of 30 000 lines</template>
      <template #content>
        <p class="hint">Only the rows on screen are drawn. Try searching <code>timed out</code>, then “only matching lines”.</p>
        <LogStream :source="{ lines: big }" :error-pattern="ERRORS" :timestamp-pattern="TIMESTAMP" :follow="false"
          height="22rem" filename="api.log" />
      </template>
    </Card>
  </div>
</template>

<style scoped>
.log-playground {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hint {
  margin: 0 0 0.75rem;
  color: var(--p-text-muted-color);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
</style>
