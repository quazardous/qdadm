<script setup>
/**
 * The whole point of this file is what is NOT in it.
 *
 * No signal subscription, no polling timer, no `useEntityRefresh` call, no
 * onMounted hook chasing updates. The rows below change while you watch them
 * because `runs` is declared in the kernel's `sse.entities` (see main.js) and
 * the entity's own policy says a mounted screen refreshes.
 *
 * That absence is the deliverable: refresh logic in a page is logic in the
 * presentation layer, which the architecture rules out.
 */
import { useListPage, ListPage } from '@quazardous/qdadm'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'

const list = useListPage({ entity: 'runs' })

const SEVERITY = {
  queued: 'secondary',
  running: 'info',
  succeeded: 'success',
  failed: 'danger',
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="name" header="Name" sortable />
      <Column field="status" header="Status" style="width: 140px">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="SEVERITY[data.status]" />
        </template>
      </Column>
      <Column field="progress" header="Progress" style="width: 220px">
        <template #body="{ data }">
          <ProgressBar :value="data.progress" style="height: 0.75rem" />
        </template>
      </Column>
    </template>
  </ListPage>
</template>
