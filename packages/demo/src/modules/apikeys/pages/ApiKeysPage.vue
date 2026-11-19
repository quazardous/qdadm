<script setup>
/**
 * ApiKeysPage - the keys, never their values (#5319)
 *
 * The list shows a key's prefix only: its value was shown once, at creation.
 */
import { useListPage, ListPage } from '@quazardous/qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'apikeys' })
list.addCreateAction()
list.addDeleteAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column v-bind="list.column('name')" sortable />
      <Column v-bind="list.column('scopes')" />
      <Column v-bind="list.column('prefix')" style="width: 140px">
        <template #body="{ data }">
          <code>{{ data.prefix }}…</code>
        </template>
      </Column>
      <Column v-bind="list.column('created_at')" sortable style="width: 200px" />
    </template>
  </ListPage>
</template>
