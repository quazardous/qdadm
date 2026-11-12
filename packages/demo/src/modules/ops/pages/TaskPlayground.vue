<script setup>
/**
 * TaskPlayground — long backend tasks, queued and followed (#4114).
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { usePageTitle, useTaskRunner, useSignals, taskAction, TaskRunStatus } from '@quazardous/qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { createTask } from '../fakeTasks'

usePageTitle('Tasks')

const tasks = useTaskRunner()
const name = ref('checkout-v2')

function create(fail = false) {
  const box = name.value.trim() || 'box'
  tasks.run({
    kind: 'demo-create-box',
    label: `Create box ${box}`,
    start: () => createTask('create', { box, fail }),
    // What the run is about: the page finds it again, live and after a reload (#4695)
    meta: { box },
  })
}

// The latest creation of the box named above, in a line
const lastCreate = computed(() => tasks.runFor('demo-create-box', { box: name.value.trim() || 'box' }))

const boxes = ['staging-main', 'feature-sku-index', 'hotfix-vat']

const destroy = taskAction((box) => ({
  kind: 'demo-destroy-box',
  label: `Destroy box ${box}`,
  start: () => createTask('destroy', { box }),
  confirm: { typed: box, message: `The box ${box}, its database and its files are deleted. This cannot be undone.`, accept: 'Destroy' },
  open: false,
}))

// Two tasks in a row, in one window: the list of steps, a step's detail on a click (#4934).
// Kinds with a start and metas: the sequence goes on after a reload.
function verify(failConf = false) {
  const box = name.value.trim() || 'box'
  tasks.sequence(`Verify ${box}`, [
    { kind: 'demo-check', label: 'Check the box', meta: { box } },
    { kind: 'demo-conf-check', label: 'Check the configuration', meta: { box, fail: failConf } },
  ], { meta: { box, verify: true } })
}
// The end of every run and sequence, on the signal bus (#4961): any page can hear it
const ends = ref([])
const signals = useSignals()
const offs = [
  signals?.on('task:settled', ({ data }) => note(data.run.label, data.status)),
  signals?.on('task:sequence-settled', ({ data }) => note(data.sequence.label, data.status)),
]
onBeforeUnmount(() => offs.forEach((off) => off?.()))
function note(label, status) {
  ends.value = [`${new Date().toLocaleTimeString()} · ${label} · ${status}`, ...ends.value].slice(0, 4)
}
const verifying = computed(() => tasks.isActive(tasks.sequenceFor({ box: name.value.trim() || 'box', verify: true })))

// A reversible gesture: a plain confirmation, no name to type (#4147).
const lastReset = ref(null)
function reset() {
  const box = name.value.trim() || 'box'
  tasks.run({
    kind: 'demo-create-box',
    label: `Fresh database on ${box}`,
    start: () => createTask('reset', { box }),
    confirm: { message: `The database of ${box} is replaced by last night's dump.`, accept: 'Reset' },
    onSettled: (run) => (lastReset.value = `${run.label}: ${run.status}`),
  })
}
</script>

<template>
  <div class="task-playground">
    <Card>
      <template #title>Create a box</template>
      <template #content>
        <p class="hint">
          A worker takes about 20 s. The dialog follows it: status, progress, step, live log. Close it and the task goes on
          in the notification zone (the logo badge, then the panel); reload the page and it is still followed. Cancel stops it on the backend.
        </p>
        <div class="row">
          <InputText v-model="name" size="small" aria-label="Box name" />
          <Button size="small" icon="pi pi-play" label="Create" @click="create(false)" />
          <Button size="small" severity="danger" outlined icon="pi pi-bolt" label="Create (the restore fails)" @click="create(true)" />
          <Button size="small" severity="secondary" outlined icon="pi pi-refresh" label="Fresh database" @click="reset" />
        </div>
        <TaskRunStatus class="last-create" :run="lastCreate">
          <template #result="{ run }"><a :href="run.result.url">{{ run.result.url }}</a></template>
        </TaskRunStatus>
        <p v-if="lastReset" class="hint last-reset">onSettled: {{ lastReset }}</p>
      </template>
    </Card>

    <Card>
      <template #title>Verify a box</template>
      <template #content>
        <p class="hint">
          Two checks in a row, in one window: the list of steps, a click shows a step's log, "Back to the list" returns.
          A failure stops the rest, and one toast says which step failed. The button stays pressed while it runs.
        </p>
        <div class="row">
          <Button size="small" icon="pi pi-verified" label="Verify" :loading="verifying" @click="verify(false)" />
          <Button size="small" severity="danger" outlined icon="pi pi-bolt" label="Verify (the conf check fails)" :disabled="verifying"
            @click="verify(true)" />
        </div>
        <p class="hint">Heard on the signal bus (<code>task:settled</code>, <code>task:sequence-settled</code>):</p>
        <ul class="task-ends">
          <li v-for="line in ends" :key="line">{{ line }}</li>
          <li v-if="!ends.length" class="hint">nothing yet</li>
        </ul>
      </template>
    </Card>

    <Card>
      <template #title>Destroy a box</template>
      <template #content>
        <p class="hint">A dangerous task: its name must be typed first. It runs in the background, without the dialog.</p>
        <ul class="boxes">
          <li v-for="box in boxes" :key="box">
            <code>{{ box }}</code>
            <Button size="small" severity="danger" text icon="pi pi-trash" label="Destroy" @click="destroy(box)" />
          </li>
        </ul>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.last-create {
  margin-top: 0.75rem;
}

.task-playground {
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
  align-items: center;
  gap: 0.5rem;
}

.boxes {
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 24rem;
    padding: 0.25rem 0;
  }
}
</style>
