<script setup>
/**
 * GenreForm - Create/Edit form for genres
 *
 * Standard form using generateFields() for auto-generated fields.
 */
import { useEntityItemFormPage, FormPage, FormField, FormInput, PageNav } from 'qdadm'

const form = useEntityItemFormPage({ entity: 'genres' })
form.generateFields()
form.addSaveAction({ andClose: true })
form.addDeleteAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #nav>
      <PageNav showDetailsLink />
    </template>

    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
          <FormInput :field="f" v-model="form.data.value[f.name]" />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
