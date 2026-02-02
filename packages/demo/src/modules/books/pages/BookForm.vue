<script setup>
/**
 * BookForm - Unified Create/Edit form
 *
 * Single Form Pattern: one component handles both create and edit modes.
 * Mode detection is automatic via useEntityItemFormPage.
 *
 * FIELD GROUPS DEMO (Accordion Layout)
 * ====================================
 * Demonstrates using FieldGroups with accordion layout for organizing
 * form fields into collapsible sections with icons.
 *
 * ZONE EXTENSIBILITY DEMO
 * =======================
 * This page uses the 'books-detail-content' zone which can be wrapped
 * by other modules. The Loans module wraps this zone to show loan
 * availability status around the form content.
 *
 * See: modules/loans/components/LoansZoneSetup.vue for wrap operation
 */
import { useEntityItemFormPage, FormPage, FormField, FormInput, FieldGroups, Zone, PageNav } from 'qdadm'

// Route param uses manager.idField ('bookId') automatically
const form = useEntityItemFormPage({ entity: 'books' })
form.generateFields()

// Organize fields into 2 accordion groups with icons
form.group('basic', ['title', 'author'], {
  label: 'Basic Information',
  icon: 'book',
})
form.group('details', ['year', 'genre'], {
  label: 'Publication Details',
  icon: 'info-circle',
})

form.addSaveAction({ andClose: true })
form.addDeleteAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #nav>
      <PageNav />
    </template>

    <template #fields>
      <Zone name="books-detail-content">
        <!-- Field groups rendered as accordion with icons -->
        <FieldGroups
          :groups="form.groups.value"
          :data="form.data.value"
          layout="accordion"
        >
          <template #field="{ field }">
            <FormField :name="field.name" :label="field.label">
              <FormInput :field="field" v-model="form.data.value[field.name]" />
            </FormField>
          </template>
        </FieldGroups>
      </Zone>
    </template>
  </FormPage>
</template>
