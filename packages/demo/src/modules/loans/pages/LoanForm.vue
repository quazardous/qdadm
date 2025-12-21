<script setup>
/**
 * LoanForm - Create/Edit loan page
 *
 * Permission-aware form:
 * - Admin can select any user as borrower
 * - Non-admin: user_id is auto-set to current user (locked field)
 */

import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useForm, PageLayout, FormField, FormActions, useOrchestrator, useAuth } from 'qdadm'
import Card from 'primevue/card'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'

const route = useRoute()
const { getManager } = useOrchestrator()
const { user } = useAuth()

// ============ PERMISSIONS ============
const isAdmin = computed(() => user.value?.role === 'admin')

// ============ FORM SETUP ============
// useForm returns:
//   - manager: EntityManager instance for 'loans'
//   - form: Reactive object with form data (auto-initialized from manager.fields defaults)
//   - loading: true while fetching entity in EDIT mode (always false in CREATE mode)
//   - saving: true during submit (create or update)
//   - dirty: true if form has unsaved changes (compared to last snapshot)
//   - isEdit: true if editing existing entity (getId returns truthy value)
//   - submit(andClose): Save form, optionally navigate back
//   - cancel(): Navigate back (with unsaved changes warning if dirty)
const {
  manager,
  form,
  loading,
  saving,
  dirty,
  isEdit,
  submit,
  cancel
} = useForm({
  entity: 'loans',
  getId: () => route.params.id
})

// ============ OPTIONS & INIT ============
const bookOptions = ref([])
const userOptions = ref([])

onMounted(async () => {
  // Load book options (everyone can read books)
  const booksRes = await getManager('books').list({ page_size: 1000 })
  bookOptions.value = booksRes.items.map(b => ({ label: b.title, value: b.id }))

  if (isAdmin.value) {
    // Admin: load all users for the dropdown
    const usersRes = await getManager('users').list({ page_size: 1000 })
    userOptions.value = usersRes.items.map(u => ({ label: u.username, value: u.id }))
  } else if (!isEdit.value) {
    // Non-admin creating new loan: auto-set user_id to current user
    // (form is already initialized with defaults at this point)
    form.user_id = user.value?.id
  }
})

// ============ DATE HANDLING ============
function parseDate(str) {
  return str ? new Date(str) : null
}

function formatDate(date) {
  return date ? date.toISOString() : null
}
</script>

<template>
  <PageLayout>
    <Card v-if="!loading">
      <template #content>
        <div class="form-grid">
          <FormField name="book_id" label="Book *">
            <Select
              v-model="form.book_id"
              :options="bookOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select a book"
              class="w-full"
              filter
            />
          </FormField>

          <!-- Admin: can select any user -->
          <FormField v-if="isAdmin" name="user_id" label="Borrower *">
            <Select
              v-model="form.user_id"
              :options="userOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select a user"
              class="w-full"
              filter
            />
          </FormField>

          <!-- Non-admin: locked to current user -->
          <FormField v-else name="user_id" label="Borrower">
            <InputText :modelValue="user?.username" disabled class="w-full" />
          </FormField>

          <FormField name="borrowed_at" label="Borrowed At">
            <DatePicker
              :modelValue="parseDate(form.borrowed_at)"
              @update:modelValue="form.borrowed_at = formatDate($event)"
              dateFormat="yy-mm-dd"
              showTime
              hourFormat="24"
              class="w-full"
            />
          </FormField>

          <FormField name="returned_at" label="Returned At">
            <DatePicker
              :modelValue="parseDate(form.returned_at)"
              @update:modelValue="form.returned_at = formatDate($event)"
              dateFormat="yy-mm-dd"
              showTime
              hourFormat="24"
              class="w-full"
              showButtonBar
            />
          </FormField>

          <FormField name="read" label="Read?">
            <div class="flex align-items-center gap-2">
              <ToggleSwitch v-model="form.read" inputId="read" />
              <label for="read" class="cursor-pointer">
                {{ form.read ? 'Yes' : 'No' }}
              </label>
            </div>
          </FormField>
        </div>

        <FormActions
          :isEdit="isEdit"
          :saving="saving"
          :dirty="dirty"
          @save="submit(false)"
          @saveAndClose="submit(true)"
          @cancel="cancel"
        />
      </template>
    </Card>

    <div v-else class="loading-state">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
    </div>
  </PageLayout>
</template>

<style scoped>
.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}
</style>
