<script setup>
/**
 * ApiKeyForm - creates a key and shows its value once (#5319)
 *
 * Nothing here about the value: the entity's `revealOnce` says the create
 * answer carries it, and FormPage shows it in QdRevealOnce before going on.
 */
import { useEntityItemFormPage, FormPage, FormField } from '@quazardous/qdadm'
import InputText from 'primevue/inputtext'

const form = useEntityItemFormPage({ entity: 'apikeys' })
form.generateFields()
form.excludeField('prefix')
form.excludeField('state')
form.excludeField('created_at')
form.addSaveAction({ andClose: true })
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
          <InputText v-model="form.data.value[f.name]" class="w-full" />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
