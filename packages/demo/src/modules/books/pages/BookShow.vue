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
 *
 * DEMONSTRATES: `manager.invalidate(id)` (#4959). "Changed elsewhere" writes
 * the year straight into the storage, behind the manager's back — as a
 * background job would — then tells the manager; the page reads it again.
 */
import { useEntityItemShowPage, useOrchestrator, useI18n, ShowPage, ShowField, PageNav } from '@quazardous/qdadm'

const show = useEntityItemShowPage({ entity: 'books' })

// Generate fields from schema; the genre severity map comes from the manager
show.generateFields()
show.updateField('genre', { type: 'badge' })

// Header/footer actions (imperative pair — still works alongside the toggle)
show.addEditAction()
show.addBackAction()

const { getManager } = useOrchestrator()
const { t } = useI18n()
show.addAction({
  name: 'changed-elsewhere',
  label: () => t('entities.books.demo.changedElsewhere'),
  icon: 'pi pi-sync',
  severity: 'secondary',
  onClick: async () => {
    const books = getManager('books')
    const id = show.entityId.value
    const year = Number(show.data.value?.year ?? 2000) + 1
    await books.storage.patch(id, { year })
    books.invalidate(id)
  },
})
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
