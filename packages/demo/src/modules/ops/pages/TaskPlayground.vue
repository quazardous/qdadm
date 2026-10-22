<script setup>
/**
 * TaskPlayground — long backend tasks, queued and followed (#4114).
 */
import { ref } from 'vue'
import { usePageTitle, useTaskRunner, taskAction } from '@quazardous/qdadm'
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
  })
}

const boxes = ['staging-main', 'feature-sku-index', 'hotfix-vat']

const destroy = taskAction((box) => ({
  kind: 'demo-destroy-box',
  label: `Destroy box ${box}`,
  start: () => createTask('destroy', { box }),
  confirm: { typed: box, message: `The box ${box}, its database and its files are deleted. This cannot be undone.`, accept: 'Destroy' },
  open: false,
}))

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
        <p v-if="lastReset" class="hint last-reset">onSettled: {{ lastReset }}</p>
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
