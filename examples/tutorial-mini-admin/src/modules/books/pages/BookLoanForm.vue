<script setup lang="ts">
import { useEntityItemFormPage, FormPage, FormField, FormInput, PageNav } from '@quazardous/qdadm'

const form = useEntityItemFormPage({ entity: 'loans' })
const parentBook = form.parentData

form.addSaveAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #nav>
      <PageNav />
    </template>

    <template #fields>
      <p v-if="parentBook">Loan for "{{ parentBook.title }}"</p>
      <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
        <FormInput :field="f" v-model="form.data.value[f.name]" />
      </FormField>
    </template>
  </FormPage>
</template>
