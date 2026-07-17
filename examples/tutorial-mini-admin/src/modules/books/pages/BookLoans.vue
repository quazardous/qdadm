<script setup lang="ts">
import { useListPage, ListPage, PageNav, BoolCell } from '@quazardous/qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'loans' })

list.addCreateAction('New Loan')
list.addEditAction()
list.addDeleteAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #nav>
      <PageNav />
    </template>

    <template #columns>
      <Column field="borrower" header="Borrower" sortable />
      <Column field="returned" header="Returned" style="width: 120px">
        <template #body="{ data }">
          <BoolCell :value="data.returned" />
        </template>
      </Column>
    </template>
  </ListPage>
</template>
