<script setup>
import { useListPageBuilder, ListPage } from 'qdadm'

const list = useListPageBuilder({ entity: 'tasks' })
list.addColumn('title')
list.addColumn('done')
</script>

<template>
  <ListPage v-bind="list.props" />
</template>
