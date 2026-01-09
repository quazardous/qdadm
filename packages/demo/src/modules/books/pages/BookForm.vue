<script setup>
/**
 * BookForm - Unified Create/Edit form
 *
 * Single Form Pattern: one component handles both create and edit modes.
 * Mode detection is automatic via useEntityItemFormPage.
 *
 * ZONE EXTENSIBILITY DEMO
 * =======================
 * This page uses the 'books-detail-content' zone which can be wrapped
 * by other modules. The Loans module wraps this zone to show loan
 * availability status around the form content.
 *
 * See: modules/loans/components/LoansZoneSetup.vue for wrap operation
 */
import { useEntityItemFormPage, FormPage, FormField, FormInput, Zone } from 'qdadm'

const form = useEntityItemFormPage({ entity: 'books' })
form.generateFields()
form.addSaveAction({ andClose: true })
form.addDeleteAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <Zone name="books-detail-content">
        <div class="form-grid">
          <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
            <FormInput :field="f" v-model="form.data.value[f.name]" />
          </FormField>
        </div>
      </Zone>
    </template>
  </FormPage>
</template>
