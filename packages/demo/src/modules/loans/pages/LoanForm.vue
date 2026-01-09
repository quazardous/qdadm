<script setup>
/**
 * LoanForm - Create/Edit loan page
 *
 * Permission-aware form:
 * - Admin can select any user as borrower
 * - Non-admin: user_id is auto-set to current user (locked field)
 */
import { computed } from 'vue'
import { useEntityItemFormPage, FormPage, FormField, FormInput, useAuth } from 'qdadm'
import InputText from 'primevue/inputtext'

const { user } = useAuth()
const isAdmin = computed(() => user.value?.role === 'ROLE_ADMIN')

const form = useEntityItemFormPage({ entity: 'loans' })
form.generateFields()
form.addSaveAction({ andClose: true })
form.addDeleteAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField name="book_id" label="Book">
          <FormInput :field="form.getFieldConfig('book_id')" v-model="form.data.value.book_id" />
        </FormField>

        <!-- Admin: can select any user -->
        <FormField v-if="isAdmin" name="user_id" label="Borrower">
          <FormInput :field="form.getFieldConfig('user_id')" v-model="form.data.value.user_id" />
        </FormField>
        <!-- Non-admin: locked to current user -->
        <FormField v-else name="user_id" label="Borrower">
          <InputText :modelValue="user?.username" disabled class="w-full" />
        </FormField>

        <FormField name="borrowed_at" label="Borrowed At">
          <FormInput :field="form.getFieldConfig('borrowed_at')" v-model="form.data.value.borrowed_at" />
        </FormField>

        <FormField name="returned_at" label="Returned At">
          <FormInput :field="form.getFieldConfig('returned_at')" v-model="form.data.value.returned_at" />
        </FormField>

        <FormField name="read" label="Read?">
          <FormInput :field="form.getFieldConfig('read')" v-model="form.data.value.read" />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
