<script setup>
/**
 * {{EntityName}}List - List page template
 *
 * Declared, not implemented: the columns, the search and the filters come
 * from the entity; headers and option labels from the catalogue.
 */
import { useListPage, ListPage } from '@quazardous/qdadm'

const list = useListPage({ entity: '{{entity_name}}' })
list.generateColumns()
list.setSearch({ fields: ['name'] })
list.addFilter('status', {
  options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }],
})
list.addCreateAction()
list.addViewAction()
list.addEditAction()
list.addDeleteAction()
</script>
<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <!-- One cell of your own, the rest declared (optional):
    <template #column-status="{ value }">
      <SeverityTag field="status" :value="value" />
    </template>
    -->
  </ListPage>
</template>
