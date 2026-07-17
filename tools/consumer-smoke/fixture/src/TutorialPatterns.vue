<script setup lang="ts">
/**
 * Type-conformance fixture (#1387), template side — tutorial patterns
 * WITHOUT casts:
 * 4. FormInput accepts the fields produced by form.generateFields()
 * 5. index access on form.data.value / show.data.value with default generics
 *    + parentData property access
 */
import { useEntityItemFormPage, useEntityItemShowPage, FormPage, FormField, FormInput, ShowPage, ShowField } from '@quazardous/qdadm'

const form = useEntityItemFormPage({ entity: 'books' })
form.generateFields()
form.addSaveAction({ andClose: true })

const parentBook = form.parentData

const show = useEntityItemShowPage({ entity: 'books' })
show.generateFields()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <p v-if="parentBook">For "{{ parentBook.title }}"</p>
      <FormField v-for="field in form.fields.value" :key="field.name" :name="field.name" :label="field.label">
        <FormInput :field="field" v-model="form.data.value[field.name]" />
      </FormField>
    </template>
  </FormPage>

  <ShowPage v-bind="show.props.value" v-on="show.events">
    <template #fields>
      <ShowField
        v-for="f in show.fields.value"
        :key="f.name"
        :field="f"
        :value="show.data.value?.[f.name]"
        horizontal
      />
    </template>
  </ShowPage>
</template>
