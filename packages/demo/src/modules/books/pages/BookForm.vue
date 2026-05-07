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
 *
 * DEMO: useOptionsLookup (Pure Value Autocomplete)
 * =================================================
 * The author field uses useOptionsLookup to suggest existing author names.
 * Demonstrates pure value mode: options are plain strings extracted from
 * the 'author' field of existing books. No label/value mapping needed.
 */
import { useEntityItemFormPage, FormPage, FormField, FormInput, FieldGroups, Zone, PageNav, useOptionsLookup } from '@quazardous/qdadm'
import AutoComplete from 'primevue/autocomplete'

// Route param uses manager.idField ('bookId') automatically
const form = useEntityItemFormPage({ entity: 'books' })
form.generateFields()

// Pure value autocomplete: extract distinct author names from existing books
const authorLookup = useOptionsLookup({ entity: 'books', field: 'author' })

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
              <!-- Author: pure value autocomplete from existing books -->
              <AutoComplete
                v-if="field.name === 'author'"
                v-model="form.data.value.author"
                :suggestions="authorLookup.suggestions.value"
                @complete="authorLookup.search($event.query)"
                :loading="authorLookup.loading.value"
                dropdown
                placeholder="Type to search existing authors..."
                class="w-full"
              />
              <FormInput v-else :field="field" v-model="form.data.value[field.name]" />
            </FormField>
          </template>
        </FieldGroups>
      </Zone>
    </template>
  </FormPage>
</template>
