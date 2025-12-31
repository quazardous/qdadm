<script setup>
/**
 * FavoriteForm - Create/Edit form for favorites
 *
 * Shared form component for both create and edit operations.
 * Uses LocalStorage for persistence.
 */

import { useFormPageBuilder, FormPage, FormField } from 'qdadm'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'

const form = useFormPageBuilder({ entity: 'favorites' })
form.generateFields()
form.addSaveAction({ andClose: true })

// Add delete only for edit mode
if (form.isEdit.value) {
  form.addDeleteAction()
}
</script>

<template>
  <FormPage v-bind="form.props" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
          <InputText
            v-if="f.type === 'text'"
            v-model="form.data.value[f.name]"
            class="w-full"
            :disabled="f.readOnly"
          />
          <Select
            v-else-if="f.type === 'select'"
            v-model="form.data.value[f.name]"
            :options="f.options"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
