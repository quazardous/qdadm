<script setup>
/**
 * UserForm - Create/Edit user page
 *
 * Uses useFormPageBuilder with FormInput for auto-rendered fields.
 */
import { useFormPageBuilder, FormPage, FormField, FormInput } from 'qdadm'

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
          <FormInput :field="f" v-model="form.data.value[f.name]" />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
