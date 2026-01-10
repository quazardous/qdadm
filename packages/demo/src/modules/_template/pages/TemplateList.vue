<script setup>
/**
 * {{EntityName}}List - List page template
 *
 * Replace {{EntityName}} and {{entity_name}} with your entity names.
 */
import { useListPage, ListPage } from 'qdadm'

const list = useListPage({ entity: '{{entity_name}}' })
list.generateColumns()
list.addCreateAction()
list.addEditAction()
list.addDeleteAction()
</script>
<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <!-- Custom column templates (optional) -->
    <!--
    <template #column-status="{ data }">
      <SeverityTag :value="data.status" />
    </template>
    -->
  </ListPage>
</template>
