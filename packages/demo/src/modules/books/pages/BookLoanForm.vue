<script setup>
/**
 * BookLoanForm - Create loan for a specific book
 *
 * Child route of book: /books/:bookId/loans/create
 *
 * DEMONSTRATES: Parent chain auto-detection
 * - book_id is auto-filled from route.meta.parent.foreignKey
 * - No manual extraction of route.params needed
 * - parentData available for display (book title in header)
 */
import { useRouter } from 'vue-router'
import { useEntityItemFormPage, FormPage, FormField, FormInput, PageNav } from 'qdadm'

const router = useRouter()

// Create form - book_id is auto-populated from route.meta.parent!
// No need to manually extract route.params.bookId
const form = useEntityItemFormPage({ entity: 'loans' })

// Access parent data (the book) for display
// Loaded automatically by useEntityItemPage
const parentBook = form.parentData

// Generate form fields from LoansManager
form.generateFields()

// Hide book_id field (auto-filled, not editable)
form.excludeField('book_id')

// Custom save action that redirects to parent loans list
form.addAction('save', {
  label: 'Save & Close',
  icon: 'pi pi-check-circle',
  severity: 'success',
  onClick: async () => {
    const result = await form.submit(false)  // Don't auto-redirect
    if (result) {
      // Redirect to loans list using parent param
      router.push({
        name: 'book-loans',
        params: { bookId: form.parentId.value }
      })
    }
  },
  visible: () => form.manager.canCreate(),
  disabled: ({ dirty, saving }) => !dirty || saving,
  loading: () => form.saving.value
})
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
        <!-- Debug: show that book_id is auto-filled -->
        <div v-if="form.data.value.book_id" class="col-12 mb-3">
          <small class="text-500">
            Book ID (auto-filled): {{ form.data.value.book_id }}
          </small>
        </div>

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
