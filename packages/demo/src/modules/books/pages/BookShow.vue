<script setup>
/**
 * BookShow - Book detail page using ShowPage builder
 *
 * DEMONSTRATES: the breadcrumb View↔Edit mode toggle (#1332).
 * On this page the terminal breadcrumb crumb grows an "Edit" link (and the
 * edit form gets the mirror "View" link) because:
 * - `qdadmFeatures.breadcrumbModeToggle` is enabled (see main.js)
 * - the twin route (`book-edit`) exists
 * - the current user passes `canUpdate` — log in as a read-only user and
 *   the Edit affordance disappears while the page stays reachable
 *
 * Genre renders as a badge via the manager's severity map (no local config).
 */
import { useEntityItemShowPage, ShowPage, ShowField, PageNav } from '@quazardous/qdadm'

const show = useEntityItemShowPage({ entity: 'books' })

// Generate fields from schema; the genre severity map comes from the manager
show.generateFields()
show.updateField('genre', { type: 'badge' })

// Header/footer actions (imperative pair — still works alongside the toggle)
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
