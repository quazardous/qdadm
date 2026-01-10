<script setup>
/**
 * BookLoanForm - Create loan for a specific book
 *
 * Child route of book: /books/:bookId/loans/create
 *
 * DEMONSTRATES: Parent chain auto-detection
 * - book_id is auto-filled from route.meta.parent.foreignKey
 * - Redirect after save auto-detects sibling list route (book-loans)
 * - parentData available for display (book title in header)
 */
import { useEntityItemFormPage, FormPage, FormField, FormInput, PageNav } from 'qdadm'

// Create form - everything is auto-detected:
// - Fields auto-generated from manager schema
// - book_id auto-filled and disabled (foreignKey from route.meta.parent)
// - Redirect goes to sibling list route (book-loans)
const form = useEntityItemFormPage({ entity: 'loans' })

// Access parent data (the book) for display
const parentBook = form.parentData

// Standard save action - redirect is auto-detected
form.addSaveAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #nav>
      <PageNav />
    </template>

    <template #header>
      <div class="flex align-items-center gap-2">
        <span>New Loan</span>
        <span v-if="parentBook" class="text-500">
          for "{{ parentBook.title }}"
        </span>
      </div>
    </template>

    <template #fields>
      <div class="form-grid">
        <FormField
          v-for="f in form.fields.value"
          :key="f.name"
          :name="f.name"
          :label="f.label"
          :hidden="f.hidden"
        >
          <FormInput :field="f" v-model="form.data.value[f.name]" />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
