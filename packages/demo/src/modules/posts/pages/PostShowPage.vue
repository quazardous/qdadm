<script setup>
/**
 * PostShowPage - JSONPlaceholder Post detail page using ShowPage builder
 *
 * Demonstrates the useEntityItemShowPage composable for read-only detail pages.
 * Simple example with basic fields.
 */
import { useEntityItemShowPage, ShowPage, ShowField, PageNav } from 'qdadm'

const show = useEntityItemShowPage({ entity: 'posts' })

// Generate fields and customize
show.generateFields()

// Customize body field as textarea for better display
show.updateField('body', {
  type: 'textarea',
})

// Customize userId as reference (link to user)
show.updateField('userId', {
  type: 'reference',
  label: 'Author',
  referenceRoute: (value) => ({
    name: 'jp_user-show',
    params: { id: String(value) },
  }),
  referenceLabel: (value) => `User ${value}`,
})

// Add actions
show.addBackAction({ route: 'post' })
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
        label-width="100px"
      />
    </template>
  </ShowPage>
</template>
