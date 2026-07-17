<script setup lang="ts">
import { useEntityItemShowPage, ShowPage, ShowField, PageNav } from '@quazardous/qdadm'

const show = useEntityItemShowPage({ entity: 'books' })
show.generateFields()

show.addEditAction()
show.addBackAction()
</script>

<template>
  <ShowPage v-bind="show.props.value" v-on="show.events">
    <template #nav>
      <PageNav />
    </template>

    <template #fields>
      <ShowField
        v-for="f in show.fields.value"
        :key="f.name"
        :field="f"
        :value="show.data.value?.[f.name]"
        horizontal
        label-width="140px"
      />
    </template>
  </ShowPage>
</template>
