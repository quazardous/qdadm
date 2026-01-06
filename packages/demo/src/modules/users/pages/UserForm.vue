<script setup>
/**
 * UserForm - Create/Edit user page
 *
 * Uses useFormPageBuilder with generateFields() for auto-resolved reference options.
 */

import { useFormPageBuilder, FormPage, FormField } from 'qdadm'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Select from 'primevue/select'

// ============ FORM BUILDER ============
const form = useFormPageBuilder({ entity: 'users' })
form.generateFields()
form.addSaveAction({ andClose: true })
form.addDeleteAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
          <InputText v-if="f.type === 'text'" v-model="form.data.value[f.name]" class="w-full" />
          <Password
            v-else-if="f.type === 'password'"
            v-model="form.data.value[f.name]"
            class="w-full"
            :feedback="false"
            toggleMask
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
