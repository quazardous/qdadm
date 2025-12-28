<script setup>
/**
 * GenreForm - Simplest qdadm form pattern demo
 *
 * Pattern: ~10 lines for reference/lookup data form
 * - Entity config via useFormPageBuilder
 * - Auto-generate fields from EntityManager schema
 * - FormPage handles loading, actions, dirty state
 */
import { useFormPageBuilder, FormPage, FormField } from 'qdadm'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'

const form = useFormPageBuilder({ entity: 'genres' })
form.generateFields()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField name="name" label="Name *">
          <InputText v-model="form.data.value.name" class="w-full" />
        </FormField>
        <FormField name="description" label="Description">
          <Textarea v-model="form.data.value.description" class="w-full" rows="3" />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
