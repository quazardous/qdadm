<script setup lang="ts">
import { useEntityItemFormPage, FormPage, FormField, FormInput } from '@quazardous/qdadm'

const form = useEntityItemFormPage({ entity: 'books' })
form.generateFields()

form.addSaveAction({ andClose: true })
form.addDeleteAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <FormField v-for="field in form.fields.value" :key="field.name" :name="field.name" :label="field.label">
        <FormInput :field="field" v-model="form.data.value[field.name]" />
      </FormField>
    </template>
  </FormPage>
</template>
