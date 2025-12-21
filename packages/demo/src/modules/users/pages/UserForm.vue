<script setup>
/**
 * UserForm - Create/Edit user page
 */

import { useRoute } from 'vue-router'
import { useForm, PageLayout, FormField, FormActions } from 'qdadm'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Select from 'primevue/select'

const route = useRoute()

// ============ FORM SETUP ============
// useForm returns:
//   - manager: EntityManager instance for 'users'
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
  entity: 'users',
  getId: () => route.params.id
})

// Get field config from manager
const roleField = manager.getFieldConfig('role')
</script>

<template>
  <PageLayout
    :title="isEdit ? `Edit ${manager.label}: ${manager.getEntityLabel(form)}` : `Add ${manager.label}`"
    :entity="form"
    :manager="manager"
  >
    <Card v-if="!loading">
      <template #content>
        <div class="form-grid">
          <FormField name="username" label="Username *">
            <InputText v-model="form.username" id="username" class="w-full" />
          </FormField>

          <FormField name="password" label="Password *">
            <Password
              v-model="form.password"
              id="password"
              class="w-full"
              :feedback="false"
              toggleMask
            />
          </FormField>

          <FormField name="role" label="Role">
            <Select
              v-model="form.role"
              :options="roleField.options"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
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
