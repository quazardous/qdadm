<script setup lang="ts">
/**
 * The canonical show-page pattern (#1281 point 2): what useEntityItemShowPage
 * emits must be assignable to ShowPage's props — `v-bind="show.props.value"`
 * is the documented wiring, so it must typecheck for a strict consumer.
 */
import { useEntityItemShowPage, ShowPage } from '@quazardous/qdadm'

const show = useEntityItemShowPage({ entity: 'bots' })
show.addEditAction()
show.addAction({ name: 'ping', label: 'Ping', severity: 'warn', onClick: () => {} })
</script>

<template>
  <ShowPage v-bind="show.props.value" v-on="show.events" />
</template>
